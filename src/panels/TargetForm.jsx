import { useState } from "react";
import { S } from "./NodeInspector";

const WRITE_MODES = [
  { value: "INSERT",       label: "INSERT — 신규 행만 추가" },
  { value: "UPSERT",       label: "UPSERT — 있으면 갱신, 없으면 추가" },
  { value: "OVERWRITE",    label: "OVERWRITE — 테이블 전체 교체" },
  { value: "APPEND",       label: "APPEND — 기존 데이터 유지하며 추가" },
  { value: "TRUNCATE_INSERT", label: "TRUNCATE + INSERT" },
];

const DB_TYPES = ["PostgreSQL", "AgensSQL", "MySQL", "MariaDB", "MSSQL", "DuckDB", "Parquet", "CSV"];

export default function TargetForm({ data, accentColor, onSave, onDelete }) {
  const [form, setForm] = useState({
    label:      data.label      || "",
    db:         data.db         || "AgensSQL",
    host:       data.host       || "localhost",
    port:       data.port       || "5432",
    database:   data.database   || "",
    username:   data.username   || "",
    password:   data.password   || "",
    table:      data.table      || "",
    schema:     data.schema     || "public",
    mode:       data.mode       || "UPSERT",
    upsertKey:  data.upsertKey  || "",
    batchSize:  data.batchSize  || "1000",
    createTable:data.createTable|| false,
  });

  const set = (key) => (e) =>
    setForm(f => ({ ...f, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const handleDbType = (e) => {
    const db = e.target.value;
    const portMap = { PostgreSQL:"5432", AgensSQL:"5432", MySQL:"3306", MariaDB:"3306", MSSQL:"1433", DuckDB:"", Parquet:"", CSV:"" };
    setForm(f => ({ ...f, db, port: portMap[db] ?? f.port }));
  };

  const handleSave = () => onSave({ ...data, ...form });

  const needsConnection = !["Parquet","CSV"].includes(form.db);

  return (
    <>
      <p style={S.section}>기본 정보</p>

      <div style={S.field}>
        <label style={S.label}>노드 이름</label>
        <input style={S.input} value={form.label} onChange={set("label")}
          placeholder="AgensSQL DW"
          onFocus={e => e.target.style.borderColor = accentColor}
          onBlur={e => e.target.style.borderColor = "#ddd"}/>
      </div>

      <div style={S.field}>
        <label style={S.label}>대상 DB / 포맷</label>
        <select style={S.select} value={form.db} onChange={handleDbType}>
          {DB_TYPES.map(d => <option key={d}>{d}</option>)}
        </select>
      </div>

      {/* DB 연결 정보 (파일 포맷이면 숨김) */}
      {needsConnection && (
        <>
          <p style={S.section}>연결 정보</p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 90px", gap: 8, ...S.field }}>
            <div>
              <label style={S.label}>Host</label>
              <input style={S.input} value={form.host} onChange={set("host")}
                placeholder="localhost"
                onFocus={e => e.target.style.borderColor = accentColor}
                onBlur={e => e.target.style.borderColor = "#ddd"}/>
            </div>
            <div>
              <label style={S.label}>Port</label>
              <input style={S.input} value={form.port} onChange={set("port")}
                onFocus={e => e.target.style.borderColor = accentColor}
                onBlur={e => e.target.style.borderColor = "#ddd"}/>
            </div>
          </div>

          <div style={S.field}>
            <label style={S.label}>Database</label>
            <input style={S.input} value={form.database} onChange={set("database")}
              placeholder="target_db"
              onFocus={e => e.target.style.borderColor = accentColor}
              onBlur={e => e.target.style.borderColor = "#ddd"}/>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, ...S.field }}>
            <div>
              <label style={S.label}>Username</label>
              <input style={S.input} value={form.username} onChange={set("username")}
                onFocus={e => e.target.style.borderColor = accentColor}
                onBlur={e => e.target.style.borderColor = "#ddd"}/>
            </div>
            <div>
              <label style={S.label}>Password</label>
              <input style={S.input} type="password" value={form.password} onChange={set("password")}
                placeholder="••••••••"
                onFocus={e => e.target.style.borderColor = accentColor}
                onBlur={e => e.target.style.borderColor = "#ddd"}/>
            </div>
          </div>
        </>
      )}

      {/* 적재 설정 */}
      <p style={S.section}>적재 설정</p>

      <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 8, ...S.field }}>
        <div>
          <label style={S.label}>Schema</label>
          <input style={S.input} value={form.schema} onChange={set("schema")}
            placeholder="public"
            onFocus={e => e.target.style.borderColor = accentColor}
            onBlur={e => e.target.style.borderColor = "#ddd"}/>
        </div>
        <div>
          <label style={S.label}>Table</label>
          <input style={S.input} value={form.table} onChange={set("table")}
            placeholder="dim_employees"
            onFocus={e => e.target.style.borderColor = accentColor}
            onBlur={e => e.target.style.borderColor = "#ddd"}/>
        </div>
      </div>

      <div style={S.field}>
        <label style={S.label}>적재 모드</label>
        <select style={S.select} value={form.mode} onChange={set("mode")}>
          {WRITE_MODES.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* UPSERT일 때만 키 컬럼 표시 */}
      {form.mode === "UPSERT" && (
        <div style={S.field}>
          <label style={S.label}>Upsert Key 컬럼 (콤마 구분)</label>
          <input style={S.input} value={form.upsertKey} onChange={set("upsertKey")}
            placeholder="id, employee_no"
            onFocus={e => e.target.style.borderColor = accentColor}
            onBlur={e => e.target.style.borderColor = "#ddd"}/>
        </div>
      )}

      <div style={S.field}>
        <label style={S.label}>Batch Size</label>
        <input style={S.input} type="number" value={form.batchSize} onChange={set("batchSize")}
          min="100" max="100000" step="100"
          onFocus={e => e.target.style.borderColor = accentColor}
          onBlur={e => e.target.style.borderColor = "#ddd"}/>
      </div>

      {/* 테이블 자동 생성 옵션 */}
      <label style={{ display: "flex", alignItems: "center", gap: 8,
        fontSize: 12, color: "#555", cursor: "pointer", marginBottom: 16,
        fontFamily: "'IBM Plex Mono',monospace" }}>
        <input type="checkbox" checked={form.createTable} onChange={set("createTable")}
          style={{ accentColor, width: 14, height: 14 }}/>
        테이블이 없으면 자동 생성 (CREATE TABLE IF NOT EXISTS)
      </label>

      <button style={S.saveBtn(accentColor)} onClick={handleSave}
        onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
        onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
        저장
      </button>
      <button style={S.deleteBtn} onClick={onDelete}
        onMouseEnter={e => { e.currentTarget.style.background="#FEE2E2"; }}
        onMouseLeave={e => { e.currentTarget.style.background="transparent"; }}>
        이 노드 삭제
      </button>
    </>
  );
}