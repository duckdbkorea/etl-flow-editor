import { useState } from "react";
import { S } from "./NodeInspector";

const TYPE_OPTIONS = ["TEXT", "INT", "BIGINT", "FLOAT", "BOOLEAN", "DATE", "TIMESTAMP", "JSON"];

export default function TransformForm({ data, accentColor, onSave, onDelete }) {
  const [label, setLabel] = useState(data.label || "");
  const [op, setOp]       = useState(data.op    || "Column rename + type cast");
  const [fields, setFields] = useState(
    data.fields?.length ? data.fields : [{ from: "", to: "", type: "TEXT" }]
  );

  // 행 추가
  const addRow = () => setFields(f => [...f, { from: "", to: "", type: "TEXT" }]);

  // 행 삭제
  const removeRow = (i) => setFields(f => f.filter((_, idx) => idx !== i));

  // 셀 편집
  const setCell = (i, key) => (e) =>
    setFields(f => f.map((row, idx) => idx === i ? { ...row, [key]: e.target.value } : row));

  const handleSave = () => onSave({ ...data, label, op, fields });

  return (
    <>
      <p style={S.section}>기본 정보</p>

      <div style={S.field}>
        <label style={S.label}>노드 이름</label>
        <input style={S.input} value={label} onChange={e => setLabel(e.target.value)}
          placeholder="Field Mapping"
          onFocus={e => e.target.style.borderColor = accentColor}
          onBlur={e => e.target.style.borderColor = "#ddd"}/>
      </div>

      <div style={S.field}>
        <label style={S.label}>변환 설명</label>
        <input style={S.input} value={op} onChange={e => setOp(e.target.value)}
          placeholder="Column rename + type cast"
          onFocus={e => e.target.style.borderColor = accentColor}
          onBlur={e => e.target.style.borderColor = "#ddd"}/>
      </div>

      {/* 컬럼 매핑 테이블 */}
      <p style={S.section}>컬럼 매핑</p>

      {/* 헤더 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px 28px",
        gap: 4, marginBottom: 6 }}>
        {["소스 컬럼", "타깃 컬럼", "타입", ""].map((h, i) => (
          <span key={i} style={{ fontSize: 10, color: "#aaa", fontWeight: 600,
            fontFamily: "'IBM Plex Mono',monospace", letterSpacing: "0.04em" }}>{h}</span>
        ))}
      </div>

      {/* 매핑 행들 */}
      {fields.map((row, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px 28px",
          gap: 4, marginBottom: 5, alignItems: "center" }}>
          <input style={{ ...S.input, padding: "5px 7px" }}
            value={row.from} onChange={setCell(i, "from")} placeholder="src_col"
            onFocus={e => e.target.style.borderColor = accentColor}
            onBlur={e => e.target.style.borderColor = "#ddd"}/>
          <input style={{ ...S.input, padding: "5px 7px" }}
            value={row.to} onChange={setCell(i, "to")} placeholder="dst_col"
            onFocus={e => e.target.style.borderColor = accentColor}
            onBlur={e => e.target.style.borderColor = "#ddd"}/>
          <select style={{ ...S.select, padding: "5px 4px", fontSize: 11 }}
            value={row.type} onChange={setCell(i, "type")}>
            {TYPE_OPTIONS.map(t => <option key={t}>{t}</option>)}
          </select>
          <button onClick={() => removeRow(i)} style={{
            background: "transparent", border: "1px solid #eee",
            borderRadius: 4, color: "#ccc", cursor: "pointer",
            fontSize: 14, width: 28, height: 28, padding: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "color 0.1s, border-color 0.1s",
          }}
            onMouseEnter={e => { e.currentTarget.style.color="#E24B4A"; e.currentTarget.style.borderColor="#E24B4A"; }}
            onMouseLeave={e => { e.currentTarget.style.color="#ccc"; e.currentTarget.style.borderColor="#eee"; }}>
            ✕
          </button>
        </div>
      ))}

      <button onClick={addRow} style={{
        width: "100%", padding: "6px 0", background: "transparent",
        border: `1px dashed ${accentColor}`, borderRadius: 6,
        color: accentColor, fontSize: 11, fontWeight: 600,
        fontFamily: "'IBM Plex Mono',monospace", cursor: "pointer",
        marginTop: 4, transition: "background 0.15s",
      }}
        onMouseEnter={e => e.currentTarget.style.background = "#EEEDFE"}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
        + 행 추가
      </button>

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