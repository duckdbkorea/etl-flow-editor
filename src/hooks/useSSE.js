// src/hooks/useSSE.js
import { useEffect, useRef, useCallback } from "react";
import { getSSEUrl } from "../api/hopApi";

// ── SSE 이벤트 형식 (Hop 서버가 보내는 형식) ─────────────────────────────────
// data: {"type":"log","level":"info","message":"src1: Connecting...","transform":"src1"}
// data: {"type":"progress","transform":"tfm1","linesRead":1000,"linesWritten":1000}
// data: {"type":"status","status":"FINISHED"}
// data: {"type":"error","transform":"src1","message":"Connection refused"}

export function useSSE({ executionId, onLog, onProgress, onStatusChange, onError }) {
  const esRef = useRef(null);   // EventSource 인스턴스 보관

  // SSE 연결 종료
  const disconnect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
  }, []);

  useEffect(() => {
    // executionId가 없으면 연결하지 않음
    if (!executionId) return;

    // 이전 연결이 있으면 먼저 종료
    disconnect();

    const url = getSSEUrl(executionId);
    const es  = new EventSource(url);
    esRef.current = es;

    // ── 연결 성공 ──────────────────────────────────────────────────────────
    es.onopen = () => {
      onLog?.({
        time:  new Date().toLocaleTimeString("ko-KR", { hour12: false }),
        msg:   `SSE 연결 완료 (execution: ${executionId})`,
        level: "info",
      });
    };

    // ── 메시지 수신 ────────────────────────────────────────────────────────
    es.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        // JSON 파싱 실패 시 원문 텍스트로 로그
        onLog?.({
          time:  new Date().toLocaleTimeString("ko-KR", { hour12: false }),
          msg:   event.data,
          level: "info",
        });
        return;
      }

      const ts = new Date().toLocaleTimeString("ko-KR", { hour12: false });

      switch (data.type) {
        // 일반 로그 메시지
        case "log":
          onLog?.({
            time:  ts,
            msg:   data.transform ? `[${data.transform}] ${data.message}` : data.message,
            level: data.level || "info",
          });
          break;

        // 진행률 업데이트 (노드별 처리 행 수)
        case "progress":
          onProgress?.(data.transform, {
            linesRead:    data.linesRead    || 0,
            linesWritten: data.linesWritten || 0,
            errors:       data.errors       || 0,
          });
          onLog?.({
            time:  ts,
            msg:   `[${data.transform}] ${(data.linesRead || 0).toLocaleString()}행 처리 중`,
            level: "info",
          });
          break;

        // 전체 파이프라인 상태 변경
        case "status":
          onStatusChange?.(data.status, data.transform);
          if (data.status === "FINISHED") {
            onLog?.({ time: ts, msg: "── 파이프라인 완료 ──", level: "ok" });
            disconnect();   // 완료 시 SSE 연결 종료
          } else if (data.status === "FAILED") {
            onLog?.({ time: ts, msg: "── 파이프라인 실패 ──", level: "error" });
            disconnect();
          }
          break;

        // 개별 transform 상태 변경
        case "transform_status":
          onStatusChange?.(data.status, data.transform);
          break;

        // 오류
        case "error":
          onLog?.({
            time:  ts,
            msg:   data.transform
                     ? `[${data.transform}] 오류: ${data.message}`
                     : `오류: ${data.message}`,
            level: "error",
          });
          break;

        default:
          break;
      }
    };

    // ── SSE 연결 오류 ──────────────────────────────────────────────────────
    es.onerror = () => {
      onError?.();
      onLog?.({
        time:  new Date().toLocaleTimeString("ko-KR", { hour12: false }),
        msg:   "SSE 연결 끊김. 상태 폴링으로 전환합니다.",
        level: "warn",
      });
      // EventSource는 기본적으로 재연결을 시도하지만
      // 파이프라인이 종료된 경우에는 수동으로 닫음
      if (es.readyState === EventSource.CLOSED) {
        disconnect();
      }
    };

    // 컴포넌트 언마운트 또는 executionId 변경 시 정리
    return () => disconnect();
  }, [executionId]);   // executionId가 바뀔 때마다 재연결

  return { disconnect };
}