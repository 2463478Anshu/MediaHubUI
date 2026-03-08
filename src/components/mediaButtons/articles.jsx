import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./articles.css";

const API_BASE = "http://localhost:5275";

const articlePdfUrl = (fileName) =>
  fileName ? `${API_BASE}/uploads/articles/${encodeURIComponent(fileName)}` : "";

function getToken() {
  try {
    const token = localStorage.getItem("token");
    return token && token.split(".").length === 3 ? token : "";
  } catch {
    return "";
  }
}

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

/* ----- subscription helpers: gate premium before opening viewer ----- */
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

// helper: extract views
function extractViews(summary) {
  if (!summary || typeof summary !== "object") return 0;
  return summary.views ?? summary.viewCount ?? summary.viewsCount ?? 0;
}

// sessionStorage key helper
const viewStartKey = (id) => `article:viewStart:${id}`;

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
        // creator + views (to be filled from summary)
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

  const handleRead = (it) => {
    const user = getUserFromStorage();
    if (it.premium === true && !isActiveSubscription(user)) {
      toast.info("You need an active subscription to read this premium article.");
      return;
    }

    // ✅ Start the 10s window at click-time (persist across navigation)
    try {
      sessionStorage.setItem(viewStartKey(it.id), String(Date.now()));
    } catch {}

    navigate(`/articles/${it.id}`);
  };

  return (
    <div className="articles-page">
      <h1 className="page-title">ARTICLES</h1>

      {loading && <div>Loading articles…</div>}
      {err && <div style={{ color: "crimson" }}>{err}</div>}

      {!loading && articles.length === 0 && <small>No articles found.</small>}

      <div className="articles-grid">
        {articles.map((it) => (
          <div key={it.id} className="article-card">
            {/* Badge: Premium / Free */}
            {it.premium === true && <span className="premium-badge">Premium</span>}

            <h2 className="article-card-title">{it.title}</h2>

            {/* Views */}
            <p className="date">
              {Number(it.views || 0).toLocaleString()} views
            </p>

            <p className="date">{it.createdAt ? new Date(it.createdAt).toLocaleString() : ""}</p>

            {/* Creator */}
            <div className="creator-line" title={it.creatorName || ""}>
              {it.creatorName ? (
                <span>By <strong>{it.creatorName}</strong></span>
              ) : (
                <span>By —</span>
              )}
            </div>

            <button className="view-pdf-btn" onClick={() => handleRead(it)}>
              Read Article
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}