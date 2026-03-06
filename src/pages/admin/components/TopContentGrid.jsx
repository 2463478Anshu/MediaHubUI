// MediaHub/src/pages/admin/components/TopContentGrid.jsx
import React from "react";
import { Link } from "react-router-dom";

export default function TopContentGrid({ items }) {
  if (!items?.length) return <p className="empty">No content available.</p>;

  // Prefer a server-provided path if present, else compute by type.
  const getDetailPath = (e) => {
    // If your API already includes a viewPath (like in Media Library), use it:
    if (e?.viewPath) return e.viewPath;

    // Detect the type from the most likely fields
    const t = (
      e?.type || e?.contentType || e?.mediaType || e?.kind || ""
    ).toString().trim().toLowerCase();

    // IMPORTANT: Podcast route is singular to match your working Media Library
    const base =
      t === "video"   ? "/videos"   :
      t === "article" ? "/articles" :
      t === "podcast" ? "/podcast"  : // <-- singular
                        "/videos";     // safe fallback

    return `${base}/${e.id}`;
  };

  return (
    <div className="top-grid">
      {items.map((e) => (
        <div key={e.id} className="top-card">
          <div className="top-title">{e.title}</div>

          <div className="top-meta">
            <span className="badge">{e.category}</span>
            <span className="dot" />
            <span>{e.createdAt}</span>
          </div>

          <div className="top-stats">
            <span>👍 {e.likes}</span>
            <span>💬 {e.commentsCount}</span>
            <span>📬 {e.subscriptions}</span>
          </div>

          {/* FIX: route by type; podcast -> /podcast/:id */}
          <Link className="view-link" to={getDetailPath(e)}>
            Open
          </Link>
        </div>
      ))}
    </div>
  );
}