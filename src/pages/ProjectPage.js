import React, { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  doc, getDoc, collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, increment, setDoc, serverTimestamp, arrayUnion
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { compressAndUpload } from "../utils/b2";
import LogCard from "../components/LogCard";
import { computeStreakUpdate } from "../hooks/useStreak";
import { useUploadLimit } from "../hooks/useUploadLimit";

const MILESTONES = ["first sale", "v1 launch", "100 users", "1k users", "shipped feature", "public launch", "custom…"];

export default function ProjectPage() {
  const { projectId } = useParams();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("timeline");
  const [isFollowing, setIsFollowing] = useState(false);

  // Log creation state
  const [logTitle, setLogTitle] = useState("");
  const [logText, setLogText] = useState("");
  const [logMilestone, setLogMilestone] = useState("");
  const [customMilestone, setCustomMilestone] = useState("");
  const [uploading, setUploading] = useState(false);
  const [images, setImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [logError, setLogError] = useState("");
  const [logSuccess, setLogSuccess] = useState(false);
  const fileRef = useRef();

  const { canUpload, remaining, uploadCount } = useUploadLimit(projectId);
  const isOwner = user && project && user.uid === project.ownerId;
  const isBanned = project?.bannedUsers?.includes(user?.uid);

  useEffect(() => {
    if (!projectId) return;
    const ref = doc(db, "projects", projectId);
    const unsub = onSnapshot(ref, snap => {
      if (!snap.exists()) { navigate("/feed"); return; }
      setProject({ id: snap.id, ...snap.data() });
      // increment view
      updateDoc(ref, { viewCount: increment(1) }).catch(() => {});
      setLoading(false);
    });
    return unsub;
  }, [projectId, navigate]);

  useEffect(() => {
    if (!projectId) return;
    const q = query(collection(db, "projects", projectId, "logs"), orderBy("dayNumber", "desc"));
    const unsub = onSnapshot(q, snap => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [projectId]);

  useEffect(() => {
    if (!user || !projectId) return;
    getDoc(doc(db, "users", user.uid, "follows", projectId)).then(snap => {
      setIsFollowing(snap.exists());
    });
  }, [user, projectId]);

  async function handleFollow() {
    if (!user) return;
    const followRef = doc(db, "users", user.uid, "follows", projectId);
    const projectRef = doc(db, "projects", projectId);
    if (isFollowing) {
      await followRef.delete?.() || await setDoc(followRef, { deleted: true });
      await updateDoc(projectRef, { followersCount: increment(-1) });
      setIsFollowing(false);
    } else {
      await setDoc(followRef, { projectId, followedAt: serverTimestamp() });
      await updateDoc(projectRef, { followersCount: increment(1) });
      setIsFollowing(true);
    }
  }

  async function handleImageSelect(e) {
    if (!canUpload) return;
    const files = Array.from(e.target.files).slice(0, remaining);
    if (files.length === 0) return;

    setUploading(true);
    const tempId = "temp-" + Date.now();
    try {
      const uploaded = [];
      for (const f of files) {
        const result = await compressAndUpload(f, user.uid, projectId, tempId);
        uploaded.push(result);
      }
      setImages(prev => [...prev, ...uploaded].slice(0, 2));
    } catch (err) {
      setLogError("Image upload failed: " + err.message);
    }
    setUploading(false);
  }

  async function handleSubmitLog(e) {
    e.preventDefault();
    if (!logText.trim() && !logTitle.trim()) { setLogError("Write something about today."); return; }
    setLogError(""); setSubmitting(true);

    try {
      const projectRef = doc(db, "projects", projectId);
      const dayNumber = (project.dayCount || 0) + 1;
      const milestoneValue = logMilestone === "custom…" ? customMilestone : logMilestone;
      const streakUpdate = computeStreakUpdate(project.lastLogDate, project.currentStreak);

      // Write log
      const logRef = await addDoc(collection(db, "projects", projectId, "logs"), {
        title: logTitle.trim(),
        text: logText.trim(),
        images,
        milestone: milestoneValue || null,
        dayNumber,
        authorId: user.uid,
        authorName: project.ownerName,
        authorPhoto: project.ownerPhoto || null,
        projectId,
        reactions: { inspired: 0, relatable: 0, helpful: 0 },
        trendingScore: 0,
        createdAt: serverTimestamp()
      });

      // Update project
      await updateDoc(projectRef, {
        dayCount: increment(1),
        currentStreak: streakUpdate.currentStreak,
        longestStreak: Math.max(project.longestStreak || 0, streakUpdate.currentStreak),
        lastLogDate: streakUpdate.lastLogDate,
        ...(milestoneValue ? { milestones: arrayUnion({ label: milestoneValue, dayNumber, logId: logRef.id }) } : {})
      });

      // Update upload limit counter
      const today = new Date().toISOString().split("T")[0];
      await setDoc(doc(db, "users", user.uid, "uploadLimits", projectId), {
        date: today, count: (uploadCount || 0) + images.length
      });

      // Write to feedIndex if public
      if (project.isPublic) {
        await setDoc(doc(db, "feedIndex", logRef.id), {
          projectId,
          title: logTitle.trim(),
          text: logText.trim(),
          images,
          milestone: milestoneValue || null,
          dayNumber,
          authorId: user.uid,
          authorName: project.ownerName,
          authorPhoto: project.ownerPhoto || null,
          reactions: { inspired: 0, relatable: 0, helpful: 0 },
          trendingScore: 0,
          createdAt: serverTimestamp()
        });
      }

      setLogTitle(""); setLogText(""); setImages([]); setLogMilestone("");
      setLogSuccess(true);
      setTimeout(() => setLogSuccess(false), 3000);
    } catch (err) {
      setLogError(err.message);
    }
    setSubmitting(false);
  }

  async function handleBanUser(uid) {
    if (!isOwner) return;
    await updateDoc(doc(db, "projects", projectId), { bannedUsers: arrayUnion(uid) });
  }

  async function handleAdminAction(action) {
    if (!isAdmin) return;
    if (action === "remove") {
      await updateDoc(doc(db, "projects", projectId), { isPublic: false, adminStatus: "removed" });
      alert("Project removed from public feed.");
    } else if (action === "warn") {
      await updateDoc(doc(db, "projects", projectId), { adminStatus: "warned" });
      alert("Project marked as warned.");
    }
  }

  if (loading) return <div className="loading-spinner">loading project…</div>;
  if (!project) return null;

  const canView = project.isPublic || isOwner || isAdmin;
  if (!canView) return (
    <div className="main"><div className="empty-state"><div style={{ fontSize: 28 }}>🔒</div><p>This project is private.</p></div></div>
  );

  if (isBanned) return (
    <div className="main"><div className="empty-state"><div style={{ fontSize: 28 }}>⊘</div><p>You've been banned from interacting with this project.</p></div></div>
  );

  const typeClass = project.type ? `tag-${project.type.toLowerCase()}` : "";

  return (
    <div className="main-wide">
      {/* Project header */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <h1 style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontWeight: 300, fontSize: 30 }}>{project.name}</h1>
              {project.type && <span className={`tag ${typeClass}`}>{project.type}</span>}
              {!project.isPublic && <span className="tag">private</span>}
            </div>
            {project.description && <p style={{ color: "var(--text-muted)", fontSize: 14, maxWidth: 480, lineHeight: 1.6 }}>{project.description}</p>}
            <div style={{ display: "flex", gap: "1.5rem", marginTop: 10, fontFamily: "var(--mono)", fontSize: 12, color: "var(--text-faint)" }}>
              <span>Day {project.dayCount || 0}</span>
              <span>🔥 {project.currentStreak || 0} streak</span>
              <span>{project.followersCount || 0} followers</span>
              <span>{project.viewCount || 0} views</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {!isOwner && user && (
              <button onClick={handleFollow} className={`btn btn-sm ${isFollowing ? "" : "btn-primary"}`}>
                {isFollowing ? "unfollow" : "follow"}
              </button>
            )}
            {isAdmin && (
              <>
                <button onClick={() => handleAdminAction("warn")} className="btn btn-sm" style={{ color: "var(--accent-amber)" }}>warn</button>
                <button onClick={() => handleAdminAction("remove")} className="btn btn-sm btn-danger">remove</button>
              </>
            )}
          </div>
        </div>

        {/* Milestones row */}
        {project.milestones?.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
            {project.milestones.map((m, i) => (
              <span key={i} className="milestone-badge">🏁 {m.label}</span>
            ))}
          </div>
        )}
      </div>

      <div className="layout-two">
        <div>
          <div className="tabs">
            <button className={`tab ${tab === "timeline" ? "active" : ""}`} onClick={() => setTab("timeline")}>timeline</button>
            <button className={`tab ${tab === "logs" ? "active" : ""}`} onClick={() => setTab("logs")}>all logs</button>
            {isOwner && <button className={`tab ${tab === "analytics" ? "active" : ""}`} onClick={() => setTab("analytics")}>analytics</button>}
          </div>

          {tab === "logs" && (
            <div className="feed">
              {logs.length === 0
                ? <div className="empty-state"><div style={{ fontSize: 28 }}>◎</div><p>No logs yet. Start with day 1.</p></div>
                : logs.map(log => <LogCard key={log.id} log={log} projectId={projectId} />)
              }
            </div>
          )}

          {tab === "timeline" && (
            <div className="timeline">
              {logs.length === 0
                ? <div className="empty-state"><div style={{ fontSize: 28 }}>◎</div><p>No logs yet. Your journey starts with day 1.</p></div>
                : [...logs].sort((a, b) => a.dayNumber - b.dayNumber).map((log, i, arr) => (
                  <div key={log.id} className="timeline-item">
                    {i < arr.length - 1 && <div className="timeline-line" />}
                    <div className={`timeline-dot ${log.milestone ? "milestone" : ""}`}>
                      {log.milestone ? "🏁" : log.dayNumber}
                    </div>
                    <div className="timeline-content">
                      <div style={{ fontSize: 12, fontFamily: "var(--mono)", color: "var(--text-faint)", marginBottom: 3 }}>
                        {log.createdAt?.toDate?.()?.toLocaleDateString("en-US", { month: "short", day: "numeric" }) || ""}
                      </div>
                      {log.milestone && <div className="milestone-badge" style={{ marginBottom: 6 }}>🏁 {log.milestone}</div>}
                      <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 3 }}>{log.title || `Day ${log.dayNumber}`}</div>
                      {log.text && <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>{log.text.slice(0, 120)}{log.text.length > 120 ? "…" : ""}</div>}
                    </div>
                  </div>
                ))
              }
            </div>
          )}

          {tab === "analytics" && isOwner && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: "2rem" }}>
                {[
                  { label: "total views", value: project.viewCount || 0 },
                  { label: "followers", value: project.followersCount || 0 },
                  { label: "days logged", value: project.dayCount || 0 },
                  { label: "best streak", value: project.longestStreak || 0 }
                ].map(stat => (
                  <div key={stat.label} style={{ background: "var(--bg-subtle)", borderRadius: "var(--radius)", padding: "1rem", textAlign: "center" }}>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 24, fontWeight: 500 }}>{stat.value}</div>
                    <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 3 }}>{stat.label}</div>
                  </div>
                ))}
              </div>
              <p className="section-heading">top entries by reactions</p>
              {[...logs]
                .sort((a, b) => ((b.reactions?.inspired || 0) + (b.reactions?.relatable || 0) + (b.reactions?.helpful || 0)) - ((a.reactions?.inspired || 0) + (a.reactions?.relatable || 0) + (a.reactions?.helpful || 0)))
                .slice(0, 5)
                .map(log => (
                  <div key={log.id} className="admin-row">
                    <span style={{ fontSize: 13 }}>Day {log.dayNumber} — {log.title || "(no title)"}</span>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--text-faint)" }}>
                      {(log.reactions?.inspired || 0) + (log.reactions?.relatable || 0) + (log.reactions?.helpful || 0)} reactions
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Log form */}
          {isOwner && (
            <div className="card">
              <div className="section-heading" style={{ marginBottom: "0.75rem" }}>log today</div>
              {logSuccess && <div className="msg-success">Day {project.dayCount} logged! 🔥</div>}
              {logError && <div className="msg-error">{logError}</div>}
              <form onSubmit={handleSubmitLog}>
                <input
                  className="form-input"
                  value={logTitle}
                  onChange={e => setLogTitle(e.target.value)}
                  placeholder="Title (optional)"
                  style={{ marginBottom: 8 }}
                  maxLength={100}
                />
                <textarea
                  className="form-textarea"
                  value={logText}
                  onChange={e => setLogText(e.target.value)}
                  placeholder={`What happened today? What did you build, learn, or struggle with?`}
                  style={{ minHeight: 90, marginBottom: 8 }}
                  maxLength={2000}
                />

                {/* Milestone select */}
                <select
                  className="form-input"
                  value={logMilestone}
                  onChange={e => setLogMilestone(e.target.value)}
                  style={{ marginBottom: 8, color: logMilestone ? "var(--text)" : "var(--text-faint)" }}
                >
                  <option value="">no milestone</option>
                  {MILESTONES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                {logMilestone === "custom…" && (
                  <input
                    className="form-input"
                    value={customMilestone}
                    onChange={e => setCustomMilestone(e.target.value)}
                    placeholder="Describe your milestone"
                    style={{ marginBottom: 8 }}
                    maxLength={60}
                  />
                )}

                {/* Images */}
                <div style={{ marginBottom: 8 }}>
                  {images.map((img, i) => (
                    <div key={i} style={{ position: "relative", display: "inline-block", marginRight: 6 }}>
                      <img src={img.url} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 6, border: "0.5px solid var(--border)" }} />
                      <button type="button" onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                        style={{ position: "absolute", top: -6, right: -6, width: 16, height: 16, borderRadius: "50%", background: "var(--text)", color: "var(--bg)", border: "none", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>×</button>
                    </div>
                  ))}
                  {images.length < 2 && canUpload && (
                    <button type="button" className="btn btn-sm" onClick={() => fileRef.current.click()} disabled={uploading}>
                      {uploading ? "uploading…" : `+ image (${remaining} left)`}
                    </button>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleImageSelect} />
                </div>

                <button type="submit" className="btn btn-primary btn-sm" style={{ width: "100%", justifyContent: "center" }} disabled={submitting}>
                  {submitting ? "saving…" : `log day ${(project.dayCount || 0) + 1} →`}
                </button>
              </form>
            </div>
          )}

          {/* Owner tools */}
          {isOwner && (
            <div className="card">
              <div className="section-heading" style={{ marginBottom: "0.75rem" }}>project settings</div>
              <Link to={`/project/${projectId}/settings`} className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "center" }}>settings →</Link>
            </div>
          )}

          {/* Builder card */}
          <div className="card">
            <div className="section-heading" style={{ marginBottom: "0.75rem" }}>builder</div>
            <Link to={`/profile/${project.ownerId}`} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="avatar-init">{project.ownerName?.[0]?.toUpperCase()}</div>
              <div>
                <div style={{ fontWeight: 500, fontSize: 14 }}>{project.ownerName}</div>
                <div style={{ fontSize: 12, color: "var(--text-faint)" }}>{project.type}</div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
