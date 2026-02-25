// MediaHub/src/pages/admin/components/SummaryCards.jsx
import React from "react";

export default function SummaryCards({ totals }) {
  return (
    <section className="cards">
      <div className="card"><div className="card-title">Total Views</div><div className="card-value">{totals.views}</div></div>
      <div className="card"><div className="card-title">Total Likes</div><div className="card-value">{totals.likes}</div></div>
      <div className="card"><div className="card-title">Total Comments</div><div className="card-value">{totals.comments}</div></div>
      <div className="card"><div className="card-title">Total Subscribers</div><div className="card-value">{totals.subscriptions}</div></div>
    </section>
  );
}