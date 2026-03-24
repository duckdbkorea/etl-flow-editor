// src/App.jsx
import { useState, useCallback, useRef } from "react";
import ReactFlow, {
  addEdge, MiniMap, Controls, Background,
  useNodesState, useEdgesState,
  Handle, Position, getBezierPath, BaseEdge, EdgeLabelRenderer,
} from "reactflow";
import "reactflow/dist/style.css";

import NodeInspector        from "./panels/NodeInspector";
import { serialize }        from "./utils/serialize";
import { deserialize }      from "./utils/deserialize";
import { validatePipeline } from "./utils/validate";
import { useExecution }     from "./hooks/useExecution";

// ── 색상 팔레트 ───────────────────────────────────────────────────────────────
const C = {
  source:    { bg:"#EAF3DE", border:"#3B6D11", text:"#173404", badge:"#639922" },
  transform: { bg:"#EEEDFE", border:"#534AB7", text:"#26215C", badge:"#7F77DD" },
  target:    { bg:"#E1F5EE", border:"#0F6E56", text:"#04342C", badge:"#1D9E75" },
  filter:    { bg:"#FAEEDA", border:"#854F0B", text:"#412402", badge:"#BA7517" },
  running:"#378ADD", success:"#639922", error:"#E24B4A", idle:"#B4B2A9",
};

// ── 상태 점 ───────────────────────────────────────────────────────────────────
function StatusDot({ status }) {
  const color = { idle:C.idle, running:C.running, success:C.success, error:C.error }[status] || C.idle;
  return (
    <span style={{
      display:"inline-block", width:8, height:8, borderRadius:"50%",
      background:color, marginRight:6, flexShrink:0,
      animation: status==="running" ? "pulse 1.2s ease-in-out infinite" : "none",
    }}/>
  );
}

// ── 노드 공통 껍데기 ──────────────────────────────────────────────────────────
function NodeShell({ kind, label, sublabel, status, selected, children }) {
  const col = C[kind] || C.source;
  return (
    <div style={{
      background:col.bg, border:`1.5px solid ${selected ? col.badge : col.border}`,
      borderRadius:12, minWidth:210,
      fontFamily:"'IBM Plex Mono',monospace",
      boxShadow: selected ? `0 0 0 3px ${col.badge}44` : "0 2px 8px rgba(0,0,0,0.08)",
      transition:"box-shadow 0.15s, border-color 0.15s", overflow:"hidden",
    }}>
      <div style={{ background:col.border, padding:"8px 12px",
        display:"flex", alignItems:"center", gap:8 }}>
        <span style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:4,
          background:col.badge, color:"#fff", letterSpacing:"0.08em",
          textTransform:"uppercase" }}>{kind}</span>
        <span style={{ fontSize:12, fontWeight:600, color:"#fff", flex:1 }}>{label}</span>
        <StatusDot status={status}/>
      </div>
      <div style={{ padding:"10px 12px" }}>
        {sublabel && (
          <p style={{ fontSize:11, color:col.text, margin:"0 0 8px", opacity:0.7 }}>
            {sublabel}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, kind }) {
  const col = C[kind] || C.source;
  return (
    <div style={{ display:"flex", justifyContent:"space-between", padding:"3px 0",
      borderBottom:`0.5px solid ${col.border}33`, fontSize:11 }}>
      <span style={{ color:col.text, opacity:0.6 }}>{label}</span>
      <span style={{ color:col.text, fontWeight:600 }}>{value}</span>
    </div>
  );
}

function SourceNode({ data, selected }) {
  return (
    <NodeShell kind="source" label={data.label} sublabel={data.db}
      status={data.status} selected={selected}>
      <Field label="host"  value={data.host}      kind="source"/>
      <Field label="table" value={data.table}     kind="source"/>
      <Field label="rows"  value={data.rows||"—"} kind="source"/>
      <Handle type="source" position={Position.Right}
        style={{ background:C.source.badge, border:"2px solid #fff", width:12, height:12 }}/>
    </NodeShell>
  );
}

