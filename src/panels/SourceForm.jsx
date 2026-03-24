import { useState } from "react";
import { S } from "./NodeInspector";

const DB_TYPES = ["PostgreSQL", "AgensSQL", "Oracle", "MySQL", "MariaDB", "MSSQL", "DuckDB"];

export default function SourceForm({ data, accentColor, onSave, onDelete }) {
  const [form, setForm] = useState({
    label:    data.label    || "",
    db:       data.db       || "PostgreSQL",
    host:     data.host     || "localhost",
    port:     data.port     || "5432",
    database: data.database || "",
    username: data.username || "",
    password: data.password || "",
    table:    data.table    || "",
    query:    data.query    || "",
    useQuery: data.useQuery || false,
  });

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));
  const toggle = (key) => () => setForm(f => ({ ...f, [key]: !f[key] }));

  // 포트 자동 설정
  const handleDbType = (e) => {
    const db = e.target.value;
    const portMap = {
      PostgreSQL: "5432", AgensSQL: "5432", Oracle: "1521",
      MySQL: "3306", MariaDB: "3306", MSSQL: "1433", DuckDB: "",
    };
    setForm(f => ({ ...f, db, port: portMap[db] || f.port }));
  };

  const handleSave = () => onSave({ ...data, ...form });

  return (
    <>
      {/* 기본 정보 */}
      <p style={S.section}>기본 정보</p>

      <div style={S.field}>
        <label style={S.label}>노드 이름</label>
        <input style={S.input} value={form.label} onChange={set("label")}
          placeholder="예: Oracle HR Source"
          onFocus={e => e.target.style.borderColor = accentColor}
          onBlur={e => e.target.style.borderColor = "#ddd"}/>
      </div>

      <div style={S.field}>
        <label style={S.label}>DB 종류</label>
        <select style={S.select} value={form.db} onChange={handleDbType}>
          {DB_TYPES.map(d => <option key={d}>{d}</option>)}
        </select>
      </div>

      {/* 연결 정보 */}
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
            placeholder="5432"
            onFocus={e => e.target.style.borderColor = accentColor}
            onBlur={e => e.target.style.borderColor = "#ddd"}/>
        </div>
      </div>

      <div style={S.field}>
        <label style={S.label}>Database</label>
        <input style={S.input} value={form.database} onChange={set("database")}
          placeholder="database_name"
          onFocus={e => e.target.style.borderColor = accentColor}
          onBlur={e => e.target.style.borderColor = "#ddd"}/>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, ...S.field }}>
        <div>
          <label style={S.label}>Username</label>
          <input style={S.input} value={form.username} onChange={set("username")}
            placeholder="user"
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

      {/* 데이터 소스 */}
      <p style={S.section}>데이터 소스</p>

      {/* 테이블 / 직접 쿼리 전환 토글 */}
      <div style={{ display: "flex", gap: 0, marginBottom: 12,
        border: "1px solid #ddd", borderRadius: 6, overflow: "hidden" }}>
        {["테이블", "직접 SQL"].map((label, i) => {
          const active = form.useQuery === (i === 1);
          return (
            <button key={label} onClick={() => setForm(f => ({ ...f, useQuery: i === 1 }))} style={{
              flex: 1, padding: "6px 0", fontSize: 11, fontWeight: active ? 700 : 400,
              background: active ? accentColor : "#fff",
              color: active ? "#fff" : "#888",
              border: "none", cursor: "pointer",
              fontFamily: "'IBM Plex Mono', monospace",
              transition: "background 0.15s, color 0.15s",
            }}>{label}</button>
          );
        })}
      </div>

      {!form.useQuery ? (
        <div style={S.field}>
          <label style={S.label}>Table / View</label>
          <input style={S.input} value={form.table} onChange={set("table")}
            placeholder="schema.table_name"
            onFocus={e => e.target.style.borderColor = accentColor}
            onBlur={e => e.target.style.borderColor = "#ddd"}/>
        </div>
      ) : (
        <div style={S.field}>
          <label style={S.label}>SQL Query</label>
          <textarea style={S.textarea} value={form.query} onChange={set("query")}
            placeholder={"SELECT id, name, created_at\nFROM employees\nWHERE active = 1"}
            onFocus={e => e.target.style.borderColor = accentColor}
            onBlur={e => e.target.style.borderColor = "#ddd"}/>
        </div>
      )}

      {/* 액션 버튼 */}
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