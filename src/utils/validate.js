// src/utils/validate.js

/**
 * 직렬화 전 캔버스 유효성 검사
 * 오류가 있으면 { ok: false, errors: [...] }
 * 문제없으면 { ok: true, errors: [] }
 */
export function validatePipeline(nodes, edges) {
  const errors = [];

  // 1. 노드가 최소 2개 이상 있어야 함
  if (nodes.length < 2) {
    errors.push("파이프라인에 노드가 2개 이상 필요합니다.");
  }

  // 2. Source 노드가 1개 이상 있어야 함
  const sources = nodes.filter(n => n.type === "source");
  if (sources.length === 0) {
    errors.push("Source 노드가 1개 이상 필요합니다.");
  }

  // 3. Target 노드가 1개 이상 있어야 함
  const targets = nodes.filter(n => n.type === "target");
  if (targets.length === 0) {
    errors.push("Target 노드가 1개 이상 필요합니다.");
  }

  // 4. 연결되지 않은 고립 노드 검사
  const connectedIds = new Set([
    ...edges.map(e => e.source),
    ...edges.map(e => e.target),
  ]);
  const isolated = nodes.filter(n => !connectedIds.has(n.id));
  if (isolated.length > 0) {
    errors.push(
      `연결되지 않은 노드: ${isolated.map(n => n.data.label).join(", ")}`
    );
  }

  // 5. 순환 참조(Cycle) 감지
  if (hasCycle(nodes, edges)) {
    errors.push("순환 참조(루프)가 감지되었습니다. 파이프라인은 단방향이어야 합니다.");
  }

  // 6. Source 노드 필수 필드 검사
  sources.forEach(n => {
    if (!n.data.host)  errors.push(`[${n.data.label}] host가 비어 있습니다.`);
    if (!n.data.table && !n.data.query)
      errors.push(`[${n.data.label}] table 또는 SQL query가 필요합니다.`);
  });

  // 7. Target 노드 필수 필드 검사
  targets.forEach(n => {
    if (!n.data.host)  errors.push(`[${n.data.label}] host가 비어 있습니다.`);
    if (!n.data.table) errors.push(`[${n.data.label}] table이 비어 있습니다.`);
  });

  return { ok: errors.length === 0, errors };
}

// ── 순환 참조 감지 (DFS) ──────────────────────────────────────────────────────
function hasCycle(nodes, edges) {
  // 인접 리스트 구성
  const adj = {};
  nodes.forEach(n => { adj[n.id] = []; });
  edges.forEach(e => {
    if (adj[e.source]) adj[e.source].push(e.target);
  });

  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = {};
  nodes.forEach(n => { color[n.id] = WHITE; });

  function dfs(nodeId) {
    color[nodeId] = GRAY;
    for (const neighbor of (adj[nodeId] || [])) {
      if (color[neighbor] === GRAY) return true;  // 순환 발견
      if (color[neighbor] === WHITE && dfs(neighbor)) return true;
    }
    color[nodeId] = BLACK;
    return false;
  }

  return nodes.some(n => color[n.id] === WHITE && dfs(n.id));
}