function TransformNode({ data, selected }) {
  return (
    <NodeShell kind="transform" label={data.label} sublabel={data.op}
      status={data.status} selected={selected}>
      {data.fields?.map((f, i) => (
        <Field key={i} label={f.from} value={`→ ${f.to}`} kind="transform"/>
      ))}
      <Handle type="target" position={Position.Left}
        style={{ background:C.transform.badge, border:"2px solid #fff", width:12, height:12 }}/>
      <Handle type="source" position={Position.Right}
        style={{ background:C.transform.badge, border:"2px solid #fff", width:12, height:12 }}/>
    </NodeShell>
  );
}

function FilterNode({ data, selected }) {
  return (
    <NodeShell kind="filter" label={data.label} sublabel="WHERE clause"
      status={data.status} selected={selected}>
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11,
        background:"#fff8ee", border:"0.5px solid #854F0B44",
        borderRadius:6, padding:"6px 8px", color:C.filter.text, whiteSpace:"pre-wrap" }}>
        {data.condition}
      </div>
      <Handle type="target" position={Position.Left}
        style={{ background:C.filter.badge, border:"2px solid #fff", width:12, height:12 }}/>
      <Handle type="source" position={Position.Right}
        style={{ background:C.filter.badge, border:"2px solid #fff", width:12, height:12 }}/>
    </NodeShell>
  );
}

function TargetNode({ data, selected }) {
  return (
    <NodeShell kind="target" label={data.label} sublabel={data.db}
      status={data.status} selected={selected}>
      <Field label="host"  value={data.host}  kind="target"/>
      <Field label="table" value={data.table} kind="target"/>
      <Field label="mode"  value={data.mode}  kind="target"/>
      <Handle type="target" position={Position.Left}
        style={{ background:C.target.badge, border:"2px solid #fff", width:12, height:12 }}/>
    </NodeShell>
  );
}

const nodeTypes = {
  source:SourceNode, transform:TransformNode,
  filter:FilterNode, target:TargetNode,
};

