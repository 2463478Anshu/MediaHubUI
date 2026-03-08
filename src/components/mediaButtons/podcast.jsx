// Podcast.jsx
import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./podcast.css";

const API_BASE = "http://localhost:5275";

// Utility: format seconds into mm:ss or hh:mm:ss
function formatDuration(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "—";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
}

// Format ISO date safely
function formatDate(iso) {
  try {
    const d = new Date(iso);
    return isNaN(d) ? "—" : d.toLocaleString();
  } catch {
    return "—";
  }
}

/* ----- subscription helpers (kept minimal) ----- */
function getUserFromStorage() {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
}
function isActiveSubscription(user) {
  if (!user || !user.subscriptionPlan || !user.subscriptionEnd) return false;
  const end = new Date(user.subscriptionEnd);
  if (isNaN(end.getTime())) return false;
  const today = new Date();
  const endYMD = end.toISOString().slice(0, 10);
  const todayYMD = today.toISOString().slice(0, 10);
  return endYMD >= todayYMD;
}

// ---- views helper: tolerate multiple property names from DTO ----
function extractViews(summary) {
  if (!summary || typeof summary !== "object") return 0;
  return summary.views ?? summary.viewCount ?? summary.viewsCount ?? 0;
}

function EpisodeCard({ episode }) {
  const navigate = useNavigate();
  const [views, setViews] = useState(0);

  function onPlayClick() {
    const user = getUserFromStorage();
    const isPremium = episode?.premium === true;

    // ✅ Only gate premium content
    if (isPremium && !isActiveSubscription(user)) {
      alert(
        "You need an active subscription to play this premium podcast.\n\nPlease choose a plan to continue."
      );
      return;
    }

    navigate(`/podcast/${episode.id}`);
  }

  // Load views for this card via Engagement Summary
  useEffect(() => {
    let aborted = false;
    async function loadViews() {
      if (!episode?.id) return;
      try {
        const res = await fetch(`${API_BASE}/api/v1/engagement/podcast/${episode.id}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!aborted) setViews(extractViews(data));
      } catch (err) {
        // do not block card rendering
        console.warn("Failed to load views for episode:", err);
      }
    }
    loadViews();
    return () => { aborted = true; };
  }, [episode?.id]);

  // prefer server-provided cover
  const serverCover = episode?.coverImagePath
    ? `${API_BASE}${episode.coverImagePath}`
    : null;

  return (
    <article className="episode-card">
      {/* Badge: Premium */}
      {episode?.premium === true && <span className="premium-badge">Premium</span>}

      {/* Cover from server */}
      {serverCover && (
        <img
          src={serverCover}
          alt={`${episode.title} cover`}
          className="episode-cover"
        />
      )}

      <div className="episode-content">
        <h3>{episode.title}</h3>
        {episode.description && <p>{episode.description}</p>}
        {Number.isFinite(episode.duration) && (
          <p>Duration: {formatDuration(episode.duration)}</p>
        )}
        {/* Views */}
        <p className="episode-meta">{Number(views || 0).toLocaleString()} views</p>
        {/* Show uploader and date if available */}
        {episode.createdBy && (
          <p className="episode-meta">Uploaded by: {episode.createdBy}</p>
        )}
        {episode.createdAt && (
          <p className="episode-meta">Uploaded: {formatDate(episode.createdAt)}</p>
        )}

        <button onClick={onPlayClick} className="play-btn">
          Play
        </button>
      </div>
    </article>
  );
}

export default function Podcast() {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("All");
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load published podcasts from backend API
  useEffect(() => {
    let cancel = false;

    async function loadPodcasts() {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE}/api/v1/podcast`);
        if (!response.ok) {
          setEpisodes([]);
          return;
        }
        const podcasts = await response.json();
        if (!cancel) {
          setEpisodes(Array.isArray(podcasts) ? podcasts : []);
        }
      } catch (err) {
        console.error("Error loading podcasts from backend:", err);
        if (!cancel) setEpisodes([]);
      } finally {
        if (!cancel) setLoading(false);
      }
    }

    loadPodcasts();
    return () => {
      cancel = true;
    };
  }, []);

  // If you have tags, compute; otherwise keep minimal
  const allTags = useMemo(() => {
    const t = new Set();
    episodes.forEach((e) => e.tags?.forEach((x) => t.add(x)));
    return ["All", ...Array.from(t)];
  }, [episodes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return episodes.filter((ep) => {
      const matchesQuery =
        q.length === 0 ||
        (ep.title && ep.title.toLowerCase().includes(q)) ||
        (ep.host && ep.host.toLowerCase().includes(q)) ||
        (ep.category && ep.category.toLowerCase().includes(q));
      const matchesTag = tag === "All" || (ep.tags && ep.tags.includes(tag));
      return matchesQuery && matchesTag;
    });
  }, [query, tag, episodes]);

  return (
    <section>
      <h1 className="page-title">PODCASTS</h1>

      {/* Optional search UI; you can add inputs/selects here if you want */}
      {/* <input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search..." /> */}
      {/* <select value={tag} onChange={(e)=>setTag(e.target.value)}>{allTags.map(t=><option key={t}>{t}</option>)}</select> */}

      {loading && <p style={{ color: "gray" }}>Loading...</p>}
      {!loading && episodes.length === 0 && (
        <p style={{ color: "gray" }}>No uploaded podcasts found.</p>
      )}

      <div className="episodes-grid">
        {filtered.map((ep) => (
          <EpisodeCard key={ep.id} episode={ep} />
        ))}
      </div>
    </section>
  );
}