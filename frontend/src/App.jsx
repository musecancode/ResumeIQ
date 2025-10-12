import React, { useState, useEffect, useRef } from "react";
const API = import.meta.env.VITE_API_BASE || "http://localhost:8000";

const S = {
  page: { fontFamily: "Inter, Arial, sans-serif", padding: 24, maxWidth: 1100, margin: "0 auto" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  brand: { fontSize: 20, fontWeight: 700 },
  tabs: { display: "flex", gap: 8 },
  tabBtn: isActive => ({ padding: "8px 12px", borderRadius: 8, cursor: "pointer", background: isActive ? "#0f172a" : "#eef2ff", color: isActive ? "#fff" : "#0f172a", border: "none" }),
  container: { display: "flex", gap: 24 },
  left: { flex: 1 },
  uploadBox: { border: "2px dashed #e6e6e6", padding: 28, borderRadius: 12, textAlign: "center", cursor: "pointer", transition: "background .15s" },
  uploadBoxHover: { background: "#f8fafc" },
  hiddenInput: { display: "none" },
  card: { background: "#fff", padding: 18, borderRadius: 12, boxShadow: "0 6px 18px rgba(15,23,42,0.06)", marginBottom: 12 },
  label: { fontSize: 12, color: "#64748b", marginBottom: 6 },
  chips: { display: "flex", gap: 8, flexWrap: "wrap" },
  chip: { background: "#eef2ff", padding: "6px 8px", borderRadius: 999, fontSize: 13 },
  scoreBubble: { width: 88, height: 88, borderRadius: 999, background: "linear-gradient(135deg,#0ea5e9,#7c3aed)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, boxShadow: "0 8px 24px rgba(124,58,237,0.18)" },
  historyTable: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: 10, borderBottom: "1px solid #e6e6e6" },
  td: { padding: 10, borderBottom: "1px solid #f3f4f6" },
  modal: { position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(2,6,23,0.5)", zIndex: 60 },
  modalCard: { width: 920, maxHeight: "86vh", overflow: "auto", background: "#fff", padding: 20, borderRadius: 12 },
  fadeError: { position: "fixed", top: 20, right: 20, background: "#fee2e2", color: "#991b1b", padding: "8px 12px", borderRadius: 8, boxShadow: "0 6px 18px rgba(0,0,0,0.06)" }
};

function parseJsonFromLLM(raw) {
  if (!raw) return null;
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    return JSON.parse(m[0]);
  } catch (e) {
    return null;
  }
}

function extractLinks(raw) {
  if (!raw) return [];
  try {
    const matches = Array.from(raw.matchAll(/https?:\/\/[^\s,\)\]]+/g));
    return Array.from(new Set(matches.map(m => m[0])));
  } catch (e) {
    return [];
  }
}

function formatDate(s) {
  if (!s) return "-";
  try { return new Date(s).toLocaleString(); } catch (e) { return String(s); }
}

function normalizeRowForFrontend(r) {
  return {
    id: r.id,
    filename: r.file_name || r.filename || r.file || r.fileName || "-",
    name: r.name || r.display_name || r.displayName || null,
    email: r.email || null,
    phone: r.phone || null,
    uploaded_at: r.uploaded_at || r.uploadedAt || r.created_at || null,
    resume_rating: r.resume_rating ?? r.resumeRating ?? null,
    llm_raw: r.llm_raw || r.llm || null,
    raw_row: r
  };
}

