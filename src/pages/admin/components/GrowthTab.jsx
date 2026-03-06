import React, { useState, useMemo } from "react";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from "chart.js";
import { Pie } from "react-chartjs-2";
 
// Register the required elements for Pie charts
ChartJS.register(ArcElement, Tooltip, Legend);
 
function getCategoryTotals(engagement = [], category) {
  const filtered = engagement.filter(e => e.type === category);
  return {
    views: filtered.reduce((sum, e) => sum + (e.views || 0), 0),
    likes: filtered.reduce((sum, e) => sum + (e.likes || 0), 0),
    comments: filtered.reduce((sum, e) => sum + (e.commentsCount || 0), 0),
  };
}
 
export default function GrowthTab({ engagement }) {
  const [category, setCategory] = useState("Video");
 
  const totals = useMemo(() => {
    if (!Array.isArray(engagement)) {
      return { views: 0, likes: 0, comments: 0 };
    }
    return getCategoryTotals(engagement, category);
  }, [engagement, category]);
 
  const data = {
    labels: ["Views", "Likes", "Comments"],
    datasets: [{
      data: [totals.views, totals.likes, totals.comments],
      backgroundColor: ["#4a9cff", "#2b8747", "#f0b429"], // blue, green, yellow
    }]
  };
 
  return (
    <section>
      <h2>Engagement Breakdown ({category})</h2>
      <select value={category} onChange={e => setCategory(e.target.value)}>
        <option value="Video">Videos</option>
        <option value="Article">Articles</option>
        <option value="Podcast">Podcasts</option>
      </select>
      <div style={{ maxWidth: 400, marginTop: "1rem" }}>
        <Pie data={data} />
      </div>
    </section>
  );
}