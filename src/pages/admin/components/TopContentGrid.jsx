// MediaHub/src/pages/admin/components/TopContentGrid.jsx
import React from "react";
import { Link } from "react-router-dom";

export default function TopContentGrid({ items }) {
  if (!items?.length) return <p className="empty">No content available.</p>;
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
          <Link className="view-link" to={`/videos/${e.id}`}>Open</Link>
        </div>
      ))}
    </div>
  );
}