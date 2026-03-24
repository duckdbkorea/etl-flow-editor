// mock-server.js
// 실행: node mock-server.js
// Hop REST API와 동일한 인터페이스를 흉내냅니다

const http = require("http");
const { randomUUID } = require("crypto");

const PORT = 8080;

// 실행 중인 파이프라인 상태 저장소
const executions = {};

// ── SSE 클라이언트 목록 ───────────────────────────────────────────────────────
const sseClients = {};   // { executionId: [res, res, ...] }

function sendSSE(executionId, data) {
  const clients = sseClients[executionId] || [];
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  clients.forEach(res => {
    try { res.write(payload); } catch (_) {}
  });
}

// ── 파이프라인 실행 시뮬레이션 ───────────────────────────────────────────────
function simulateExecution(executionId, pipeline) {
  const transforms = pipeline?.pipeline?.transforms || [];
  const exec = executions[executionId];

  let delay = 500;

  transforms.forEach((t, i) => {
    // 각 transform을 순서대로 RUNNING → FINISHED
    setTimeout(() => {
      if (!executions[executionId]) return;

      exec.transforms[t.name] = { status: "RUNNING", linesRead: 0 };

      sendSSE(executionId, {
        type:      "transform_status",
        transform: t.name,
        status:    "RUNNING",
      });
      sendSSE(executionId, {
        type:      "log",
        level:     "info",
        transform: t.name,
        message:   `${t.description || t.name} 처리 시작`,
      });
    }, delay);
    delay += 800;

    // 진행률 업데이트 (중간)
    setTimeout(() => {
      if (!executions[executionId]) return;
      const lines = Math.floor(Math.random() * 50000) + 1000;
      exec.transforms[t.name].linesRead = lines;

      sendSSE(executionId, {
        type:         "progress",
        transform:    t.name,
        linesRead:    lines,
        linesWritten: t.type === "TableOutput" ? lines : 0,
        errors:       0,
      });
    }, delay);
    delay += 600;

    // FINISHED
    setTimeout(() => {
      if (!executions[executionId]) return;
      const lines = exec.transforms[t.name]?.linesRead || 0;
      exec.transforms[t.name].status = "FINISHED";

      sendSSE(executionId, {
        type:      "transform_status",
        transform: t.name,
        status:    "FINISHED",
      });
      sendSSE(executionId, {
        type:      "log",
        level:     "ok",
        transform: t.name,
        message:   `완료 — ${lines.toLocaleString()}행 처리`,
      });
    }, delay);
    delay += 400;
  });

  // 전체 완료
  setTimeout(() => {
    if (!executions[executionId]) return;
    exec.status = "FINISHED";

    sendSSE(executionId, {
      type:    "status",
      status:  "FINISHED",
    });
    sendSSE(executionId, {
      type:    "log",
      level:   "ok",
      message: `── 파이프라인 완료 (${(delay / 1000).toFixed(1)}s) ──`,
    });

    // SSE 연결 종료
    (sseClients[executionId] || []).forEach(res => {
      try { res.end(); } catch (_) {}
    });
    delete sseClients[executionId];
  }, delay + 300);
}

// ── HTTP 라우터 ──────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  // CORS 헤더
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = req.url;

  // ── GET /hop/health ────────────────────────────────────────────────────────
  if (req.method === "GET" && url === "/hop/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", version: "mock-2.0.0" }));
    return;
  }

  // ── POST /hop/run ──────────────────────────────────────────────────────────
  if (req.method === "POST" && url === "/hop/run") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      let pipeline;
      try { pipeline = JSON.parse(body); } catch (_) { pipeline = {}; }

      const executionId = randomUUID();
      executions[executionId] = {
        status:     "RUNNING",
        startTime:  new Date().toISOString(),
        transforms: {},
        pipeline,
      };
      sseClients[executionId] = [];

      console.log(`[mock] 파이프라인 실행 시작: ${executionId}`);
      console.log(`[mock] transforms: ${pipeline?.pipeline?.transforms?.length || 0}개`);

      // 비동기로 시뮬레이션 실행
      setTimeout(() => simulateExecution(executionId, pipeline), 100);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ executionId, status: "RUNNING" }));
    });
    return;
  }

  // ── GET /hop/status/:executionId ───────────────────────────────────────────
  const statusMatch = url.match(/^\/hop\/status\/(.+)$/);
  if (req.method === "GET" && statusMatch) {
    const execId = statusMatch[1];
    const exec   = executions[execId];

    if (!exec) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "실행 ID를 찾을 수 없습니다." }));
      return;
    }

    const transformList = Object.entries(exec.transforms).map(([name, t]) => ({
      name,
      status:       t.status,
      linesRead:    t.linesRead    || 0,
      linesWritten: t.linesWritten || 0,
      errors:       t.errors       || 0,
    }));

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      executionId: execId,
      status:      exec.status,
      startTime:   exec.startTime,
      endTime:     exec.status === "FINISHED" ? new Date().toISOString() : null,
      transforms:  transformList,
    }));
    return;
  }

  // ── GET /hop/logs/:executionId (SSE) ──────────────────────────────────────
  const logsMatch = url.match(/^\/hop\/logs\/(.+)$/);
  if (req.method === "GET" && logsMatch) {
    const execId = logsMatch[1];

    if (!executions[execId]) {
      res.writeHead(404);
      res.end("실행 ID를 찾을 수 없습니다.");
      return;
    }

    // SSE 헤더 설정
    res.writeHead(200, {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection":    "keep-alive",
      "X-Accel-Buffering": "no",   // Nginx 버퍼링 비활성화
    });
    res.write(": SSE 연결됨\n\n");  // 초기 연결 확인 ping

    // 클라이언트 등록
    if (!sseClients[execId]) sseClients[execId] = [];
    sseClients[execId].push(res);
    console.log(`[mock] SSE 클라이언트 연결: ${execId}`);

    // 연결 종료 시 클라이언트 목록에서 제거
    req.on("close", () => {
      if (sseClients[execId]) {
        sseClients[execId] = sseClients[execId].filter(r => r !== res);
      }
      console.log(`[mock] SSE 클라이언트 해제: ${execId}`);
    });
    return;
  }

  // ── POST /hop/stop/:executionId ───────────────────────────────────────────
  const stopMatch = url.match(/^\/hop\/stop\/(.+)$/);
  if (req.method === "POST" && stopMatch) {
    const execId = stopMatch[1];
    if (executions[execId]) {
      executions[execId].status = "STOPPED";
      sendSSE(execId, { type: "status", status: "STOPPED" });
      (sseClients[execId] || []).forEach(r => { try { r.end(); } catch (_) {} });
      delete sseClients[execId];
      console.log(`[mock] 파이프라인 중단: ${execId}`);
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // ── 404 ───────────────────────────────────────────────────────────────────
  console.log(`[mock] 404: ${req.method} ${url}`);
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: `경로를 찾을 수 없습니다: ${url}` }));
});

server.listen(PORT, () => {
  console.log(`\n[mock] Hop Mock 서버 실행 중: http://localhost:${PORT}`);
  console.log("[mock] 엔드포인트:");
  console.log("  GET  /hop/health");
  console.log("  POST /hop/run");
  console.log("  GET  /hop/status/:executionId");
  console.log("  GET  /hop/logs/:executionId  (SSE)");
  console.log("  POST /hop/stop/:executionId\n");
});