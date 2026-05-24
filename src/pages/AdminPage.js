import React, { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, updateDoc, doc, orderBy, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function AdminPage() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pending");

  useEffect(() => {
    if (!isAdmin) { navigate("/feed"); return; }
    const q = query(
      collection(db, "reports"),
      where("status", "==", tab),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, async snap => {
      const raw = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Enrich with project name
      const enriched = await Promise.all(raw.map(async r => {
        if (r.projectId) {
          const pSnap = await getDoc(doc(db, "projects", r.projectId));
          return { ...r, projectName: pSnap.exists() ? pSnap.data().name : r.projectId };
        }
        return r;
      }));
      setReports(enriched);
      setLoading(false);
    });
    return unsub;
  }, [isAdmin, tab, navigate]);

  async function handleApprove(reportId) {
    await updateDoc(doc(db, "reports", reportId), { status: "approved", reviewedBy: user.uid, reviewedAt: new Date() });
  }

  async function handleDismiss(reportId) {
    await updateDoc(doc(db, "reports", reportId), { status: "dismissed", reviewedBy: user.uid, reviewedAt: new Date() });
  }

  async function handleWarnProject(reportId, projectId) {
    await updateDoc(doc(db, "projects", projectId), { adminStatus: "warned" });
    await updateDoc(doc(db, "reports", reportId), { status: "warned", reviewedBy: user.uid, reviewedAt: new Date() });
  }

  async function handleRemoveProject(reportId, projectId) {
    if (!window.confirm("Remove this project from public feed?")) return;
    await updateDoc(doc(db, "projects", projectId), { isPublic: false, adminStatus: "removed" });
    await updateDoc(doc(db, "reports", reportId), { status: "removed", reviewedBy: user.uid, reviewedAt: new Date() });
  }

  if (!isAdmin) return null;

  const formatDate = (ts) => {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="main" style={{ maxWidth: 720 }}>
      <div className="page-header">
        <h1 className="page-title">admin</h1>
        <p className="page-sub">Moderation queue</p>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === "pending" ? "active" : ""}`} onClick={() => setTab("pending")}>
          pending {tab === "pending" && reports.length > 0 && `(${reports.length})`}
        </button>
        <button className={`tab ${tab === "warned" ? "active" : ""}`} onClick={() => setTab("warned")}>warned</button>
        <button className={`tab ${tab === "removed" ? "active" : ""}`} onClick={() => setTab("removed")}>removed</button>
        <button className={`tab ${tab === "dismissed" ? "active" : ""}`} onClick={() => setTab("dismissed")}>dismissed</button>
      </div>

      {loading ? (
        <div className="loading-spinner">loading reports…</div>
      ) : reports.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 28 }}>✓</div>
          <p>No {tab} reports.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {reports.map(r => (
            <div key={r.id} className="card">
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span className="report-badge">⚑ {r.type}</span>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-faint)" }}>{formatDate(r.createdAt)}</span>
                  </div>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{r.projectName || r.projectId}</div>
                  <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 2, fontFamily: "var(--mono)" }}>
                    reported by: {r.reportedBy?.slice(0, 12)}…
                    {r.logId && ` · log: ${r.logId?.slice(0, 8)}…`}
                  </div>
                </div>
                {tab === "pending" && (
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button onClick={() => handleDismiss(r.id)} className="btn btn-sm btn-ghost">dismiss</button>
                    <button onClick={() => handleWarnProject(r.id, r.projectId)} className="btn btn-sm" style={{ color: "var(--accent-amber)" }}>warn</button>
                    <button onClick={() => handleRemoveProject(r.id, r.projectId)} className="btn btn-sm btn-danger">remove</button>
                  </div>
                )}
                {tab !== "pending" && (
                  <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-faint)", flexShrink: 0 }}>{r.status}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
