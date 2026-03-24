// src/utils/serialize.js

// ── 노드 타입 → Hop transform type 매핑 ──────────────────────────────────────
const NODE_TYPE_MAP = {
  source:    "TableInput",
  transform: "SelectValues",
  filter:    "FilterRows",
  target:    "TableOutput",
};

// ── DB 종류 → Hop connection type 매핑 ───────────────────────────────────────
const DB_TYPE_MAP = {
  PostgreSQL: "POSTGRESQL",
  AgensSQL:   "POSTGRESQL",   // AgensSQL은 PostgreSQL 호환
  Oracle:     "ORACLE",
  MySQL:      "MYSQL",
  MariaDB:    "MARIADB",
  MSSQL:      "MSSQL",
  DuckDB:     "DUCKDB",
};

// ── 타입 이름 → Hop 데이터 타입 매핑 ─────────────────────────────────────────
const DATA_TYPE_MAP = {
  "TEXT":      "String",
  "INT":       "Integer",
  "BIGINT":    "Integer",
  "FLOAT":     "Number",
  "BOOLEAN":   "Boolean",
  "DATE":      "Date",
  "TIMESTAMP": "Timestamp",
  "JSON":      "String",
};

// ══════════════════════════════════════════════════════════════════════════════
// 메인 직렬화 함수
// ══════════════════════════════════════════════════════════════════════════════
export function serialize(nodes, edges, pipelineName = "etl_pipeline") {
  // 1단계: 위상 정렬로 실행 순서 결정
  const sortedNodes = topologicalSort(nodes, edges);

  // 2단계: DB 연결 정보 수집 (중복 제거)
  const connections = extractConnections(nodes);

  // 3단계: 각 노드를 Hop transform으로 변환
  const transforms = sortedNodes.map(node =>
    nodeToTransform(node, connections)
  );

  // 4단계: 엣지를 Hop order(hop)로 변환
  const order = edges.map(edge => ({
    from:    edge.source,
    to:      edge.target,
    enabled: true,
  }));

  // 5단계: 최종 Hop JSON 조립
  return {
    pipeline: {
      pipeline_version: "1",
      pipeline_type:    "Normal",
      info: {
        name:         sanitizeName(pipelineName),
        description:  `ETL Flow — ${pipelineName}`,
        created_date: formatHopDate(new Date()),
        modified_date: formatHopDate(new Date()),
      },
      transforms,
      order,
      connections: Object.values(connections),
    },
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// 위상 정렬 (Kahn's Algorithm — BFS 방식)
// ══════════════════════════════════════════════════════════════════════════════
function topologicalSort(nodes, edges) {
  // 진입 차수(in-degree) 계산
  const inDegree = {};
  nodes.forEach(n => { inDegree[n.id] = 0; });
  edges.forEach(e => {
    if (inDegree[e.target] !== undefined) {
      inDegree[e.target]++;
    }
  });

  // 인접 리스트 구성
  const adj = {};
  nodes.forEach(n => { adj[n.id] = []; });
  edges.forEach(e => {
    if (adj[e.source]) adj[e.source].push(e.target);
  });

  // 노드 ID → 노드 객체 맵
  const nodeMap = {};
  nodes.forEach(n => { nodeMap[n.id] = n; });

  // 진입 차수가 0인 노드부터 큐에 삽입
  const queue = nodes
    .filter(n => inDegree[n.id] === 0)
    .map(n => n.id);

  const result = [];

  while (queue.length > 0) {
    const nodeId = queue.shift();
    result.push(nodeMap[nodeId]);

    // 현재 노드의 이웃들 진입 차수 감소
    for (const neighborId of (adj[nodeId] || [])) {
      inDegree[neighborId]--;
      // 진입 차수가 0이 되면 큐에 추가
      if (inDegree[neighborId] === 0) {
        queue.push(neighborId);
      }
    }
  }

  // 정렬 결과가 전체 노드 수와 다르면 순환 참조 존재
  if (result.length !== nodes.length) {
    throw new Error("순환 참조가 감지되어 직렬화할 수 없습니다.");
  }

  return result;
}

// ══════════════════════════════════════════════════════════════════════════════
// DB 연결 정보 추출 (source/target 노드에서 수집, 중복 제거)
// ══════════════════════════════════════════════════════════════════════════════
function extractConnections(nodes) {
  const connections = {};

  nodes
    .filter(n => n.type === "source" || n.type === "target")
    .forEach(n => {
      const d = n.data;
      if (!d.host) return;  // 연결 정보 없으면 스킵

      // 연결 이름: "DB종류_host_database" 형태로 유니크하게 생성
      const connName = sanitizeName(`${d.db}_${d.host}_${d.database || "default"}`);

      if (!connections[connName]) {
        connections[connName] = {
          name:     connName,
          server:   d.host,
          type:     DB_TYPE_MAP[d.db] || "POSTGRESQL",
          access:   "Native",
          database: d.database || "",
          port:     d.port     || "5432",
          username: d.username || "",
          // 실제 운영 시 Hop의 암호화 방식 적용 필요
          password: d.password ? `Encrypted ${simpleObfuscate(d.password)}` : "",
        };
      }
    });

  return connections;
}

// ══════════════════════════════════════════════════════════════════════════════
// 노드 타입별 Hop transform 변환
// ══════════════════════════════════════════════════════════════════════════════
function nodeToTransform(node, connections) {
  const base = {
    name:        node.id,
    type:        NODE_TYPE_MAP[node.type] || "UserDefinedJavaClass",
    description: node.data.label || "",
    GUI: {
      xloc: Math.round(node.position.x),
      yloc: Math.round(node.position.y),
    },
  };

  switch (node.type) {
    case "source":   return { ...base, attributes: buildSourceAttrs(node.data, connections) };
    case "transform":return { ...base, attributes: buildTransformAttrs(node.data) };
    case "filter":   return { ...base, attributes: buildFilterAttrs(node.data) };
    case "target":   return { ...base, attributes: buildTargetAttrs(node.data, connections) };
    default:         return { ...base, attributes: {} };
  }
}

// ── Source 노드 attributes ────────────────────────────────────────────────────
function buildSourceAttrs(data, connections) {
  const connName = findConnectionName(data, connections);
  const sql = data.useQuery && data.query
    ? data.query.trim()
    : `SELECT * FROM ${data.schema ? data.schema + "." : ""}${data.table}`;

  return {
    connection:             connName,
    sql:                    sql,
    limit:                  "0",
    execute_each_row:       "N",
    variables_active:       "N",
    lazy_conversion_active: "N",
  };
}

// ── Transform 노드 attributes ─────────────────────────────────────────────────
function buildTransformAttrs(data) {
  const fields = (data.fields || []).map(f => ({
    name:   f.from,
    rename: f.to !== f.from ? f.to : "",        // 같으면 빈 문자열 (Hop 규칙)
    type:   DATA_TYPE_MAP[f.type] || "String",
    format: "",
    length: "-2",
    precision: "-2",
  }));

  return { fields };
}

// ── Filter 노드 attributes ────────────────────────────────────────────────────
function buildFilterAttrs(data) {
  return {
    send_true_to:  data.passLabel || "",
    send_false_to: data.failLabel || "",
    condition: {
      // Hop의 FilterRows는 XML 기반 condition을 사용
      // 간단한 SQL WHERE 절을 그대로 저장하고 import 시 파싱
      operator:    "AND",
      raw_sql:     data.condition || "",
    },
  };
}

// ── Target 노드 attributes ────────────────────────────────────────────────────
function buildTargetAttrs(data, connections) {
  const connName = findConnectionName(data, connections);
  const isTruncate = data.mode === "OVERWRITE" || data.mode === "TRUNCATE_INSERT";
  const isUpsert   = data.mode === "UPSERT";

  return {
    connection:     connName,
    schema:         data.schema || "public",
    table:          data.table  || "",
    commit:         String(data.batchSize || 1000),
    truncate:       isTruncate ? "Y" : "N",
    ignore_errors:  "N",
    use_batch:      "Y",
    returning_keys: "N",
    // UPSERT는 Hop의 InsertUpdate 타입으로 처리
    ...(isUpsert && {
      _hop_type_override: "InsertUpdate",
      key_fields: (data.upsertKey || "")
        .split(",")
        .map(k => k.trim())
        .filter(Boolean)
        .map(k => ({ name: k, condition: "=", name2: k })),
    }),
    create_table: data.createTable ? "Y" : "N",
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// 유틸 함수들
// ══════════════════════════════════════════════════════════════════════════════

// connections 맵에서 해당 노드의 연결 이름 찾기
function findConnectionName(data, connections) {
  const connName = sanitizeName(`${data.db}_${data.host}_${data.database || "default"}`);
  return connections[connName] ? connName : "";
}

// Hop 날짜 포맷: "2025/01/15 09:30:00.000"
function formatHopDate(date) {
  const pad = (n, len = 2) => String(n).padStart(len, "0");
  return (
    `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.` +
    `${pad(date.getMilliseconds(), 3)}`
  );
}

// Hop 이름 규칙: 영문자, 숫자, 언더스코어만 허용
function sanitizeName(name) {
  return name.replace(/[^a-zA-Z0-9_]/g, "_").replace(/__+/g, "_");
}

// 패스워드 간단 난독화 (실제 운영 시 Hop 암호화 모듈 사용 권장)
function simpleObfuscate(password) {
  return btoa(unescape(encodeURIComponent(password)));
}