function ResultCard({ data, onClose, closeToHistory }) {
  if (!data) return null;
  const llmParsed = parseJsonFromLLM(data.llm_raw);
  const source = llmParsed || data.raw_row || {};
  const name = source.name || source.display_name || data.name || "Unknown";
  const title = source.title || source.role || source.current_title || "-";
  const email = source.email || data.email || "-";
  const phone = source.phone || data.phone || "-";
  const score = (source.resume_rating ?? data.resume_rating) ?? Math.min(9, Math.max(5, Math.round(((source.technical_skills || source.core_skills || []).length || 0) / 3) + 5));
  const links = extractLinks(data.llm_raw || "").slice(0, 4);

  return (
    <div style={S.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{name}</div>
            <div style={{ color: "#64748b" }}>{title}</div>
          </div>
          <div style={{ marginTop: 8, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ fontSize: 13, color: "#334155" }}>{email}</div>
            <div style={{ fontSize: 13, color: "#334155" }}>{phone}</div>
            {links.map((l, i) => <a key={i} href={l} target="_blank" rel="noreferrer" style={{ color: "#0ea5e9", fontSize: 13 }}>{l.replace(/^https?:\/\//, "").slice(0, 36)}</a>)}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={S.scoreBubble}>{score}</div>
          <button onClick={() => { onClose(); if (closeToHistory) closeToHistory(); }} style={{ background: "#fff", border: "1px solid #e6e6e6", padding: "6px 10px", borderRadius: 8 }}>Close</button>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div style={S.label}>Education</div>
            {(source.education || []).length ? (source.education || []).map((e, i) => <div key={i} style={{ marginBottom: 8 }}><div style={{ fontWeight: 700 }}>{e.institution || e.degree || "-"}</div><div style={{ color: "#64748b" }}>{(e.start || "") + (e.end ? ` — ${e.end}` : "")}</div></div>) : <div style={{ color: "#94a3b8" }}>No education parsed</div>}
          </div>
          <div>
            <div style={S.label}>Summary</div>
            <div style={{ color: "#334155" }}>{source.summary || "-"}</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <div style={S.label}>Technical skills</div>
          <div style={S.chips}>{(source.technical_skills || source.technicalSkills || source.core_skills || []).slice(0, 30).map((s, i) => <div key={i} style={S.chip}>{s}</div>)}</div>
        </div>
        <div>
          <div style={S.label}>Soft skills</div>
          <div style={S.chips}>{(source.soft_skills || source.softSkills || []).map((s, i) => <div key={i} style={S.chip}>{s}</div>)}</div>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={S.label}>Experience</div>
        {(source.work_experience || source.experience || []).length ? (source.work_experience || source.experience).map((exp, idx) => (
          <div key={idx} style={{ marginBottom: 8 }}>
            <div style={{ fontWeight: 700 }}>{exp.role || exp.title || exp.company || "-"}</div>
            <div style={{ color: "#64748b" }}>{exp.duration || (exp.start ? `${exp.start} — ${exp.end || ""}` : "")}</div>
            <div style={{ marginTop: 6 }}>{(exp.description || exp.bullets || []).map((b, i) => <div key={i} style={{ fontSize: 13, color: "#334155" }}>• {b}</div>)}</div>
          </div>
        )) : <div style={{ color: "#94a3b8" }}>No experience parsed</div>}
      </div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <div style={S.label}>Projects</div>
          {(source.projects || []).length ? (source.projects || []).map((p, i) => <div key={i}><div style={{ fontWeight: 700 }}>{p.name}</div><div style={{ color: "#334155" }}>{p.description}</div></div>) : <div style={{ color: "#94a3b8" }}>None</div>}
        </div>
        <div>
          <div style={S.label}>Improvement</div>
          <div style={{ color: "#334155" }}>{source.improvement_areas || "-"}</div>
        </div>
      </div>
    </div>
  );
}

function UploadPane({ onResult, showError }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef();

  const onDrop = async e => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  };
  
  const onClickBox = e => {
    if (e.target === e.currentTarget) {
      inputRef.current?.click();
    }
  };

  const onSubmit = async e => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!file) { 
      showError(); 
      return; 
    }
    
    if (loading) return; // Prevent multiple uploads
    
    setLoading(true);
    const fd = new FormData();
    fd.append("file", file);
    
    try {
      const r = await fetch(API + "/upload", { method: "POST", body: fd });
      if (!r.ok) { 
        throw new Error("Upload failed");
      }
      const j = await r.json();
      setFile(null); // Reset file after successful upload
      onResult(j);
    } catch (e) {
      showError("Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={S.card}>
      <div role="button" tabIndex={0} style={{ ...S.uploadBox, ...(drag ? S.uploadBoxHover : {}) }}
           onDrop={onDrop} onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onClick={onClickBox}>
        <div style={{ fontWeight: 700 }}>Click or drag & drop a PDF to parse</div>
        <input ref={inputRef} style={S.hiddenInput} type="file" accept="application/pdf" onChange={e => setFile(e.target.files?.[0])} />
        <div style={{ marginTop: 12 }}>{file ? file.name : "No file chosen"}</div>
        <div style={{ marginTop: 12 }}>
          <button onClick={onSubmit} disabled={loading} style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: "#0f172a", color: "#fff", cursor: loading ? "not-allowed" : "pointer" }}>
            {loading ? "Uploading..." : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}

function HistoryPane({ openDetails }) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    let mounted = true;
    fetch(API + "/resumes")
      .then(r => r.json())
      .then(list => { if (!mounted) return; setRows(list.map(normalizeRowForFrontend)); });
    return () => mounted = false;
  }, []);
  return (
    <div style={S.card}>
      <table style={S.historyTable}>
        <thead>
          <tr>
            <th style={S.th}>File</th>
            <th style={S.th}>Name</th>
            <th style={S.th}>Email</th>
            <th style={S.th}>Uploaded</th>
            <th style={S.th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td style={S.td}>{r.filename}</td>
              <td style={S.td}>{r.name || "-"}</td>
              <td style={S.td}>{r.email || "-"}</td>
              <td style={S.td}>{formatDate(r.uploaded_at)}</td>
              <td style={S.td}><button onClick={() => openDetails(r.id)} style={{ padding: "6px 10px", borderRadius: 8 }}>Details</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("upload");
  const [result, setResult] = useState(null);
  const [modal, setModal] = useState(null);
  const [error, setError] = useState(null);

  const openDetails = async id => {
    const r = await fetch(API + `/resumes/${id}`);
    if (!r.ok) return;
    const j = await r.json();
    setModal(normalizeRowForFrontend(j));
  };

  const showError = (msg = "No file selected") => {
    setError(msg);
    setTimeout(() => setError(null), 2000);
  };

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={S.brand}>Resume Studio</div>
        <div style={S.tabs}>
          <button style={S.tabBtn(tab === "upload")} onClick={() => setTab("upload")}>Upload</button>
          <button style={S.tabBtn(tab === "history")} onClick={() => setTab("history")}>History</button>
        </div>
      </div>

      <div style={S.container}>
        <div style={S.left}>
          {tab === "upload" && <UploadPane onResult={d => setResult(normalizeRowForFrontend(d))} showError={showError} />}
          {result && <ResultCard data={result} onClose={() => { setResult(null); }} closeToHistory={() => setTab("history")} />}
          {tab === "history" && <HistoryPane openDetails={openDetails} />}
        </div>
      </div>

      {modal && (
        <div style={S.modal} onClick={() => setModal(null)}>
          <div style={S.modalCard} onClick={e => e.stopPropagation()}>
            <ResultCard data={modal} onClose={() => setModal(null)} />
          </div>
        </div>
      )}

      {error && <div style={S.fadeError}>{error}</div>}
    </div>
  );
}
