// MediaHub/src/pages/admin/components/EngagementList.jsx
import React from "react";
import { Link } from "react-router-dom";

export default function EngagementList({ rows, maxLikes, maxComments, maxSubs }) {
  if (!rows?.length) return <p className="empty">No content matches your filters.</p>;

  return (
    <ul className="chart-list">
      {rows.map((e) => (
        <li key={e.id} className="chart-row">
          <div className="chart-label">
            <div className="title">{e.title}</div>
            <div className="meta">
              <span className="badge">{e.type}</span>
              <span className="dot" />
              <span className="badge">{e.category}</span>
              <span className="dot" />
              <span>Created: {e.createdAt}</span>
              <span className="dot" />
              <Link className="view-link" to={`/videos/${e.id}`}>View</Link>
            </div>
          </div>
          <div className="bars">
            <div className="bar likes" style={{ width: `${(e.likes / maxLikes) * 100}%` }} title={`${e.likes} likes`} />
            <div className="bar comments" style={{ width: `${(e.commentsCount / maxComments) * 100}%` }} title={`${e.commentsCount} comments`} />
            <div className="bar subs" style={{ width: `${(e.subscriptions / maxSubs) * 100}%` }} title={`${e.subscriptions} subscriptions`} />
          </div>
        </li>
      ))}
    </ul>
  );
}