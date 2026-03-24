// src/utils/deserialize.js

const HOP_TYPE_TO_NODE = {
  TableInput:    "source",
  SelectValues:  "transform",
  FilterRows:    "filter",
  TableOutput:   "target",
  InsertUpdate:  "target",   // UPSERT 모드
};

const HOP_DB_TYPE_MAP = {
  POSTGRESQL: "PostgreSQL",
  ORACLE:     "Oracle",
  MYSQL:      "MySQL",
  MARIADB:    "MariaDB",
  MSSQL:      "MSSQL",
  DUCKDB:     "DuckDB",
};

const HOP_DATA_TYPE_MAP = {
  String:    "TEXT",
  Integer:   "INT",
  Number:    "FLOAT",
  Boolean:   "BOOLEAN",
  Date:      "DATE",
  Timestamp: "TIMESTAMP",
};

// ══════════════════════════════════════════════════════════════════════════════
// 메인 역직렬화 함수
// ══════════════════════════════════════════════════════════════════════════════
export function deserialize(hopJson) {
  const pipeline = hopJson.pipeline;
  if (!pipeline) throw new Error("유효하지 않은 Hop JSON 형식입니다.");

  const transforms = pipeline.transforms || [];
  const order      = pipeline.order      || [];
  const conns      = pipeline.connections || [];

  // connections 맵 구성 (이름 → 연결 정보)
  const connMap = {};
  conns.forEach(c => { connMap[c.name] = c; });

  // transforms → React Flow nodes
  const nodes = transforms.map(t => transformToNode(t, connMap));

  // order → React Flow edges
  const edges = order.map((hop, i) => ({
    id:     `e_${i}_${hop.from}_${hop.to}`,
    source: hop.from,
    target: hop.to,
    type:   "animated",
    data:   { status: "idle" },
    markerEnd: { type: "arrowclosed", color: "#B4B2A9" },
  }));

  return { nodes, edges, name: pipeline.info?.name || "Untitled" };
}

// ══════════════════════════════════════════════════════════════════════════════
// transform → React Flow node 변환
// ══════════════════════════════════════════════════════════════════════════════
function transformToNode(transform, connMap) {
  const nodeType = HOP_TYPE_TO_NODE[transform.type] || "transform";
  const attrs    = transform.attributes || {};
  const conn     = connMap[attrs.connection] || {};

  const base = {
    id:       transform.name,
    type:     nodeType,
    position: {
      x: transform.GUI?.xloc || 100,
      y: transform.GUI?.yloc || 100,
    },
  };

  switch (nodeType) {
    case "source":
      return {
        ...base,
        data: {
          label:    transform.description || transform.name,
          db:       HOP_DB_TYPE_MAP[conn.type] || "PostgreSQL",
          host:     conn.server   || "",
          port:     conn.port     || "5432",
          database: conn.database || "",
          username: conn.username || "",
          password: "",           // 보안상 패스워드는 복원하지 않음
          table:    extractTableFromSQL(attrs.sql || ""),
          query:    attrs.sql     || "",
          useQuery: isCustomQuery(attrs.sql || ""),
          status:   "idle",
        },
      };

    case "transform":
      return {
        ...base,
        data: {
          label:  transform.description || transform.name,
          op:     "Column rename + type cast",
          fields: (attrs.fields || []).map(f => ({
            from: f.name,
            to:   f.rename || f.name,
            type: HOP_DATA_TYPE_MAP[f.type] || "TEXT",
          })),
          status: "idle",
        },
      };

    case "filter":
      return {
        ...base,
        data: {
          label:     transform.description || transform.name,
          condition: attrs.condition?.raw_sql || "",
          passLabel: attrs.send_true_to      || "PASS",
          failLabel: attrs.send_false_to     || "FAIL",
          status:    "idle",
        },
      };

    case "target":
      return {
        ...base,
        data: {
          label:       transform.description || transform.name,
          db:          HOP_DB_TYPE_MAP[conn.type] || "PostgreSQL",
          host:        conn.server    || "",
          port:        conn.port      || "5432",
          database:    conn.database  || "",
          username:    conn.username  || "",
          password:    "",
          schema:      attrs.schema   || "public",
          table:       attrs.table    || "",
          mode:        detectWriteMode(attrs, transform.type),
          upsertKey:   (attrs.key_fields || []).map(k => k.name).join(", "),
          batchSize:   attrs.commit   || "1000",
          createTable: attrs.create_table === "Y",
          status:      "idle",
        },
      };

    default:
      return { ...base, data: { label: transform.name, status: "idle" } };
  }
}

// ── 유틸 함수들 ──────────────────────────────────────────────────────────────

// "SELECT * FROM schema.table" → "schema.table"
function extractTableFromSQL(sql) {
  const match = sql.match(/FROM\s+([\w."]+)/i);
  return match ? match[1] : "";
}

// 커스텀 SQL 여부 판단 (SELECT * FROM 단순 쿼리가 아니면 직접 SQL로 간주)
function isCustomQuery(sql) {
  return sql.trim() !== "" && !/^SELECT \* FROM/i.test(sql.trim());
}

// Hop attributes에서 적재 모드 역추론
function detectWriteMode(attrs, hopType) {
  if (hopType === "InsertUpdate") return "UPSERT";
  if (attrs.truncate === "Y")     return "OVERWRITE";
  return "INSERT";
}