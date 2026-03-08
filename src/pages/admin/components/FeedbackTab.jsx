import React from "react";
import { Link } from "react-router-dom";

export default function FeedbackTab({ feedbackRows, reviewedMap, onMarkReviewed, onDeleteComment }) {
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
                <th>Video</th>
                <th>Username</th>
                <th>Comment</th>
                <th>Status</th>
                <th className="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {feedbackRows.map((r) => {
                const key = `${r.videoId}_${r.commentId}`;
                const reviewed = reviewedMap[key];
                return (
                  <tr key={key}>
                    <td className="td-video">
                      <div className="td-title">{r.videoTitle}</div>
                      <div className="td-sub">ID: {r.videoId}</div>
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
                        <button className="btn small" onClick={() => onMarkReviewed(r)}>
                          Mark Reviewed
                        </button>
                      )}
                      <button className="btn small danger" onClick={() => onDeleteComment(r)}>
                        Delete
                      </button>
                      <Link className="btn small ghost" to={`/${r.type.toLowerCase()}s/${r.videoId}`}>
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