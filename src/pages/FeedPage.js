import React, { useState, useEffect } from "react";
import { collection, query, orderBy, limit, getDocs, where, Timestamp } from "firebase/firestore";
import { db } from "../firebase";
import LogCard from "../components/LogCard";

export default function FeedPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("recent");

  useEffect(() => {
    async function loadFeed() {
      setLoading(true);
      try {
        let q;
        if (tab === "recent") {
          q = query(
            collection(db, "feedIndex"),
            orderBy("createdAt", "desc"),
            limit(40)
          );
        } else {
          // Trending: sort by trendingScore (updated by cloud function or on reaction write)
          q = query(
            collection(db, "feedIndex"),
            orderBy("trendingScore", "desc"),
            limit(40)
          );
        }
        const snap = await getDocs(q);
        setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    }
    loadFeed();
  }, [tab]);

  return (
    <div className="main">
      <div className="page-header">
        <h1 className="page-title">what's being built</h1>
        <p className="page-sub">Public logs from builders shipping in public.</p>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === "recent" ? "active" : ""}`} onClick={() => setTab("recent")}>recent</button>
        <button className={`tab ${tab === "trending" ? "active" : ""}`} onClick={() => setTab("trending")}>trending</button>
      </div>

      {loading ? (
        <div className="loading-spinner">loading logs…</div>
      ) : logs.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 28 }}>◎</div>
          <p>No public logs yet. Be the first to ship in public.</p>
        </div>
      ) : (
        <div className="feed">
          {logs.map(log => (
            <LogCard key={log.id} log={log} projectId={log.projectId} showProject />
          ))}
        </div>
      )}
    </div>
  );
}
