// Podcast.jsx
import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./podcast.css";

const API_BASE = "http://localhost:5275";

/* --------------------- helpers (mirrors Videos.jsx) --------------------- */
const isTruthy = (v) => v === true || v === "true" || v === 1 || v === "1";

function getToken() {
  return localStorage.getItem("token") || "";
}

function getUserFromStorage() {
  const keys = ["user", "currentUser", "auth_user", "profile", "me"];
  for (const k of keys) {
    try {
      const raw = localStorage.getItem(k);
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj && typeof obj === "object") return obj;
      }
    } catch {}
  }
  return {};
}

function saveUserToStorage(merged) {
  try {
    localStorage.setItem("user", JSON.stringify(merged));
  } catch {}
}

/** Local calendar end-of-day */
function toLocalEndOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function parseLocalEndDate(endRaw) {
  if (!endRaw) return null;
  if (endRaw instanceof Date && !isNaN(endRaw.getTime())) return toLocalEndOfDay(endRaw);

  if (typeof endRaw === "string") {
    const s = endRaw.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, d] = s.split("-").map(Number);
      return new Date(y, m - 1, d, 23, 59, 59, 999);
    }
    if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(s)) {
      const [a, b, c] = s.split(/[-/]/).map(Number);
      return new Date(c, b - 1, a, 23, 59, 59, 999); // DD-MM-YYYY
    }
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
      const [mm, dd, yyyy] = s.split("/").map(Number); // US
      return new Date(yyyy, mm - 1, dd, 23, 59, 59, 999);
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) return toLocalEndOfDay(d);
  }

  const d = new Date(endRaw);
  if (!isNaN(d.getTime())) return toLocalEndOfDay(d);
  return null;
}

function isActiveFromSnapshot(user) {
  if (!user || typeof user !== "object") return false;

  // explicit flags if you ever add them
  const flags = [
    user.subscriptionActive,
    user.isSubscribed,
    user.isPremiumUser,
    user.subscription?.active,
    user.subscription?.isActive,
    user.currentPlanActive,
  ];
  if (flags.some(isTruthy)) return true;

  // plan + endDate (various keys)
  const plan =
    user.subscriptionPlan ??
    user.plan ??
    user.subscription?.plan ??
    user.subscription?.planName ??
    user.currentPlan ??
    null;

  const endRaw =
    user.subscriptionEnd ??
    user.endDate ??
    user.subscription?.end ??
    user.subscription?.endDate ??
    user.currentPlanEnd ??
    null;

  if (!plan || !endRaw) return false;

  const end = parseLocalEndDate(endRaw);
  if (!end) return false;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  return end >= startOfToday;
}

/**
 * Fetch the current user's subscription state from the server and normalize it.
 * Tolerates multiple DTO shapes:
 *   - { active, plan, endDate }      // preferred
 *   - { Status, Plan, EndDate, ... } // fallback
 * Returns: { active: boolean, plan: string|null, endDate: string|null }
 */
async function fetchSubscriptionActive() {
  const token = getToken();
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE}/api/subscription/me/current`, {
      method: "GET",
      headers,
      credentials: "omit",
    });

    // Any non-2xx → treat as not active
    if (!res.ok) {
      return { active: false, plan: null, endDate: null };
    }

    // 200 with null body → not active
    const data = await res.json();
    if (!data) {
      return { active: false, plan: null, endDate: null };
    }

    // Prefer explicit 'active'
    const hasActiveKey =
      Object.prototype.hasOwnProperty.call(data, "active") ||
      Object.prototype.hasOwnProperty.call(data, "Active");

    if (hasActiveKey) {
      const activeRaw = data.active ?? data.Active;
      const activeBool =
        activeRaw === true || activeRaw === "true" || activeRaw === 1 || activeRaw === "1";
      return {
        active: activeBool,
        plan: data.plan ?? data.Plan ?? null,
        endDate: data.endDate ?? data.EndDate ?? null,
      };
    }

    // Derive from Status and/or EndDate
    const statusRaw = (data.status ?? data.Status ?? "").toString().toLowerCase();
    const endRaw = data.endDate ?? data.EndDate ?? null;

    let active = false;
    if (statusRaw) active = statusRaw === "active";

    if (!active && endRaw) {
      const end = new Date(endRaw);
      if (!Number.isNaN(end.getTime())) {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        active = end >= startOfToday;
      }
    }

    return {
      active,
      plan: data.plan ?? data.Plan ?? null,
      endDate: endRaw,
    };
  } catch {
    return { active: false, plan: null, endDate: null };
  }
}

/** Main gate used by the card click (mirrors Videos.jsx) */
async function checkPremiumAccess() {
  // 1) try local snapshot
  const user = getUserFromStorage();
  if (isActiveFromSnapshot(user)) return true;

  // 2) fallback to server call and cache back into localStorage.user
  const snap = await fetchSubscriptionActive();
  const merged = { ...user };
  if (snap.plan) merged.subscriptionPlan = snap.plan;
  if (snap.endDate) merged.subscriptionEnd = snap.endDate;
  merged.subscriptionActive = !!snap.active;
  saveUserToStorage(merged);

  return !!snap.active;
}

/* --------------------- formatting helpers --------------------- */
// Utility: format seconds into mm:ss or hh:mm:ss
function formatDuration(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "—";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
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

// ---- views helper: tolerate multiple property names from DTO ----
function extractViews(summary) {
  if (!summary || typeof summary !== "object") return 0;
  return summary.views ?? summary.viewCount ?? summary.viewsCount ?? 0;
}

/* --------------------- Card --------------------- */
function EpisodeCard({ episode }) {
  const navigate = useNavigate();
  const [views, setViews] = useState(0);

  // Keep UI unchanged; just upgrade the premium check
  async function onPlayClick(e) {
    const premium = isTruthy(episode?.premium);

    if (premium) {
      const ok = await checkPremiumAccess();
      if (!ok) {
        if (e?.preventDefault) e.preventDefault();
        if (e?.stopPropagation) e.stopPropagation();
        alert(
          "You need an active subscription to play this premium podcast.\n\nPlease choose a plan to continue."
        );
        return;
      }
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
    return () => {
      aborted = true;
    };
  }, [episode?.id]);

  // prefer server-provided cover
  const serverCover = episode?.coverImagePath ? `${API_BASE}${episode.coverImagePath}` : null;

  return (
    <article className="episode-card">
      {/* Badge: Premium */}
      {isTruthy(episode?.premium) && <span className="premium-badge">Premium</span>}

      {/* Cover from server */}
      {serverCover && (
        <img src={serverCover} alt={`${episode.title} cover`} className="episode-cover" />
      )}

      <div className="episode-content">
        <h3>{episode.title}</h3>
        {episode.description && <p>{episode.description}</p>}
        {Number.isFinite(episode.duration) && <p>Duration: {formatDuration(episode.duration)}</p>}
        {/* Views */}
        <p className="episode-meta">{Number(views || 0).toLocaleString()} views</p>
        {/* Show uploader and date if available */}
        {episode.createdBy && <p className="episode-meta">Uploaded by: {episode.createdBy}</p>}
        {episode.createdAt && <p className="episode-meta">Uploaded: {formatDate(episode.createdAt)}</p>}

        <button onClick={onPlayClick} className="play-btn">
          Play
        </button>
      </div>
    </article>
  );
}

/* --------------------- Page --------------------- */
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
          if (!cancel) setEpisodes([]);
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

      {/* Optional search UI */}
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