import React from "react";
import { Link } from "react-router-dom";

export default function FeedbackTab({ feedbackRows, reviewedMap, onMarkReviewed, onDeleteComment }) {
  // Normalize a content ID across Video/Article/Podcast payload shapes
  const getContentId = (r) =>
    r?.contentId ?? r?.videoId ?? r?.articleId ?? r?.podcastId ?? r?.id;

  // Normalize a content Title across payload shapes
  const getContentTitle = (r) =>
    r?.title ?? r?.videoTitle ?? r?.articleTitle ?? r?.podcastTitle ?? "(Untitled)";

  // Build correct detail route
  const getDetailPath = (r) => {
    const t = (r?.type || "").toString().trim().toLowerCase();
    const base =
      t === "video"   ? "/videos"   :
      t === "article" ? "/articles" :
      t === "podcast" ? "/podcast"  :
                        "/videos"; // fallback
    const id = getContentId(r);
    return `${base}/${id}`;
  };

  // Optional: wrap the mark-reviewed call to always pass normalized identifiers
  const handleMarkReviewed = (r) => {
    const normalized = {
      ...r,
      // ensure the handler/parent can rely on a single field name
      contentId: getContentId(r),
      title: getContentTitle(r),
    };
    onMarkReviewed(normalized);
  };

  return (
    <section className="feedback">
      <h2>User Feedback (Comments)</h2>
      {feedbackRows.length === 0 ? (
        <p className="empty">No comments yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Content</th>
                <th>Username</th>
                <th>Comment</th>
                <th>Status</th>
                <th className="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {feedbackRows.map((r) => {
                const contentId = getContentId(r);
                const title = getContentTitle(r);

                // ✅ Use normalized ID for the map key & lookup
                const key = `${contentId}_${r.commentId}`;
                const reviewed = !!reviewedMap[key];

                return (
                  <tr key={key}>
                    <td className="td-video">
                      <div className="td-title">{title}</div>
                      <div className="td-sub">
                        Type: {r.type} <span className="dot" /> ID: {contentId}
                      </div>
                    </td>
                    <td>{r.username}</td>
                    <td className="td-comment">{r.text}</td>
                    <td>
                      <span className={`status ${reviewed ? "reviewed" : "pending"}`}>
                        {reviewed ? "Reviewed" : "Pending"}
                      </span>
                    </td>
                    <td className="td-actions">
                      {!reviewed && (
                        <button className="btn small" onClick={() => handleMarkReviewed(r)}>
                          Mark Reviewed
                        </button>
                      )}
                      <button className="btn small danger" onClick={() => onDeleteComment(r)}>
                        Delete
                      </button>
                      <Link className="btn small ghost" to={getDetailPath(r)}>
                        View {r.type}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
