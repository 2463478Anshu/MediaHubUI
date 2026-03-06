// Articles.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./articles.css";
import "./podcast.css"; // ✅ reuse the same tokens/look as Video/Podcast

const API_BASE = "http://localhost:5275";

const articlePdfUrl = (fileName) =>
  fileName ? `${API_BASE}/uploads/articles/${encodeURIComponent(fileName)}` : "";

/* --------------------- subscription helpers (aligned with Videos.jsx) --------------------- */
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

/** Main gate used before opening the article viewer (mirrors Videos.jsx) */
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

/* --------------------- generic helpers already present --------------------- */
async function fetchJsonOrError(input, init) {
  const res = await fetch(input, init);
  const contentType = res.headers.get("content-type") || "";
  const text = await res.text();

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      if (contentType.includes("application/json") && text) {
        const problem = JSON.parse(text);
        if (problem?.errors) {
          message = Object.values(problem.errors).flat().join(" | ");
        } else if (problem?.title) {
          message = problem.detail ? `${problem.title} — ${problem.detail}` : problem.title;
        } else if (problem?.message) {
          message = problem.message;
        }
      } else if (text) {
        message = text;
      }
    } catch {
      if (text) message = text;
    }
    throw new Error(message);
  }

  if (!text) return null;
  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
}

// Safe toast helpers
const toast = {
  success: (msg) => (window.toast?.success ? window.toast.success(msg) : console.log("[success]", msg)),
  error: (msg) => (window.toast?.error ? window.toast.error(msg) : console.error("[error]", msg)),
  info: (msg) => (window.toast?.info ? window.toast.info(msg) : console.log("[info]", msg)),
};

// helper: extract views
function extractViews(summary) {
  if (!summary || typeof summary !== "object") return 0;
  return summary.views ?? summary.viewCount ?? summary.viewsCount ?? 0;
}

// sessionStorage key helper
const viewStartKey = (id) => `article:viewStart:${id}`;

// format ISO date like other pages
function formatDate(iso) {
  try {
    const d = new Date(iso);
    return isNaN(d) ? "—" : d.toLocaleString();
  } catch {
    return "—";
  }
}

export default function Articles() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const navigate = useNavigate();

  const token = getToken();
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  async function loadArticles() {
    try {
      setErr("");
      setLoading(true);

      // 1) Load articles
      const listRes = await fetch(`${API_BASE}/api/v1/article`);
      if (!listRes.ok) throw new Error("Failed to fetch articles");
      const list = await listRes.json();

      const normalized = (list || []).map((a, idx) => ({
        id: a.id ?? a.Id ?? `art_${idx}`,
        title: a.title ?? a.Title ?? "Untitled",
        category: a.category ?? a.Category ?? "General",
        premium: a.premium ?? a.Premium ?? false,
        createdAt: a.createdAt ?? a.CreatedAt,
        fileName: a.fileName ?? a.FileName ?? "",
        content: a.content ?? a.Content ?? "",
        creatorUserId: null,
        creatorName: "",
        views: 0,
      }));

      // 2) Fetch summary to get creator name/userId + views
      const withMeta = await Promise.all(
        normalized.map(async (it) => {
          try {
            const summary = await fetchJsonOrError(
              `${API_BASE}/api/v1/engagement/article/${it.id}`,
              { headers: { ...authHeaders } }
            );
            return {
              ...it,
              creatorUserId: summary?.creatorUserId ?? null,
              creatorName: summary?.creatorName ?? "",
              views: extractViews(summary),
            };
          } catch {
            return it;
          }
        })
      );

      setArticles(withMeta);
    } catch (e) {
      setErr(e?.message || "Could not load articles");
      setArticles([]);
      toast.error(e?.message || "Failed to load articles");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadArticles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleRead = async (it, e) => {
    const premium = isTruthy(it?.premium);

    
if (premium) {
  const ok = await checkPremiumAccess();
  if (!ok) {
    if (e?.preventDefault) e.preventDefault();
    if (e?.stopPropagation) e.stopPropagation();
    // Use a native alert so the browser shows "localhost says ..."
    alert("You need an active subscription to access this content.");
    return;
  }
}


    // ✅ Start the 10s window at click-time (persist across navigation)
    try {
      sessionStorage.setItem(viewStartKey(it.id), String(Date.now()));
    } catch {}

    navigate(`/articles/${it.id}`);
  };

  return (
    <section>
      <h1 className="page-title">ARTICLES</h1>

      {loading && <div style={{ color: "gray" }}>Loading articles…</div>}
      {err && <div style={{ color: "crimson" }}>{err}</div>}
      {!loading && articles.length === 0 && <small style={{ color: "gray" }}>No articles found.</small>}

      {/* ✅ Use the same grid class as Videos/Podcasts */}
      <div className="episodes-grid">
        {articles.map((it) => (
          <article key={it.id} className="episode-card">
            {/* Premium badge (inline for articles, see CSS override) */}
            {isTruthy(it.premium) && <span className="premium-badge">Premium</span>}

            <div className="episode-content">
              <h3>{it.title}</h3>

              {/* Meta rows identical to Video */}
              <p className="episode-meta">{Number(it.views || 0).toLocaleString()} views</p>
              {it.category && <p className="episode-meta">Category: {it.category}</p>}
              {it.creatorName && <p className="episode-meta">Uploaded by: {it.creatorName}</p>}
              {it.createdAt && <p className="episode-meta">Uploaded: {formatDate(it.createdAt)}</p>}

              {/* CTA styled like Video's play button */}
              <button className="play-btn" onClick={(e) => handleRead(it, e)}>
                Read
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
