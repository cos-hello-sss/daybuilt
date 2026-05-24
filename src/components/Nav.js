import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Nav() {
  const { user, profile, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  return (
    <nav className="nav">
      <Link to="/" className="nav-logo">builtday</Link>
      <div className="nav-right">
        {user ? (
          <>
            <Link to="/feed" className="btn btn-ghost btn-sm">feed</Link>
            <Link to="/new-project" className="btn btn-ghost btn-sm">new project</Link>
            {isAdmin && <Link to="/admin" className="btn btn-ghost btn-sm" style={{ color: "var(--accent-amber)" }}>admin</Link>}
            <Link to={`/profile/${user.uid}`} className="btn btn-ghost btn-sm">
              {profile?.displayName?.split(" ")[0] || "me"}
            </Link>
            <button onClick={handleLogout} className="btn btn-sm">logout</button>
          </>
        ) : (
          <>
            <Link to="/feed" className="btn btn-ghost btn-sm">explore</Link>
            <Link to="/login" className="btn btn-sm">sign in</Link>
          </>
        )}
      </div>
    </nav>
  );
}
