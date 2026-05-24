import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  doc, getDoc, setDoc, deleteDoc, increment,
  collection, addDoc, query, orderBy, onSnapshot, serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

const REACTIONS = [
  { key: "inspired", label: "✦ inspired" },
  { key: "relatable", label: "◎ relatable" },
  { key: "helpful", label: "↗ helpful" }
];

export default function LogCard({ log, projectId, showProject = false }) {
  const { user } = useAuth();
  const [myReactions, setMyReactions] = useState({});
  const [reactionCounts, setReactionCounts] = useState({
    inspired: log.reactions?.inspired || 0,
    relatable: log.reactions?.relatable || 0,
    helpful: log.reactions?.helpful || 0
  });
  const [comments, setComments] = useState([]);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [projectName, setProjectName] = useState("");

  useEffect(() => {
    if (showProject && projectId) {
      getDoc(doc(db, "projects", projectId)).then(snap => {
        if (snap.exists()) setProjectName(snap.data().name);
      });
    }
  }, [showProject, projectId]);

  useEffect(() => {
    if (!user || !log.id) return;
    const ref = doc(db, "projects", projectId, "logs", log.id, "reactions", user.uid);
    getDoc(ref).then(snap => {
      if (snap.exists()) setMyReactions(snap.data());
    });
  }, [user, log.id, projectId]);

  useEffect(() => {
    if (!showComments || !log.id) return;
    const q = query(
      collection(db, "projects", projectId, "logs", log.id, "comments"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, snap => {
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [showComments, log.id, projectId]);

  async function handleReaction(key) {
    if (!user) return;
    const reactionRef = doc(db, "projects", projectId, "logs", log.id, "reactions", user.uid);
    const logRef = doc(db, "projects", projectId, "logs", log.id);
    const already = myReactions[key];

    setMyReactions(prev => ({ ...prev, [key]: !already }));
    setReactionCounts(prev => ({ ...prev, [key]: prev[key] + (already ? -1 : 1) }));

    if (already) {
      const updated = { ...myReactions };
      delete updated[key];
      await setDoc(reactionRef, updated);
      await setDoc(logRef, { reactions: { [key]: increment(-1) } }, { merge: true });
    } else {
      await setDoc(reactionRef, { ...myReactions, [key]: true });
      await setDoc(logRef, { reactions: { [key]: increment(1) } }, { merge: true });
    }
  }

  async function handleComment(e) {
    e.preventDefault();
    if (!user || !commentText.trim()) return;
    setSubmittingComment(true);
    await addDoc(collection(db, "projects", projectId, "logs", log.id, "comments"), {
      text: commentText.trim(),
      authorId: user.uid,
      authorName: user.displayName || "Builder",
      authorPhoto: user.photoURL || null,
      createdAt: serverTimestamp()
    });
    setCommentText("");
    setSubmittingComment(false);
  }

  async function handleReport() {
    if (!user) return;
    await addDoc(collection(db, "reports"), {
      type: "log",
      projectId,
      logId: log.id,
      reportedBy: user.uid,
      status: "pending",
      createdAt: serverTimestamp()
    });
    alert("Reported. Our team will review this.");
  }

  const initials = (name) => name ? name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() : "?";
  const formatDate = (ts) => {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="log-card">
      <div className="log-header">
        <div className="log-meta">
          <Link to={`/profile/${log.authorId}`}>
            {log.authorPhoto
              ? <img src={log.authorPhoto} alt="" className="log-avatar" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
              : <div className="log-avatar">{initials(log.authorName)}</div>
            }
          </Link>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Link to={`/profile/${log.authorId}`} className="log-author">{log.authorName}</Link>
              {showProject && projectName && (
                <Link to={`/project/${projectId}`} style={{ fontSize: 12, color: "var(--text-faint)" }}>→ {projectName}</Link>
              )}
            </div>
            <div className="log-day">{formatDate(log.createdAt)} · Day {log.dayNumber}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {log.milestone && (
            <span className="milestone-badge">🏁 {log.milestone}</span>
          )}
          {user && user.uid !== log.authorId && (
            <button onClick={handleReport} className="btn btn-ghost btn-sm" style={{ fontSize: 12, color: "var(--text-faint)", padding: "3px 8px" }}>report</button>
          )}
        </div>
      </div>

      <div className="log-body">
        {log.title && <div className="log-title">{log.title}</div>}
        {log.text && <div className="log-text">{log.text}</div>}
        {log.images && log.images.length > 0 && (
          <div className={`log-images ${log.images.length === 1 ? "one" : "two"}`}>
            {log.images.map((img, i) => (
              <img key={i} src={img.url} alt="" className="log-image" />
            ))}
          </div>
        )}
      </div>

      <div className="log-footer">
        {REACTIONS.map(r => (
          <button
            key={r.key}
            className={`reaction-btn ${myReactions[r.key] ? "active" : ""}`}
            onClick={() => handleReaction(r.key)}
          >
            {r.label}
            {reactionCounts[r.key] > 0 && (
              <span className="reaction-count">{reactionCounts[r.key]}</span>
            )}
          </button>
        ))}
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginLeft: "auto", fontSize: 12 }}
          onClick={() => setShowComments(v => !v)}
        >
          {showComments ? "hide" : "discuss"}
          {comments.length > 0 && ` (${comments.length})`}
        </button>
      </div>

      {showComments && (
        <div style={{ padding: "0 1.25rem 1rem", borderTop: "0.5px solid var(--border)" }}>
          <div style={{ paddingTop: "0.75rem", display: "flex", flexDirection: "column", gap: 8 }}>
            {comments.map(c => (
              <div key={c.id} style={{ display: "flex", gap: 8, fontSize: 13 }}>
                <div className="log-avatar" style={{ width: 26, height: 26, fontSize: 11, flexShrink: 0 }}>
                  {initials(c.authorName)}
                </div>
                <div>
                  <span style={{ fontWeight: 500, marginRight: 6 }}>{c.authorName}</span>
                  <span style={{ color: "var(--text-muted)" }}>{c.text}</span>
                </div>
              </div>
            ))}
          </div>
          {user && (
            <form onSubmit={handleComment} style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <input
                className="form-input"
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder="Add a comment…"
                style={{ flex: 1, padding: "6px 10px", fontSize: 13 }}
              />
              <button type="submit" className="btn btn-primary btn-sm" disabled={submittingComment}>
                post
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
