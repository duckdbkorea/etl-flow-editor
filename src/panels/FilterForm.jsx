import { useState } from "react";
import { S } from "./NodeInspector";

const PRESETS = [
  { label: "활성 상태만", sql: "status = 'ACTIVE'" },
  { label: "NULL 제외",   sql: "col IS NOT NULL" },
  { label: "날짜 범위",   sql: "created_at BETWEEN '2024-01-01' AND '2024-12-31'" },
  { label: "중복 제거",   sql: "id IN (SELECT MIN(id) FROM t GROUP BY key_col)" },
];

export default function FilterForm({ data, accentColor, onSave, onDelete }) {
  const [label,     setLabel]     = useState(data.label     || "");
  const [condition, setCondition] = useState(data.condition || "");
  const [passLabel, setPassLabel] = useState(data.passLabel || "PASS");
  const [failLabel, setFailLabel] = useState(data.failLabel || "FAIL");

  const applyPreset = (sql) => setCondition(prev => prev ? prev + "\nAND " + sql : sql);

  const handleSave = () => onSave({ ...data, label, condition, passLabel, failLabel });

  return (
    <>
      <p style={S.section}>기본 정보</p>

      <div style={S.field}>
        <label style={S.label}>노드 이름</label>
        <input style={S.input} value={label} onChange={e => setLabel(e.target.value)}
          placeholder="Active Users Filter"
          onFocus={e => e.target.style.borderColor = accentColor}
          onBlur={e => e.target.style.borderColor = "#ddd"}/>
      </div>

      {/* 프리셋 빠른 적용 */}
      <p style={S.section}>프리셋 조건</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
        {PRESETS.map(p => (
          <button key={p.label} onClick={() => applyPreset(p.sql)} style={{
            fontSize: 10, padding: "4px 9px",
            background: "#f7f6f2", border: "1px solid #ddd",
            borderRadius: 5, cursor: "pointer", color: "#555",
            fontFamily: "'IBM Plex Mono',monospace",
            transition: "border-color 0.1s, color 0.1s",
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = accentColor; e.currentTarget.style.color = accentColor; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#ddd"; e.currentTarget.style.color = "#555"; }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* WHERE 조건 */}
      <p style={S.section}>WHERE 조건</p>
      <div style={S.field}>
        <label style={S.label}>SQL WHERE 절 (WHERE 키워드 제외)</label>
        <textarea style={{ ...S.textarea, minHeight: 100,
          background: "#fffbf5", borderColor: "#ddd", fontWeight: 500 }}
          value={condition} onChange={e => setCondition(e.target.value)}
          placeholder={"status = 'ACTIVE'\nAND dept_id IS NOT NULL"}
          onFocus={e => e.target.style.borderColor = accentColor}
          onBlur={e => e.target.style.borderColor = "#ddd"}/>
      </div>

      {/* 출력 레이블 */}
      <p style={S.section}>출력 포트 레이블</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, ...S.field }}>
        <div>
          <label style={{ ...S.label, color: "#3B6D11" }}>조건 통과 (PASS)</label>
          <input style={{ ...S.input, borderColor: "#3B6D1166" }}
            value={passLabel} onChange={e => setPassLabel(e.target.value)}
            onFocus={e => e.target.style.borderColor = "#3B6D11"}
            onBlur={e => e.target.style.borderColor = "#3B6D1166"}/>
        </div>
        <div>
          <label style={{ ...S.label, color: "#E24B4A" }}>조건 실패 (FAIL)</label>
          <input style={{ ...S.input, borderColor: "#E24B4A66" }}
            value={failLabel} onChange={e => setFailLabel(e.target.value)}
            onFocus={e => e.target.style.borderColor = "#E24B4A"}
            onBlur={e => e.target.style.borderColor = "#E24B4A66"}/>
        </div>
      </div>

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