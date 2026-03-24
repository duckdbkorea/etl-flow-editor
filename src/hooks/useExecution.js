// src/hooks/useExecution.js
import { useState, useCallback, useRef } from "react";
import { runPipelineOnHop, getPipelineStatus, stopPipeline } from "../api/hopApi";
import { useSSE }           from "./useSSE";
import { serialize }        from "../utils/serialize";
import { validatePipeline } from "../utils/validate";

const HOP_STATUS_MAP = {
  RUNNING:  "running",
  FINISHED: "success",
  FAILED:   "error",
  STOPPED:  "idle",
  IDLE:     "idle",
};

export function useExecution({ nodes, edges, setNodes, setLogs }) {

  const [runStatus,   setRunStatus]   = useState("idle");
  const [executionId, setExecutionId] = useState(null);
  const [nodeStats,   setNodeStats]   = useState({});
  const pollRef = useRef(null);

  // ── 헬퍼 ──────────────────────────────────────────────────────────────────
  const addLog = useCallback((msg, level = "info") => {
    setLogs(l => [...l, {
      time:  new Date().toLocaleTimeString("ko-KR", { hour12: false }),
      msg,
      level,
    }]);
  }, [setLogs]);

  const updateNodeStatus = useCallback((transformName, hopStatus) => {
    const uiStatus = HOP_STATUS_MAP[hopStatus] || "idle";
    setNodes(ns => ns.map(n =>
      n.id === transformName ? { ...n, data: { ...n.data, status: uiStatus } } : n
    ));
  }, [setNodes]);

  const setAllNodesStatus = useCallback((uiStatus) => {
    setNodes(ns => ns.map(n => ({ ...n, data: { ...n.data, status: uiStatus } })));
  }, [setNodes]);

  // ── 폴링 ──────────────────────────────────────────────────────────────────
  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback((execId) => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const result = await getPipelineStatus(execId);
        (result.transforms || []).forEach(t => {
          updateNodeStatus(t.name, t.status);
          if (t.linesRead !== undefined) {
            setNodeStats(prev => ({
              ...prev,
              [t.name]: {
                linesRead:    t.linesRead,
                linesWritten: t.linesWritten || 0,
                errors:       t.errors       || 0,
              },
            }));
          }
        });
        if (result.status === "FINISHED") {
          setRunStatus("done");
          setAllNodesStatus("success");
          addLog("── 파이프라인 완료 ──", "ok");
          stopPolling();
        } else if (result.status === "FAILED") {
          setRunStatus("error");
          addLog("── 파이프라인 실패 ──", "error");
          stopPolling();
        }
      } catch (err) {
        addLog(`상태 조회 오류: ${err.message}`, "error");
        stopPolling();
      }
    }, 2000);
  }, [updateNodeStatus, setAllNodesStatus, addLog, stopPolling]);

  // ── SSE ───────────────────────────────────────────────────────────────────
  useSSE({
    executionId,
    onLog: (entry) => setLogs(l => [...l, entry]),
    onProgress: (name, stats) => {
      setNodeStats(prev => ({ ...prev, [name]: stats }));
      updateNodeStatus(name, "RUNNING");
    },
    onStatusChange: (status, name) => {
      if (name) {
        updateNodeStatus(name, status);
      } else {
        if (status === "FINISHED") {
          setRunStatus("done");
          setAllNodesStatus("success");
          stopPolling();
        } else if (status === "FAILED") {
          setRunStatus("error");
          stopPolling();
        }
      }
    },
    onError: () => {
      if (executionId) startPolling(executionId);
    },
  });

  // ── 시뮬레이션 (Hop 서버 없을 때 자동 전환) ───────────────────────────────
  const runSimulation = useCallback((currentNodes) => {
    setRunStatus("running");

    // 엣지 기반 위상 정렬로 실행 순서 결정
    const adj = {};
    const inDeg = {};
    currentNodes.forEach(n => { adj[n.id] = []; inDeg[n.id] = 0; });
    edges.forEach(e => {
      if (adj[e.source]) adj[e.source].push(e.target);
      if (inDeg[e.target] !== undefined) inDeg[e.target]++;
    });
    const queue = currentNodes.filter(n => inDeg[n.id] === 0).map(n => n.id);
    const nodeMap = Object.fromEntries(currentNodes.map(n => [n.id, n]));
    const ordered = [];
    while (queue.length) {
      const id = queue.shift();
      ordered.push(nodeMap[id]);
      (adj[id] || []).forEach(nid => {
        inDeg[nid]--;
        if (inDeg[nid] === 0) queue.push(nid);
      });
    }
    // 정렬 실패 시 원래 순서 사용
    const finalOrder = ordered.length === currentNodes.length ? ordered : currentNodes;

    let delay = 0;
    const ts = () => new Date().toLocaleTimeString("ko-KR", { hour12: false });

    finalOrder.forEach((node) => {
      setTimeout(() => {
        updateNodeStatus(node.id, "RUNNING");
        setLogs(l => [...l, { time: ts(), msg: `[${node.data.label}] 처리 중…`, level: "info" }]);
      }, delay);
      delay += 1000;

      setTimeout(() => {
        const fakeRows = Math.floor(Math.random() * 80000) + 5000;
        setNodeStats(prev => ({
          ...prev,
          [node.id]: { linesRead: fakeRows, linesWritten: fakeRows, errors: 0 },
        }));
        setLogs(l => [...l, {
          time:  ts(),
          msg:   `[${node.data.label}] 완료 — ${fakeRows.toLocaleString()}행`,
          level: "ok",
        }]);
        updateNodeStatus(node.id, "FINISHED");
      }, delay);
      delay += 400;
    });

    setTimeout(() => {
      setRunStatus("done");
      setLogs(l => [...l, {
        time:  ts(),
        msg:   `── 시뮬레이션 완료 (${(delay / 1000).toFixed(1)}s) ──`,
        level: "ok",
      }]);
    }, delay + 200);
  }, [edges, updateNodeStatus, setLogs]);

  // ── 메인 실행 ─────────────────────────────────────────────────────────────
  const execute = useCallback(async () => {
    if (runStatus === "running") return;

    const { ok, errors } = validatePipeline(nodes, edges);
    if (!ok) {
      alert("파이프라인 오류:\n\n" + errors.join("\n"));
      return;
    }

    setRunStatus("running");
    setNodeStats({});
    setAllNodesStatus("idle");
    addLog("── 파이프라인 실행 요청 ──", "info");

    let hopJson;
    try {
      hopJson = serialize(nodes, edges, "etl_pipeline");
    } catch (err) {
      setRunStatus("error");
      addLog(`직렬화 오류: ${err.message}`, "error");
      return;
    }

    try {
      addLog("Hop 서버에 연결 중…", "info");
      const response = await runPipelineOnHop(hopJson);
      const execId   = response.executionId;

      setExecutionId(execId);
      addLog(`실행 ID: ${execId.slice(0, 8)}…`, "info");
      addLog("SSE 스트림 연결 중…", "info");

      nodes.filter(n => n.type === "source")
           .forEach(n => updateNodeStatus(n.id, "RUNNING"));

    } catch (err) {
      const isNetworkErr =
        err.message.includes("Failed to fetch") ||
        err.message.includes("NetworkError")    ||
        err.message.includes("ECONNREFUSED")    ||
        err.message.includes("502")             ||
        err.message.includes("503");

      if (isNetworkErr) {
        addLog("Hop 서버 미연결 — 시뮬레이션 모드로 자동 전환", "warn");
        runSimulation(nodes);
      } else {
        setRunStatus("error");
        setAllNodesStatus("idle");
        addLog(`실행 오류: ${err.message}`, "error");
      }
    }
  }, [runStatus, nodes, edges, setAllNodesStatus, addLog,
      updateNodeStatus, runSimulation, serialize]);

  // ── 중단 ──────────────────────────────────────────────────────────────────
  const stop = useCallback(async () => {
    stopPolling();
    if (executionId) {
      try { await stopPipeline(executionId); } catch (_) {}
    }
    setRunStatus("idle");
    setAllNodesStatus("idle");
    setExecutionId(null);
    addLog("파이프라인 중단됨", "warn");
  }, [executionId, setAllNodesStatus, addLog, stopPolling]);

  return { runStatus, executionId, nodeStats, execute, stop };
}