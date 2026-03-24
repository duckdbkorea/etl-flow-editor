// src/api/hopApi.js

const BASE = "/api";   // Vite proxy가 :8080으로 전달

// ── 공통 fetch 래퍼 ──────────────────────────────────────────────────────────
async function request(method, path, body = null) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, opts);

  if (!res.ok) {
    // Hop 서버가 반환한 오류 메시지를 그대로 전달
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`[${res.status}] ${text}`);
  }

  // 204 No Content 같은 응답은 JSON 파싱 스킵
  const contentType = res.headers.get("content-type") || "";
  return contentType.includes("application/json") ? res.json() : null;
}

// ══════════════════════════════════════════════════════════════════════════════
// 파이프라인 실행
// POST /api/hop/run
// body: { pipeline: { ... } }   ← serialize()가 만든 Hop JSON
// 응답: { executionId: "abc-123", status: "RUNNING" }
// ══════════════════════════════════════════════════════════════════════════════
export async function runPipelineOnHop(hopJson) {
  return request("POST", "/hop/run", hopJson);
}

// ══════════════════════════════════════════════════════════════════════════════
// 실행 상태 조회 (폴링용)
// GET /api/hop/status/:executionId
// 응답: {
//   executionId: "abc-123",
//   status: "RUNNING" | "FINISHED" | "FAILED" | "STOPPED",
//   startTime: "...",
//   endTime: "...",
//   transforms: [
//     { name: "src1", status: "FINISHED", linesRead: 48302, errors: 0 },
//     { name: "tfm1", status: "RUNNING",  linesRead: 31204, errors: 0 },
//     ...
//   ]
// }
// ══════════════════════════════════════════════════════════════════════════════
export async function getPipelineStatus(executionId) {
  return request("GET", `/hop/status/${executionId}`);
}

// ══════════════════════════════════════════════════════════════════════════════
// 파이프라인 중단
// POST /api/hop/stop/:executionId
// ══════════════════════════════════════════════════════════════════════════════
export async function stopPipeline(executionId) {
  return request("POST", `/hop/stop/${executionId}`);
}

// ══════════════════════════════════════════════════════════════════════════════
// SSE 스트림 URL 반환 (fetch가 아닌 EventSource로 연결)
// GET /api/hop/logs/:executionId  (text/event-stream)
// ══════════════════════════════════════════════════════════════════════════════
export function getSSEUrl(executionId) {
  return `${BASE}/hop/logs/${executionId}`;
}

// ══════════════════════════════════════════════════════════════════════════════
// Hop 서버 헬스체크
// GET /api/hop/health
// 응답: { status: "ok", version: "2.x.x" }
// ══════════════════════════════════════════════════════════════════════════════
export async function checkHopHealth() {
  return request("GET", "/hop/health");
}