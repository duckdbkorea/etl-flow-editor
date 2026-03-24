import SourceForm    from "./SourceForm";
import TransformForm from "./TransformForm";
import FilterForm    from "./FilterForm";
import TargetForm    from "./TargetForm";

// ── 공통 스타일 토큰 (하위 폼에서도 import해서 사용) ──────────────────────────
export const S = {
  // 레이블
  label: {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--color-text-secondary, #666)",
    marginBottom: 4,
    display: "block",
    fontFamily: "'IBM Plex Mono', monospace",
    letterSpacing: "0.04em",
  },
  // 텍스트 입력
  input: {
    width: "100%",
    padding: "7px 10px",
    fontSize: 12,
    fontFamily: "'IBM Plex Mono', monospace",
    border: "1px solid #ddd",
    borderRadius: 6,
    background: "#fff",
    color: "#222",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s",
  },
  // select
  select: {
    width: "100%",
    padding: "7px 10px",
    fontSize: 12,
    fontFamily: "'IBM Plex Mono', monospace",
    border: "1px solid #ddd",
    borderRadius: 6,
    background: "#fff",
    color: "#222",
    outline: "none",
    boxSizing: "border-box",
    cursor: "pointer",
  },
  // textarea
  textarea: {
    width: "100%",
    padding: "7px 10px",
    fontSize: 12,
    fontFamily: "'IBM Plex Mono', monospace",
    border: "1px solid #ddd",
    borderRadius: 6,
    background: "#fff",
    color: "#222",
    outline: "none",
    boxSizing: "border-box",
    resize: "vertical",
    minHeight: 80,
    lineHeight: 1.6,
  },
  // 폼 필드 래퍼 (수직 간격)
  field: { marginBottom: 14 },
  // 섹션 구분선 + 타이틀
  section: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "#aaa",
    margin: "16px 0 10px",
    paddingBottom: 6,
    borderBottom: "1px solid #f0ede6",
  },
  // 저장 버튼
  saveBtn: (color) => ({
    width: "100%",
    padding: "9px 0",
    background: color,
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    fontFamily: "'IBM Plex Mono', monospace",
    cursor: "pointer",
    letterSpacing: "0.04em",
    marginTop: 6,
    transition: "opacity 0.15s",
  }),
  // 삭제 버튼
  deleteBtn: {
    width: "100%",
    padding: "7px 0",
    background: "transparent",
    color: "#E24B4A",
    border: "1px solid #E24B4A",
    borderRadius: 8,
    fontSize: 11,
    fontWeight: 600,
    fontFamily: "'IBM Plex Mono', monospace",
    cursor: "pointer",
    marginTop: 6,
    transition: "background 0.15s",
  },
};

// ── 색상 맵 ──────────────────────────────────────────────────────────────────
const KIND_COLOR = {
  source:    "#3B6D11",
  transform: "#534AB7",
  filter:    "#854F0B",
  target:    "#0F6E56",
};

// ── 인스펙터 진입점 컴포넌트 ─────────────────────────────────────────────────
export default function NodeInspector({ node, onSave, onDelete, onClose }) {
  if (!node) return null;

  const accentColor = KIND_COLOR[node.type] || "#555";

  const FormComponent = {
    source:    SourceForm,
    transform: TransformForm,
    filter:    FilterForm,
    target:    TargetForm,
  }[node.type];

  return (
    <div style={{
      width: 290,
      background: "#fff",
      borderLeft: "1px solid #e8e6e0",
      display: "flex",
      flexDirection: "column",
      flexShrink: 0,
      fontFamily: "'IBM Plex Mono', monospace",
    }}>
      {/* ── 헤더 ── */}
      <div style={{
        background: accentColor,
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div>
          <span style={{
            fontSize: 9, fontWeight: 700, background: "rgba(255,255,255,0.25)",
            padding: "2px 7px", borderRadius: 4, color: "#fff",
            letterSpacing: "0.1em", textTransform: "uppercase", marginRight: 8,
          }}>{node.type}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
            {node.data.label}
          </span>
        </div>
        <button onClick={onClose} style={{
          background: "rgba(255,255,255,0.2)", border: "none",
          color: "#fff", borderRadius: 4, width: 24, height: 24,
          cursor: "pointer", fontSize: 14, lineHeight: 1,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>✕</button>
      </div>

      {/* ── 폼 영역 ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
        {FormComponent ? (
          <FormComponent
            data={node.data}
            accentColor={accentColor}
            onSave={(updated) => onSave(node.id, updated)}
            onDelete={() => onDelete(node.id)}
          />
        ) : (
          <p style={{ fontSize: 12, color: "#aaa" }}>
            이 노드 타입은 편집 패널이 없습니다.
          </p>
        )}
      </div>
    </div>
  );
}