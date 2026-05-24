import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc, deleteDoc, arrayRemove } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

export default function ProjectSettingsPage() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!projectId) return;
    getDoc(doc(db, "projects", projectId)).then(snap => {
      if (!snap.exists() || snap.data().ownerId !== user?.uid) {
        navigate("/feed");
        return;
      }
      setProject({ id: snap.id, ...snap.data() });
      setLoading(false);
    });
  }, [projectId, user, navigate]);

  async function toggleVisibility() {
    setSaving(true);
    await updateDoc(doc(db, "projects", projectId), { isPublic: !project.isPublic });
    setProject(prev => ({ ...prev, isPublic: !prev.isPublic }));
    setSuccess("Visibility updated.");
    setTimeout(() => setSuccess(""), 2000);
    setSaving(false);
  }

  async function unbanUser(uid) {
    await updateDoc(doc(db, "projects", projectId), { bannedUsers: arrayRemove(uid) });
    setProject(prev => ({ ...prev, bannedUsers: prev.bannedUsers.filter(u => u !== uid) }));
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${project.name}"? This cannot be undone.`)) return;
    await deleteDoc(doc(db, "projects", projectId));
    navigate("/feed");
  }

  if (loading) return <div className="loading-spinner">loading…</div>;
  if (!project) return null;

  return (
    <div className="main" style={{ maxWidth: 560 }}>
      <div className="page-header">
        <h1 className="page-title">{project.name}</h1>
        <p className="page-sub">Project settings</p>
      </div>

      {success && <div className="msg-success">{success}</div>}

      <div className="card" style={{ marginBottom: "1rem" }}>
        <div className="section-heading">visibility</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.75rem" }}>
          <div>
            <div style={{ fontWeight: 500, fontSize: 14 }}>
              {project.isPublic ? "Public" : "Private"}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
              {project.isPublic ? "Your logs appear in the public feed." : "Only you can see this project."}
            </div>
          </div>
          <button onClick={toggleVisibility} className={`btn btn-sm ${project.isPublic ? "" : "btn-primary"}`} disabled={saving}>
            {project.isPublic ? "make private" : "make public"}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <div className="section-heading">banned users</div>
        {(!project.bannedUsers || project.bannedUsers.length === 0) ? (
          <p style={{ fontSize: 13, color: "var(--text-faint)", marginTop: "0.75rem" }}>No banned users.</p>
        ) : (
          <div style={{ marginTop: "0.75rem" }}>
            {project.bannedUsers.map(uid => (
              <div key={uid} className="admin-row">
                <span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{uid}</span>
                <button onClick={() => unbanUser(uid)} className="btn btn-sm btn-ghost">unban</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ borderColor: "rgba(185,28,28,0.2)" }}>
        <div className="section-heading" style={{ color: "var(--accent-red)" }}>danger zone</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.75rem" }}>
          <div>
            <div style={{ fontWeight: 500, fontSize: 14 }}>Delete project</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>Permanently deletes this project and all logs.</div>
          </div>
          <button onClick={handleDelete} className="btn btn-sm btn-danger">delete</button>
        </div>
      </div>
    </div>
  );
}
