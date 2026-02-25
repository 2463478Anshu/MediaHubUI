import React, { useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler);

const METRICS = [
  { key: "views", label: "Views", color: "#4a9cff" },
  { key: "likes", label: "Likes", color: "#2b8747" },
  { key: "comments", label: "Comments", color: "#f0b429" },
  { key: "subscriptions", label: "Subscriptions", color: "#b35cd1" },
];

// Daily ranges
const DAY_RANGES = [
  { key: 7, label: "Last 7 days" },
  { key: 14, label: "Last 14 days" },
  { key: 30, label: "Last 30 days" },
  { key: 60, label: "Last 60 days" },
];

// Weekly ranges
const WEEK_RANGES = [
  { key: 8, label: "Last 8 weeks" },
  { key: 12, label: "Last 12 weeks" },
  { key: 24, label: "Last 24 weeks" },
];

function formatDateISO(d) {
  // format yyyy-MM-dd so axis stays neat
  const dt = new Date(d);
  const m = `${dt.getMonth() + 1}`.padStart(2, "0");
  const day = `${dt.getDate()}`.padStart(2, "0");
  return `${dt.getFullYear()}-${m}-${day}`;
}

// Zero-fill helper for daily series coming back with date/value pairs
function zeroFillDailySeries(series) {
  // Expect server to return {labels: ["2026-02-01", ...], counts: [n, ...]}
  const labels = Array.isArray(series?.labels) ? series.labels.slice() : [];
  const data = Array.isArray(series?.counts) ? series.counts.slice() : [];

  // If the API already returns continuous days matched to counts, just return
  if (labels.length > 1) {
    // Ensure labels are sorted ascending by date
    const zipped = labels.map((l, i) => ({ date: l, count: data[i] ?? 0 }));
    zipped.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Build continuous day list between first & last
    const outLabels = [];
    const outCounts = [];
    if (zipped.length) {
      let cursor = new Date(zipped[0].date);
      const end = new Date(zipped[zipped.length - 1].date);
      const map = new Map(zipped.map(z => [formatDateISO(z.date), z.count]));

      while (cursor <= end) {
        const k = formatDateISO(cursor);
        outLabels.push(k);
        outCounts.push(map.get(k) ?? 0);
        cursor.setDate(cursor.getDate() + 1);
      }
      return { labels: outLabels, counts: outCounts };
    }
  }
  return series ?? { labels: [], counts: [] };
}

export default function GrowthTab({ fetchGrowth, growth }) {
  const [metric, setMetric] = useState("views");
  const [granularity, setGranularity] = useState("daily"); // "daily" | "weekly"
  const [daysCount, setDaysCount] = useState(30);
  const [weeksCount, setWeeksCount] = useState(12);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        if (granularity === "daily") {
          await fetchGrowth(metric, { granularity: "daily", days: daysCount });
        } else {
          await fetchGrowth(metric, { granularity: "weekly", weeks: weeksCount });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [metric, granularity, daysCount, weeksCount, fetchGrowth]);

  const meta = METRICS.find((m) => m.key === metric);
  const color = meta?.color || "#4a9cff";

  // If daily, enforce zero-fill for readability
  const preparedGrowth = useMemo(() => {
    if (granularity === "daily") return zeroFillDailySeries(growth);
    return growth || { labels: [], counts: [] };
  }, [growth, granularity]);

  const chartData = useMemo(() => ({
    labels: preparedGrowth.labels || [],
    datasets: [{
      label: meta?.label || "Metric",
      data: preparedGrowth.counts || [],
      fill: true,
      backgroundColor: color + "1A", // ~10% alpha
      borderColor: color,
      pointBackgroundColor: color,
      pointRadius: 2,
      tension: 0.25, // smooth line
      borderWidth: 2,
    }],
  }), [preparedGrowth, color, meta]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    plugins: {
      legend: { display: true, labels: { color: "#374151" } },
      tooltip: {
        callbacks: {
          title: (items) => {
            const raw = items?.[0]?.label ?? "";
            if (granularity === "daily") return raw; // yyyy-MM-dd
            return raw; // keep whatever server provided for weekly
          },
          label: (ctx) => ` ${ctx.dataset.label}: ${ctx.formattedValue}`,
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: "#6b7280",
          autoSkip: true,
          maxRotation: 0,
          callback: (val, idx, ticks) => {
            const label = (chartData.labels?.[val] ?? "").toString();
            // For daily, show every ~N-th label depending on length
            if (granularity === "daily") {
              const step = chartData.labels.length > 60 ? 6
                        : chartData.labels.length > 45 ? 5
                        : chartData.labels.length > 30 ? 4
                        : chartData.labels.length > 20 ? 3
                        : 2;
              return idx % step === 0 ? label : "";
            }
            return label;
          },
        },
        grid: { color: "#eef2f7" },
      },
      y: {
        beginAtZero: true,
        ticks: { color: "#6b7280" },
        grid: { color: "#eef2f7" },
      },
    },
  }), [granularity, chartData.labels]);

  return (
    <section className="growth-section">
      <div className="growth-header" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <h2 style={{ marginRight: "auto" }}>Growth Analytics ({granularity === "daily" ? "Daily" : "Weekly"})</h2>
        {/* Metric */}
        <select value={metric} onChange={(e) => setMetric(e.target.value)}>
          {METRICS.map((m) => (
            <option key={m.key} value={m.key}>{m.label}</option>
          ))}
        </select>
        {/* Granularity */}
        <select value={granularity} onChange={(e) => setGranularity(e.target.value)}>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </select>
        {/* Range */}
        {granularity === "daily" ? (
          <select value={daysCount} onChange={(e) => setDaysCount(Number(e.target.value))}>
            {DAY_RANGES.map((r) => (
              <option key={r.key} value={r.key}>{r.label}</option>
            ))}
          </select>
        ) : (
          <select value={weeksCount} onChange={(e) => setWeeksCount(Number(e.target.value))}>
            {WEEK_RANGES.map((r) => (
              <option key={r.key} value={r.key}>{r.label}</option>
            ))}
          </select>
        )}
      </div>

      <div className="chart-wrap growth-chart" style={{ minHeight: 320 }}>
        {loading ? <div style={{ padding: "1rem" }}>Loading...</div> : (
          <Line data={chartData} options={chartOptions} />
        )}
      </div>
    </section>
  );
}