// Videos.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./videos.css";
import "./podcast.css";

/** API base */
const API_BASE = "http://localhost:5275";

/* --------------------- helpers --------------------- */
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
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0,0,0,0);
  return end >= startOfToday;
}

/** Server-backed check if local snapshot is missing/stale */
/**
 * Fetch the current user's subscription state from the server and normalize it.
 * Tolerates multiple DTO shapes:
 *   - { active, plan, endDate }      // your Fix B (preferred)
 *   - { Status, Plan, EndDate, ... } // original SubscriptionDto
 * Returns a normalized object: { active: boolean, plan: string|null, endDate: string|null }
 */
async function fetchSubscriptionActive() {
  const token = getToken();
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE}/api/subscription/me/current`, {
      method: "GET",
      headers,
      credentials: "omit", // using Bearer token; avoid cookie/CORS headaches
    });

    // Any non-2xx → treat as not active
    if (!res.ok) {
      return { active: false, plan: null, endDate: null };
    }

    // If the API returns null (no active subscription)
    // e.g., 200 with body: null
    const data = await res.json();
    if (!data) {
      return { active: false, plan: null, endDate: null };
    }

    // 1) Prefer explicit 'active' (Fix B)
    // Accept both camelCase and PascalCase, and tolerate strings/nums.
    const hasActiveKey = Object.prototype.hasOwnProperty.call(data, "active")
                      || Object.prototype.hasOwnProperty.call(data, "Active");
    if (hasActiveKey) {
      const activeRaw = data.active ?? data.Active;
      const activeBool =
        activeRaw === true ||
        activeRaw === "true" ||
        activeRaw === 1 ||
        activeRaw === "1";
      return {
        active: activeBool,
        plan: data.plan ?? data.Plan ?? null,
        endDate: data.endDate ?? data.EndDate ?? null,
      };
    }

    // 2) Derive from Status and/or EndDate (Fix A)
    // Normalize status
    const statusRaw = (data.status ?? data.Status ?? "").toString().toLowerCase();

    // Normalize endDate (support various casings)
    const endRaw = data.endDate ?? data.EndDate ?? null;

    // Compute 'active' from status if present; else compute from end date.
    let active = false;

    if (statusRaw) {
      // Consider "active" only when status string is "active"
      active = statusRaw === "active";
    }

    if (!active && endRaw) {
      // Fallback: consider it active if EndDate >= start of *today* (local)
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
    // Network/parse failures → not active
    return { active: false, plan: null, endDate: null };
  }
}
``


/** Main gate used by the card click */
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

/* ---- views helper ---- */
function extractViews(summary) {
  if (!summary || typeof summary !== "object") return 0;
  return summary.views ?? summary.viewCount ?? summary.viewsCount ?? 0;
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return isNaN(d) ? "—" : d.toLocaleString();
  } catch { return "—"; }
}

/* --------------------- Card --------------------- */
function VideoCard({ video }) {
  const navigate = useNavigate();
  const [views, setViews] = useState(0);
  const premium = isTruthy(video?.premium);

  async function onCardClick(e) {
    if (premium) {
      const ok = await checkPremiumAccess();
      if (!ok) {
        e.preventDefault();
        e.stopPropagation();
        alert("You need an active subscription to open this premium video.\n\nPlease choose a plan to continue.");
        return;
      }
    }
    navigate(`/videos/${video.id}`);
  }

  useEffect(() => {
    let aborted = false;
    (async () => {
      if (!video?.id) return;
      try {
        const res = await fetch(`${API_BASE}/api/v1/engagement/video/${video.id}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!aborted) setViews(extractViews(data));
      } catch {}
    })();
    return () => { aborted = true; };
  }, [video?.id]);

  const serverThumb =
    video?.thumbnailPath ? `${API_BASE}${video.thumbnailPath}`
    : video?.coverImagePath ? `${API_BASE}${video.coverImagePath}`
    : null;

  return (
    <article className="episode-card">
      {premium && <span className="premium-badge">Premium</span>}

      {serverThumb ? (
        <img
          src={serverThumb}
          alt={`${video.title} cover`}
          className="episode-cover"
          onClick={onCardClick}
          role="button"
          style={{ cursor: "pointer" }}
        />
      ) : (
        <video
          className="episode-cover"
          onClick={onCardClick}
          role="button"
          style={{ cursor: "pointer" }}
          src={video?.filePath ? `${API_BASE}${video.filePath}` : undefined}
        />
      )}

      <div className="episode-content">
        <h3>{video.title}</h3>
        {video.description && <p>{video.description}</p>}

        {/* FIXED: viewsll -> views */}
        <p className="episode-meta">{Number(views || 0).toLocaleString()} views</p>
        {video.category && <p className="episode-meta">Category: {video.category}</p>}
        {video.createdBy && <p className="episode-meta">Uploaded by: {video.createdBy}</p>}
        {video.createdAt && <p className="episode-meta">Uploaded: {formatDate(video.createdAt)}</p>}

        <button onClick={onCardClick} className="play-btn">Play</button>
      </div>
    </article>
  );
}

/* --------------------- Page --------------------- */
export default function Videos() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE}/api/v1/video`);
        if (!response.ok) { if (!cancel) setVideos([]); return; }
        const data = await response.json();
        if (!cancel) setVideos(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error loading videos from backend:", err);
        if (!cancel) setVideos([]);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

  return (
    <section>
      <h1 className="page-title">VIDEOS</h1>
      {loading && <p style={{ color: "gray" }}>Loading...</p>}
      {!loading && videos.length === 0 && <p style={{ color: "gray" }}>No uploaded videos found.</p>}

      <div className="episodes-grid">
        {videos.map((video) => <VideoCard key={video.id} video={video} />)}
      </div>
    </section>
  );
}