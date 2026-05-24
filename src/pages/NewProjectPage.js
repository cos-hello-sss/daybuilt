import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, addDoc, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

const PROJECT_TYPES = ["Startup", "Art", "Learning"];

export default function NewProjectPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!user) return;
    if (!name.trim()) { setError("Project name is required."); return; }
    if (!type) { setError("Select a project type."); return; }
    setError(""); setLoading(true);

    try {
      const projectData = {
        name: name.trim(),
        description: description.trim(),
        type,
        isPublic,
        ownerId: user.uid,
        ownerName: profile?.displayName || user.displayName || "Builder",
        ownerPhoto: user.photoURL || null,
        currentStreak: 0,
        longestStreak: 0,
        lastLogDate: null,
        dayCount: 0,
        followersCount: 0,
        viewCount: 0,
        trendingScore: 0,
        bannedUsers: [],
        milestones: [],
        createdAt: serverTimestamp()
      };

      const ref = await addDoc(collection(db, "projects"), projectData);

      // Also update user's project count
      await setDoc(doc(db, "users", user.uid), { projectCount: 1 }, { merge: true });

      navigate(`/project/${ref.id}`);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  return (
    <div className="main" style={{ maxWidth: 520 }}>
      <div className="page-header">
        <h1 className="page-title">start a project</h1>
        <p className="page-sub">Every big thing starts somewhere. Day 1 starts now.</p>
      </div>

      <div className="card">
        {error && <div className="msg-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">project name</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Builtday, my novel, learning Rust…" maxLength={80} />
          </div>

          <div className="form-group">
            <label className="form-label">what is it?</label>
            <textarea className="form-textarea" value={description} onChange={e => setDescription(e.target.value)} placeholder="A short description of what you're building or working on." maxLength={500} style={{ minHeight: 80 }} />
          </div>

          <div className="form-group">
            <label className="form-label">project type</label>
            <div style={{ display: "flex", gap: 8 }}>
              {PROJECT_TYPES.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`btn btn-sm ${type === t ? "btn-primary" : ""}`}
                >
                  {t.toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">visibility</label>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => setIsPublic(true)} className={`btn btn-sm ${isPublic ? "btn-primary" : ""}`}>public</button>
              <button type="button" onClick={() => setIsPublic(false)} className={`btn btn-sm ${!isPublic ? "btn-primary" : ""}`}>private</button>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 4 }}>
              {isPublic ? "Anyone can see your logs on the public feed." : "Only you can see this project."}
            </p>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 8 }} disabled={loading}>
            {loading ? "creating…" : "start project →"}
          </button>
        </form>
      </div>
    </div>
  );
}
