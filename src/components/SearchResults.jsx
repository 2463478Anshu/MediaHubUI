// src/pages/SearchResults.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./SearchResults.css";
import "./mediaButtons/podcast.css"

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5275";

async function fetchWithTimeout(input, init = {}, ms = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  try {
    const res = await fetch(input, { ...init, signal: controller.signal });
    const data = await res.json();
    return data;
  } catch (err) {
    throw new Error("Search failed.");
  } finally {
    clearTimeout(timer);
  }
}

const getX = (obj, ...keys) => {
  for (const k of keys) {
    if (obj && obj[k] != null) return obj[k];
  }
  return undefined;
};

function formatDuration(sec) {
  if (!sec) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return isNaN(d) ? "" : d.toLocaleString();
  } catch {
    return "";
  }
}

export default function SearchResults() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);

  const q = (params.get("q") || "").trim();
  const category = (params.get("category") || "").trim();

  const [activeTab, setActiveTab] = useState("Videos");
  const [loading, setLoading] = useState(false);

  const [videos, setVideos] = useState([]);
  const [podcasts, setPodcasts] = useState([]);
  const [articles, setArticles] = useState([]);

  const debounceTimer = useRef(null);

  const queryStr = useMemo(() => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (category) sp.set("category", category);
    sp.set("type", "all");
    return sp.toString();
  }, [q, category]);

  useEffect(() => {
    if (!q && !category) return;

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(async () => {
      setLoading(true);

      try {
        const data = await fetchWithTimeout(
          `${API_BASE}/api/v1/Search?${queryStr}`
        );

        const items = Array.isArray(data?.items) ? data.items : [];

        const v = [];
        const p = [];
        const a = [];

        items.forEach((it) => {
          if (it.type === "video") v.push(it);
          if (it.type === "podcast") p.push(it);
          if (it.type === "article") a.push(it);
        });

        setVideos(v);
        setPodcasts(p);
        setArticles(a);
      } catch {
        setVideos([]);
        setPodcasts([]);
        setArticles([]);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(debounceTimer.current);
  }, [q, category, queryStr]);

  return (
    <div className="srp">
      <h1 className="page-title">
        Search Results {q && <>for "{q}"</>}
      </h1>

      {!loading && (videos.length > 0 || podcasts.length > 0 || articles.length > 0) && (
        <p style={{ color: "red", fontWeight: "600" }}>
          Results found for "{category || q}". Contents are available in Videos, Podcasts or Articles.
        </p>
      )}

      {/* Tabs */}
      <div className="srp-tabs">
        <button
          onClick={() => setActiveTab("Videos")}
          style={{
            backgroundColor: videos.length > 0 ? "#ff4d4f" : "",
            color: videos.length > 0 ? "white" : ""
          }}
        >
          Videos {videos.length > 0 && `(${videos.length})`}
        </button>

        <button
          onClick={() => setActiveTab("Podcasts")}
          style={{
            backgroundColor: podcasts.length > 0 ? "#ff4d4f" : "",
            color: podcasts.length > 0 ? "white" : ""
          }}
        >
          Podcasts {podcasts.length > 0 && `(${podcasts.length})`}
        </button>

        <button
          onClick={() => setActiveTab("Articles")}
          style={{
            backgroundColor: articles.length > 0 ? "#ff4d4f" : "",
            color: articles.length > 0 ? "white" : ""
          }}
        >
          Articles {articles.length > 0 && `(${articles.length})`}
        </button>
      </div>

      {loading && <p style={{ color: "gray" }}>Searching...</p>}

      {/* ================= VIDEOS ================= */}
      {activeTab === "Videos" && (
        <div className="episodes-grid">
          {videos.map((v) => {
            const thumb =
              getX(v?.extra, "thumbnailPath", "ThumbnailPath") ||
              getX(v?.extra, "coverImagePath", "CoverImagePath");

            const src = thumb ? `${API_BASE}${thumb}` : null;

            return (
              <article key={v.id} className="episode-card">
                {v.premium && <span className="premium-badge">Premium</span>}

                {src && (
                  <img
                    src={src}
                    alt={v.title}
                    className="episode-cover"
                    onClick={() => navigate(`/videos/${v.id}`)}
                  />
                )}

                <div className="episode-content">
                  <h3>{v.title}</h3>

                  {v.category && (
                    <p className="episode-meta">Category: {v.category}</p>
                  )}

                  {v.createdAt && (
                    <p className="episode-meta">
                      Uploaded: {formatDate(v.createdAt)}
                    </p>
                  )}

                  <button
                    className="play-btn"
                    onClick={() => navigate(`/videos/${v.id}`)}
                  >
                    Play
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* ================= PODCASTS ================= */}
      {activeTab === "Podcasts" && (
        <div className="episodes-grid">
          {podcasts.map((ep) => {
            const cover = getX(ep?.extra, "coverImagePath", "CoverImagePath");
            const dur = getX(ep?.extra, "duration", "Duration");

            return (
              <article key={ep.id} className="episode-card">
                {ep.premium && <span className="premium-badge">Premium</span>}

                {cover && (
                  <img
                    src={`${API_BASE}${cover}`}
                    alt={ep.title}
                    className="episode-cover"
                  />
                )}

                <div className="episode-content">
                  <h3>{ep.title}</h3>

                  {dur && (
                    <p className="episode-meta">
                      Duration: {formatDuration(dur)}
                    </p>
                  )}

                  {ep.category && (
                    <p className="episode-meta">Category: {ep.category}</p>
                  )}

                  <button
                    className="play-btn"
                    onClick={() => navigate(`/podcast/${ep.id}`)}
                  >
                    Play
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* ================= ARTICLES ================= */}
      {activeTab === "Articles" && (
        <div className="episodes-grid">
          {articles.map((a) => {
            return (
              <article key={a.id} className="episode-card">
                {a.premium && <span className="premium-badge">Premium</span>}

                <div className="episode-content">
                  <h3>{a.title}</h3>

                  {a.category && (
                    <p className="episode-meta">Category: {a.category}</p>
                  )}

                  {a.createdAt && (
                    <p className="episode-meta">
                      Uploaded: {formatDate(a.createdAt)}
                    </p>
                  )}

                  <button
                    className="play-btn"
                    onClick={() => navigate(`/articles/${a.id}`)}
                  >
                    Read
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}