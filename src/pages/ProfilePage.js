import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { doc, getDoc, collection, query, where, getDocs, setDoc, deleteDoc, serverTimestamp, increment, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

export default function ProfilePage() {
  const { userId } = useParams();
  const { user, profile: myProfile, updateUserProfile } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editBio, setEditBio] = useState("");
  const [editType, setEditType] = useState("");
  const [saving, setSaving] = useState(false);

  const isSelf = user?.uid === userId;

  useEffect(() => {
    async function load() {
      const snap = await getDoc(doc(db, "users", userId));
      if (!snap.exists()) { setLoading(false); return; }
      const data = { id: snap.id, ...snap.data() };
      setProfileData(data);
      setEditBio(data.bio || "");
      setEditType(data.projectType || "");

      // Load public projects (or all if self)
      const pQuery = isSelf
        ? query(collection(db, "projects"), where("ownerId", "==", userId))
        : query(collection(db, "projects"), where("ownerId", "==", userId), where("isPublic", "==", true));
      const pSnap = await getDocs(pQuery);
      setProjects(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // Check follow
      if (user && !isSelf) {
        const followSnap = await getDoc(doc(db, "users", user.uid, "userFollows", userId));
        setIsFollowing(followSnap.exists() && !followSnap.data().deleted);
      }

      setLoading(false);
    }
    load();
  }, [userId, user, isSelf]);

  async function handleFollow() {
    if (!user) return;
    const ref = doc(db, "users", user.uid, "userFollows", userId);
    const targetRef = doc(db, "users", userId);
    const myRef = doc(db, "users", user.uid);
    if (isFollowing) {
      await setDoc(ref, { deleted: true, userId });
      await updateDoc(targetRef, { followersCount: increment(-1) });
      await updateDoc(myRef, { followingCount: increment(-1) });
      setIsFollowing(false);
    } else {
      await setDoc(ref, { userId, followedAt: serverTimestamp() });
      await updateDoc(targetRef, { followersCount: increment(1) });
      await updateDoc(myRef, { followingCount: increment(1) });
      setIsFollowing(true);
    }
  }

  async function handleSaveProfile() {
    setSaving(true);
    await updateUserProfile({ bio: editBio, projectType: editType });
    setProfileData(prev => ({ ...prev, bio: editBio, projectType: editType }));
    setIsEditing(false);
    setSaving(false);
  }

  if (loading) return <div className="loading-spinner">loading…</div>;
  if (!profileData) return <div className="main"><div className="empty-state"><p>User not found.</p></div></div>;

  const typeClass = profileData.projectType ? `tag-${profileData.projectType.toLowerCase()}` : "";

  return (
    <div className="main">
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div className="avatar-init" style={{ width: 52, height: 52, fontSize: 18 }}>
              {profileData.photoURL
                ? <img src={profileData.photoURL} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                : profileData.displayName?.[0]?.toUpperCase()
              }
            </div>
            <div>
              <div style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontWeight: 500, fontSize: 20 }}>{profileData.displayName}</div>
              {profileData.projectType && <span className={`tag ${typeClass}`} style={{ marginTop: 4, display: "inline-block" }}>{profileData.projectType}</span>}
            </div>
          </div>
          {!isSelf && user && (
            <button onClick={handleFollow} className={`btn btn-sm ${isFollowing ? "" : "btn-primary"}`}>
              {isFollowing ? "unfollow" : "follow"}
            </button>
          )}
          {isSelf && (
            <button onClick={() => setIsEditing(v => !v)} className="btn btn-sm">
              {isEditing ? "cancel" : "edit profile"}
            </button>
          )}
        </div>

        {!isEditing && profileData.bio && (
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: "1rem", lineHeight: 1.6 }}>{profileData.bio}</p>
        )}

        {isEditing && (
          <div style={{ marginTop: "1rem" }}>
            <div className="form-group">
              <label className="form-label">bio</label>
              <textarea className="form-textarea" value={editBio} onChange={e => setEditBio(e.target.value)} placeholder="What are you building?" maxLength={200} style={{ minHeight: 70 }} />
            </div>
            <div className="form-group">
              <label className="form-label">focus</label>
              <div style={{ display: "flex", gap: 8 }}>
                {["Startup", "Art", "Learning"].map(t => (
                  <button key={t} type="button" onClick={() => setEditType(t)} className={`btn btn-sm ${editType === t ? "btn-primary" : ""}`}>{t.toLowerCase()}</button>
                ))}
              </div>
            </div>
            <button onClick={handleSaveProfile} className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? "saving…" : "save"}
            </button>
          </div>
        )}

        <div style={{ display: "flex", gap: "1.5rem", marginTop: "1rem", fontFamily: "var(--mono)", fontSize: 12, color: "var(--text-faint)", borderTop: "0.5px solid var(--border)", paddingTop: "0.75rem" }}>
          <span>{projects.length} projects</span>
          <span>{profileData.followersCount || 0} followers</span>
          <span>{profileData.followingCount || 0} following</span>
        </div>
      </div>

      <div className="section-heading">{isSelf ? "your projects" : "projects"}</div>

      {projects.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 28 }}>◎</div>
          <p>{isSelf ? "You haven't started a project yet." : "No public projects yet."}</p>
          {isSelf && <Link to="/new-project" className="btn btn-primary btn-sm" style={{ marginTop: "1rem", display: "inline-flex" }}>start a project →</Link>}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "1rem" }}>
          {projects.map(p => (
            <Link key={p.id} to={`/project/${p.id}`} style={{ textDecoration: "none" }}>
              <div className="project-card">
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div className="project-card-title">{p.name}</div>
                  {p.type && <span className={`tag tag-${p.type.toLowerCase()}`} style={{ fontSize: 11 }}>{p.type}</span>}
                  {!p.isPublic && <span className="tag" style={{ fontSize: 11 }}>private</span>}
                </div>
                {p.description && <div className="project-card-desc">{p.description}</div>}
                <div className="project-stats">
                  <span>Day {p.dayCount || 0}</span>
                  <span>🔥 {p.currentStreak || 0}</span>
                  <span>{p.followersCount || 0} followers</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
