import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div className="main" style={{ maxWidth: 560, paddingTop: "4rem" }}>
      <div style={{ marginBottom: "3rem" }}>
        <h1 style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontWeight: 300, fontSize: 52, lineHeight: 1.1, marginBottom: "1.25rem" }}>
          Document your<br />project journey.
        </h1>
        <p style={{ fontSize: 16, color: "var(--text-muted)", lineHeight: 1.7, maxWidth: 420, marginBottom: "2rem" }}>
          Builtday is a daily log for builders. Write about what you made, what broke, what you learned. Progress is the content.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          {user ? (
            <>
              <Link to="/new-project" className="btn btn-primary">start a project →</Link>
              <Link to="/feed" className="btn">explore feed</Link>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-primary">get started →</Link>
              <Link to="/feed" className="btn">explore feed</Link>
            </>
          )}
        </div>
      </div>

      <hr className="divider" />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1.5rem" }}>
        {[
          { icon: "◎", label: "Daily logs", desc: "Write every day. Build the habit." },
          { icon: "🔥", label: "Streak tracking", desc: "Consecutive days keep you accountable." },
          { icon: "↗", label: "Public feed", desc: "Ship in public. Inspire others." }
        ].map(f => (
          <div key={f.label}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>{f.icon}</div>
            <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 3 }}>{f.label}</div>
            <div style={{ fontSize: 13, color: "var(--text-faint)", lineHeight: 1.5 }}>{f.desc}</div>
          </div>
        ))}
      </div>

      <p style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontWeight: 300, fontSize: 15, color: "var(--text-faint)", marginTop: "3rem", lineHeight: 1.7 }}>
        Shipping is content. Struggle is content. Progress is content.
      </p>
    </div>
  );
}