// ── 커스텀 엣지 ───────────────────────────────────────────────────────────────
function AnimatedEdge({ id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, data, markerEnd }) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  });
  const running = data?.status === "running";
  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={{
        stroke: running ? C.running : "#B4B2A9",
        strokeWidth: running ? 2.5 : 1.5,
        strokeDasharray: running ? "6 3" : "none",
        animation: running ? "dash 0.8s linear infinite" : "none",
      }}/>
      {data?.label && (
        <EdgeLabelRenderer>
          <div style={{
            position:"absolute",
            transform:`translate(-50%,-50%) translate(${labelX}px,${labelY}px)`,
            background:"#fff", border:"0.5px solid #ddd", borderRadius:4,
            fontSize:10, padding:"2px 6px",
            fontFamily:"'IBM Plex Mono',monospace", color:"#666",
            pointerEvents:"all",
          }}>{data.label}</div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const edgeTypes = { animated: AnimatedEdge };

// ── 초기 데이터 ───────────────────────────────────────────────────────────────
const initNodes = [
  { id:"src1", type:"source",    position:{x:40,  y:80},
    data:{label:"Oracle HR",   db:"Oracle 19c",   host:"ora-prod:1521",
          table:"EMPLOYEES",   rows:"48,302",      status:"idle"} },
  { id:"src2", type:"source",    position:{x:40,  y:290},
    data:{label:"MySQL CRM",   db:"MySQL 8.0",     host:"mysql-prod:3306",
          table:"customers",   rows:"120,441",     status:"idle"} },
  { id:"flt1", type:"filter",    position:{x:320, y:80},
    data:{label:"Active Only", condition:"status = 'ACTIVE'\nAND dept_id IS NOT NULL",
          status:"idle"} },
  { id:"tfm1", type:"transform", position:{x:590, y:170},
    data:{label:"Field Map",   op:"Column rename + type cast",
          fields:[
            {from:"EMPLOYEE_ID", to:"emp_id (INT)"},
            {from:"LAST_NAME",   to:"name (TEXT)"},
            {from:"HIRE_DATE",   to:"joined_at (TS)"},
          ], status:"idle"} },
  { id:"tgt1", type:"target",    position:{x:860, y:170},
    data:{label:"AgensSQL DW", db:"PostgreSQL 16", host:"agens-dw:5432",
          table:"dim_employees", mode:"UPSERT",    status:"idle"} },
];

const initEdges = [
  { id:"e1", source:"src1", target:"flt1", type:"animated",
    data:{status:"idle", label:"48k rows"}, markerEnd:{type:"arrowclosed",color:"#B4B2A9"} },
  { id:"e2", source:"src2", target:"tfm1", type:"animated",
    data:{status:"idle"},                  markerEnd:{type:"arrowclosed",color:"#B4B2A9"} },
  { id:"e3", source:"flt1", target:"tfm1", type:"animated",
    data:{status:"idle", label:"31k rows"}, markerEnd:{type:"arrowclosed",color:"#B4B2A9"} },
  { id:"e4", source:"tfm1", target:"tgt1", type:"animated",
    data:{status:"idle"},                  markerEnd:{type:"arrowclosed",color:"#B4B2A9"} },
];

// ── 팔레트 버튼 ───────────────────────────────────────────────────────────────
function PaletteItem({ kind, label, onAdd }) {
  const col = C[kind];
  return (
    <button onClick={() => onAdd(kind)} style={{
      display:"flex", alignItems:"center", gap:8, width:"100%",
      background:col.bg, border:`1px solid ${col.border}`, borderRadius:8,
      padding:"8px 12px", cursor:"pointer", marginBottom:6,
      fontFamily:"'IBM Plex Mono',monospace", fontSize:12, color:col.text,
      transition:"transform 0.1s",
    }}
      onMouseEnter={e => e.currentTarget.style.transform = "translateX(3px)"}
      onMouseLeave={e => e.currentTarget.style.transform = "translateX(0)"}
    >
      <span style={{ fontSize:9, fontWeight:700, padding:"1px 6px", borderRadius:3,
        background:col.badge, color:"#fff", letterSpacing:"0.08em",
        textTransform:"uppercase" }}>{kind}</span>
      {label}
    </button>
  );
}

// ── 로그 아이템 ───────────────────────────────────────────────────────────────
function LogItem({ time, msg, level }) {
  const color = { info:"#378ADD", warn:"#BA7517", error:"#E24B4A", ok:"#639922" }[level] || "#888";
  return (
    <div style={{ display:"flex", gap:8, fontSize:11,
      fontFamily:"'IBM Plex Mono',monospace",
      padding:"3px 0", borderBottom:"0.5px solid #f0f0f0" }}>
      <span style={{ color:"#aaa", flexShrink:0 }}>{time}</span>
      <span style={{ color, fontWeight: level==="error" ? 600 : 400 }}>{msg}</span>
    </div>
  );
}

// ── 상태 뱃지 ─────────────────────────────────────────────────────────────────
function NodeStatusBadges({ nodes }) {
  const counts = nodes.reduce((acc, n) => {
    const s = n.data.status || "idle";
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});
  const badgeColor = {
    success:"#3B6D11", running:"#185FA5", error:"#A32D2D", idle:"#5F5E5A",
  };
  return (
    <div style={{ display:"flex", gap:5 }}>
      {Object.entries(counts).map(([status, count]) => (
        <span key={status} style={{
          display:"flex", alignItems:"center", gap:4,
          padding:"3px 8px", background:"#2a2a2a",
          borderRadius:4, fontSize:11, color:"#ccc",
        }}>
          <span style={{
            width:7, height:7, borderRadius:"50%",
            background: badgeColor[status] || "#888",
            display:"inline-block",
            animation: status==="running" ? "pulse 1.2s ease-in-out infinite" : "none",
          }}/>
          {count} {status}
        </span>
      ))}
    </div>
  );
}

// ── 하단 통계 바 ──────────────────────────────────────────────────────────────
function NodeStatsBar({ nodeStats, nodes }) {
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));
  if (Object.keys(nodeStats).length === 0) return null;
  return (
    <div style={{
      background:"#1a1a1a", borderTop:"1px solid #333",
      padding:"6px 20px", display:"flex", gap:20,
      fontFamily:"'IBM Plex Mono',monospace", overflowX:"auto", flexShrink:0,
    }}>
      {Object.entries(nodeStats).map(([nodeId, stats]) => {
        const label = nodeMap[nodeId]?.data?.label || nodeId;
        return (
          <div key={nodeId} style={{
            display:"flex", alignItems:"center", gap:8,
            fontSize:11, color:"#888", flexShrink:0,
          }}>
            <span style={{ color:"#ccc", fontWeight:600 }}>{label}</span>
            <span>읽기 {stats.linesRead.toLocaleString()}</span>
            {stats.linesWritten > 0 && (
              <span>쓰기 {stats.linesWritten.toLocaleString()}</span>
            )}
            {stats.errors > 0 && (
              <span style={{ color:"#E24B4A" }}>오류 {stats.errors}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 메인 앱
// ════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges);
  const [logs,         setLogs]         = useState([
    { time:"00:00:00", msg:"ETL Flow 준비 완료. Run Pipeline을 클릭하세요.", level:"info" },
  ]);
  const [selectedNode, setSelectedNode] = useState(null);
  const counter = useRef(20);

  // ── 실행 훅 ────────────────────────────────────────────────────────────────
  const { runStatus, executionId, nodeStats, execute, stop } = useExecution({
    nodes, edges, setNodes, setLogs,
  });

  const onConnect = useCallback(params =>
    setEdges(eds => addEdge({
      ...params, type:"animated",
      data:{ status:"idle" },
      markerEnd:{ type:"arrowclosed", color:"#B4B2A9" },
    }, eds)), [setEdges]);

  // ── 노드 추가 ──────────────────────────────────────────────────────────────
  const addNode = (kind) => {
    const id = `node_${counter.current++}`;
    const defaults = {
      source:    { label:"New Source",  db:"PostgreSQL", host:"localhost:5432",
                   table:"table_name",  rows:"—",        status:"idle" },
      transform: { label:"Transform",   op:"Field mapping",
                   fields:[{from:"col_a", to:"col_b"}],  status:"idle" },
      filter:    { label:"Filter",      condition:"column = 'value'", status:"idle" },
      target:    { label:"New Target",  db:"PostgreSQL", host:"localhost:5432",
                   table:"target_table", mode:"INSERT",  status:"idle" },
    };
    setNodes(ns => [...ns, {
      id, type:kind, data:defaults[kind],
      position:{ x:200 + Math.random()*200, y:80 + Math.random()*200 },
    }]);
  };

  // ── 노드 삭제 / 저장 ───────────────────────────────────────────────────────
  const deleteNode = (nodeId) => {
    setNodes(ns => ns.filter(n => n.id !== nodeId));
    setEdges(es => es.filter(e => e.source !== nodeId && e.target !== nodeId));
    setSelectedNode(null);
  };

  const saveNode = (nodeId, updatedData) => {
    setNodes(ns => ns.map(n =>
      n.id === nodeId ? { ...n, data: updatedData } : n
    ));
  };

  // ── JSON 내보내기 / 불러오기 ───────────────────────────────────────────────
  const exportPipeline = () => {
    const { ok, errors } = validatePipeline(nodes, edges);
    if (!ok) { alert("파이프라인 오류:\n\n" + errors.join("\n")); return; }
    const hopJson = serialize(nodes, edges, "etl_pipeline");
    const blob    = new Blob([JSON.stringify(hopJson, null, 2)], { type:"application/json" });
    const url     = URL.createObjectURL(blob);
    const a       = document.createElement("a");
    a.href = url; a.download = "pipeline.json"; a.click();
    URL.revokeObjectURL(url);
    setLogs(l => [...l, {
      time:  new Date().toLocaleTimeString("ko-KR", { hour12:false }),
      msg:   "pipeline.json 내보내기 완료",
      level: "ok",
    }]);
  };

  const importPipeline = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const { nodes:ns, edges:es, name } = deserialize(JSON.parse(evt.target.result));
        setNodes(ns); setEdges(es); setSelectedNode(null);
        setLogs(l => [...l, {
          time:  new Date().toLocaleTimeString("ko-KR", { hour12:false }),
          msg:   `"${name}" 불러오기 완료 (노드 ${ns.length}개)`,
          level: "ok",
        }]);
      } catch (err) { alert("파일 오류: " + err.message); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ── 버튼 스타일 ────────────────────────────────────────────────────────────
  const btn = {
    idle:    { bg:"#3B6D11", label:"▶  Run Pipeline" },
    running: { bg:"#185FA5", label:"◌  Running…"    },
    done:    { bg:"#1D9E75", label:"✓  Run Again"   },
    error:   { bg:"#A32D2D", label:"✕  Retry"       },
  }[runStatus] || { bg:"#3B6D11", label:"▶  Run Pipeline" };

  // ════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column",
      fontFamily:"'IBM Plex Mono',monospace", background:"#f7f6f2" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes dash  { to { stroke-dashoffset: -18; } }
        .react-flow__handle { cursor: crosshair !important; }
        ::-webkit-scrollbar { width:5px; }
        ::-webkit-scrollbar-thumb { background:#ccc; border-radius:3px; }
      `}</style>

      {/* ── 상단 바 ── */}
      <div style={{ background:"#1a1a1a", color:"#fff", padding:"10px 20px",
        display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>

        <span style={{ fontSize:14, fontWeight:700, letterSpacing:"0.06em",
          marginRight:4 }}>ETL FLOW</span>

        <span style={{ fontSize:11, color:"#666" }}>|</span>

        <span style={{ fontSize:11, color:"#888", flex:1 }}>
          Oracle HR → AgensSQL DW
          {executionId && (
            <span style={{ color:"#555", marginLeft:10 }}>
              exec: {executionId.slice(0,8)}…
            </span>
          )}
        </span>

        <NodeStatusBadges nodes={nodes}/>

        {/* 내보내기 */}
        <button onClick={exportPipeline} style={{
          background:"transparent", color:"#aaa",
          border:"1px solid #444", borderRadius:5,
          padding:"5px 12px", fontSize:11, cursor:"pointer",
          fontFamily:"'IBM Plex Mono',monospace",
        }}>↓ JSON</button>

        {/* 불러오기 */}
        <label style={{
          background:"transparent", color:"#aaa",
          border:"1px solid #444", borderRadius:5,
          padding:"5px 12px", fontSize:11, cursor:"pointer",
          fontFamily:"'IBM Plex Mono',monospace",
        }}>
          ↑ JSON
          <input type="file" accept=".json"
            onChange={importPipeline} style={{ display:"none" }}/>
        </label>

        {/* 중단 버튼 */}
        {runStatus === "running" && (
          <button onClick={stop} style={{
            background:"transparent", color:"#E24B4A",
            border:"1px solid #E24B4A", borderRadius:5,
            padding:"5px 12px", fontSize:11, fontWeight:700,
            cursor:"pointer", fontFamily:"'IBM Plex Mono',monospace",
          }}>■ 중단</button>
        )}

        {/* 실행 버튼 */}
        <button onClick={execute} disabled={runStatus==="running"} style={{
          background:btn.bg, color:"#fff", border:"none", borderRadius:6,
          padding:"7px 16px", fontSize:12, fontWeight:700,
          cursor: runStatus==="running" ? "not-allowed" : "pointer",
          fontFamily:"'IBM Plex Mono',monospace", transition:"background 0.2s",
          opacity: runStatus==="running" ? 0.85 : 1,
        }}>{btn.label}</button>
      </div>

      {/* ── 메인 영역 ── */}
      <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

        {/* 좌측 팔레트 */}
        <div style={{ width:185, background:"#fff",
          borderRight:"1px solid #e8e6e0",
          padding:14, overflowY:"auto", flexShrink:0 }}>
          <p style={{ fontSize:9, fontWeight:700, color:"#bbb",
            letterSpacing:"0.1em", textTransform:"uppercase",
            margin:"0 0 10px" }}>노드 추가</p>
          <PaletteItem kind="source"    label="Source DB"  onAdd={addNode}/>
          <PaletteItem kind="transform" label="Transform"  onAdd={addNode}/>
          <PaletteItem kind="filter"    label="Filter"     onAdd={addNode}/>
          <PaletteItem kind="target"    label="Target DB"  onAdd={addNode}/>

          <div style={{ marginTop:18, padding:10,
            background:"#f7f6f2", borderRadius:8 }}>
            <p style={{ fontSize:9, fontWeight:700, color:"#bbb",
              letterSpacing:"0.1em", textTransform:"uppercase",
              margin:"0 0 6px" }}>사용법</p>
            <p style={{ fontSize:10, color:"#999", lineHeight:1.7, margin:0 }}>
              노드 핸들을 드래그해서 연결하세요.<br/>
              노드 클릭 → 우측 설정 패널<br/>
              빈 공간 클릭 → 패널 닫기
            </p>
          </div>
        </div>

        {/* 캔버스 */}
        <div style={{ flex:1, position:"relative" }}>
          <ReactFlow
            nodes={nodes} edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodeClick={(_, node) => setSelectedNode(node)}
            onPaneClick={() => setSelectedNode(null)}
            fitView fitViewOptions={{ padding:0.2 }}
          >
            <Background color="#d8d5cc" gap={24} size={1}/>
            <Controls/>
            <MiniMap
              nodeColor={n => {
                const k = n.type;
                return k==="source"    ? C.source.badge
                     : k==="transform" ? C.transform.badge
                     : k==="filter"    ? C.filter.badge
                     : C.target.badge;
              }}
              maskColor="rgba(247,246,242,0.7)"
              style={{ background:"#fff", border:"1px solid #e0ddd6", borderRadius:8 }}
            />
          </ReactFlow>
        </div>

        {/* 우측: 로그 패널 (인스펙터가 없을 때) */}
        {!selectedNode && (
          <div style={{ width:270, background:"#fff",
            borderLeft:"1px solid #e8e6e0",
            display:"flex", flexDirection:"column", flexShrink:0 }}>
            <div style={{ padding:"10px 14px", borderBottom:"1px solid #e8e6e0",
              display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <span style={{ fontSize:9, fontWeight:700, color:"#bbb",
                letterSpacing:"0.1em", textTransform:"uppercase" }}>실행 로그</span>
              {logs.length > 1 && (
                <button onClick={() => setLogs(l => [l[0]])} style={{
                  background:"transparent", border:"none",
                  fontSize:10, color:"#ccc", cursor:"pointer",
                  fontFamily:"'IBM Plex Mono',monospace",
                }}>clear</button>
              )}
            </div>
            <div style={{ flex:1, overflowY:"auto", padding:"8px 14px" }}>
              {logs.map((l, i) => <LogItem key={i} {...l}/>)}
            </div>
          </div>
        )}

        {/* 우측: 노드 인스펙터 패널 */}
        {selectedNode && (
          <NodeInspector
            key={selectedNode.id}
            node={selectedNode}
            onSave={(nodeId, updatedData) => {
              saveNode(nodeId, updatedData);
              setSelectedNode(prev =>
                prev ? { ...prev, data: updatedData } : null
              );
            }}
            onDelete={deleteNode}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>

      {/* ── 하단 통계 바 ── */}
      <NodeStatsBar nodeStats={nodeStats} nodes={nodes}/>
    </div>
  );
}