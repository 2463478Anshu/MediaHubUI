import React, { useMemo, useState } from "react";
import SummaryCards from "./SummaryCards.jsx";
import EngagementList from "./EngagementList.jsx";
import TopContentGrid from "./TopContentGrid.jsx";

export default function AnalyticsTab({ loading, error, engagement, totals, topContent }) {
  const [searchText, setSearchText] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sortBy, setSortBy] = useState("likesDesc");

  const categories = useMemo(() => {
    const set = new Set(engagement.map((e) => e.category || "Uncategorized"));
    return ["All", ...Array.from(set)];
  }, [engagement]);

  const filteredEngagement = useMemo(() => {
    let rows = engagement.filter((e) => {
      const matchesCategory = categoryFilter === "All" || e.category === categoryFilter;
      const matchesSearch =
        !searchText ||
        e.title.toLowerCase().includes(searchText.toLowerCase()) ||
        String(e.id).includes(searchText);
      return matchesCategory && matchesSearch;
    });

    switch (sortBy) {
      case "likesDesc": rows.sort((a, b) => b.likes - a.likes); break;
      case "commentsDesc": rows.sort((a, b) => b.commentsCount - a.commentsCount); break;
      case "subsDesc": rows.sort((a, b) => b.subscriptions - a.subscriptions); break;
      case "titleAsc": rows.sort((a, b) => a.title.localeCompare(b.title)); break;
      case "titleDesc": rows.sort((a, b) => b.title.localeCompare(a.title)); break;
      default: break;
    }
    return rows;
  }, [engagement, categoryFilter, searchText, sortBy]);

  const maxLikes = Math.max(1, ...engagement.map((e) => e.likes));
  const maxComments = Math.max(1, ...engagement.map((e) => e.commentsCount));
  const maxSubs = Math.max(1, ...engagement.map((e) => e.subscriptions));

  return (
    <>
      {loading && <div className="notice" role="status">Loading analytics…</div>}
      {error && <div className="notice" role="alert">Some data may be unavailable.</div>}

      <SummaryCards totals={totals} />

      <div className="filters">
        <input
          type="text"
          placeholder="Search by title or ID…"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          aria-label="Search by title or ID"
        />
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="likesDesc">Sort: Likes ↓</option>
          <option value="commentsDesc">Sort: Comments ↓</option>
          <option value="subsDesc">Sort: Subscriptions ↓</option>
          <option value="titleAsc">Sort: Title A→Z</option>
          <option value="titleDesc">Sort: Title Z→A</option>
        </select>
      </div>

      <section className="charts">
        <h2>Engagement by Content</h2>
        <div className="chart-legend">
          <span className="legend likes">Likes</span>
          <span className="legend comments">Comments</span>
          <span className="legend subs">Subscriptions</span>
        </div>
        <EngagementList
          rows={filteredEngagement}
          maxLikes={maxLikes}
          maxComments={maxComments}
          maxSubs={maxSubs}
        />
      </section>

      <section className="top-content">
        <h2>Top Content</h2>
        <TopContentGrid items={topContent} />
      </section>
    </>
  );
}