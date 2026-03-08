// src/pages/SearchResults.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import "./SearchResults.css";

// Base URL for the backend
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5275";

/** Small fetch helper with timeout + friendly network errors */
async function fetchWithTimeout(input, init = {}, ms = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(input, { ...init, signal: controller.signal });
    const ct = res.headers.get("content-type") || "";
    const text = await res.text();

    if (!res.ok) {
      let message = `Request failed (${res.status})`;
      try {
        if (ct.includes("application/json") && text) {
          const pd = JSON.parse(text);
          message = pd?.detail || pd?.title || pd?.message || message;
        } else if (text) {
          message = text;
        }
      } catch {
        if (text) message = text;
      }
      throw new Error(message);
    }

    if (!text) return null;
    return ct.includes("application/json") ? JSON.parse(text) : text;
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error("Request timed out. Please check your network and try again.");
    }
    if (err instanceof TypeError) {
      throw new Error("Unable to reach server. Please try again later.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Optional: duration formatter for podcasts (seconds -> H:MM:SS / M:SS) */
function formatDuration(totalSeconds) {
  if (totalSeconds == null || isNaN(Number(totalSeconds))) return null;
  const t = Number(totalSeconds);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Helper to read extra fields robustly (camelCase first, PascalCase fallback) */
const getX = (obj, ...keys) => {
  for (const k of keys) {
    if (obj && obj[k] != null) return obj[k];
  }
  return undefined;
};

export default function SearchResults() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);

  // Full‑text query (title/description/content)
  const q = (params.get("q") || "").trim();
  // Optional strict category filter (?category=Education|News|...)
  const category = (params.get("category") || "").trim();

  const [activeTab, setActiveTab] = useState("Videos");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [videos, setVideos] = useState([]);     // items where type === "video"
  const [podcasts, setPodcasts] = useState([]); // items where type === "podcast"
  const [articles, setArticles] = useState([]); // items where type === "article"

  // Debounce & abort for smooth UX
  const DEBOUNCE_MS = 350;
  const debounceTimer = useRef(null);
  const inFlight = useRef(null);

  // Build server query string
  const queryStr = useMemo(() => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (category) sp.set("category", category);
    sp.set("type", "all");            // search all types; tabs split client-side
    sp.set("page", "1");
    sp.set("pageSize", "50");
    sp.set("sortBy", "createdAt");
    sp.set("sortDir", "desc");
    return sp.toString();
  }, [q, category]);

  useEffect(() => {
    if (!q && !category) {
      setVideos([]); setPodcasts([]); setArticles([]); setError("");
      return;
    }

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    setLoading(true);
    setError("");

    const run = async () => {
      if (inFlight.current) inFlight.current.abort();
      const ac = new AbortController();
      inFlight.current = ac;

      try {
        // NOTE: API path is /api/v1/Search (case-insensitive on ASP.NET)
        const data = await fetchWithTimeout(
          `${API_BASE}/api/v1/Search?${queryStr}`,
          { method: "GET", signal: ac.signal },
          20000
        );

        const items = Array.isArray(data?.items) ? data.items : [];
        const v = [], p = [], a = [];
        for (const it of items) {
          if (it.type === "video") v.push(it);
          else if (it.type === "podcast") p.push(it);
          else if (it.type === "article") a.push(it);
        }
        setVideos(v);
        setPodcasts(p);
        setArticles(a);
      } catch (err) {
        setError(err?.message || "Search failed.");
        setVideos([]); setPodcasts([]); setArticles([]);
      } finally {
        setLoading(false);
      }
    };

    debounceTimer.current = setTimeout(run, DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (inFlight.current) inFlight.current.abort();
    };
  }, [q, category, queryStr]);

  return (
    <div className="srp">
      <header className="srp-header">
        <h1 className="srp-title">
          Results
          {q ? <> for: <span className="srp-accent">{q}</span></> : null}
          {category ? <> &nbsp;in <span className="srp-accent">{category}</span></> : null}
          {!q && !category ? <span className="srp-accent"> —</span> : null}
        </h1>

        {/* Tabs */}
        <nav className="srp-tabs" aria-label="Search result types">
          <button
            className={`srp-tab ${activeTab === "Videos" ? "active" : ""}`}
            onClick={() => setActiveTab("Videos")}
            aria-pressed={activeTab === "Videos"}
          >
            Videos
          </button>
          <button
            className={`srp-tab ${activeTab === "Podcasts" ? "active" : ""}`}
            onClick={() => setActiveTab("Podcasts")}
            aria-pressed={activeTab === "Podcasts"}
          >
            Podcasts
          </button>
          <button
            className={`srp-tab ${activeTab === "Articles" ? "active" : ""}`}
            onClick={() => setActiveTab("Articles")}
            aria-pressed={activeTab === "Articles"}
          >
            Articles
          </button>
        </nav>
      </header>

      {/* States */}
      {!q && !category ? (
        <p className="srp-muted">Type in the search bar (min 2 characters) or use a category filter to begin.</p>
      ) : loading ? (
        <div className="srp-skeleton-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div className="srp-skeleton-card" key={i}>
              <div className="srp-skeleton-media" />
              <div className="srp-skeleton-lines">
                <div className="sr-line" />
                <div className="sr-line short" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="srp-empty">{error}</div>
      ) : (
        <>
          {/* ===== Videos ===== */}
          {activeTab === "Videos" && (
            <section className="srp-section" aria-label="Videos">
              {videos.length === 0 ? (
                <div className="srp-empty">No videos found.</div>
              ) : (
                <ul className="srp-grid" role="list">
                  {videos.map((v) => {
                    const src =
                      getX(v?.extra, "filePath", "FilePath") ||
                      ""; // safe fallback
                    return (
                      <li key={v.id} className="video-card" role="listitem">
                        <Link
                          to={`/videos/${v.id}`}
                          className="card-link"
                          aria-label={`Open video: ${v.title || "Untitled"}`}
                        >
                          <div className="video-wrap">
                            <video
                              className="video-el"
                              src={src}
                              preload="metadata"
                              controls
                              playsInline
                              muted
                            />
                          </div>
                        </Link>
                        <div className="video-meta">
                          <div className="video-texts">
                            <h3 className="card-title">
                              <Link to={`/videos/${v.id}`} className="title-link">
                                {v.title || "Untitled"}
                              </Link>
                            </h3>
                            <div className="sub">
                              {v.category && <span className="category">{v.category}</span>}
                              {v.premium ? <span className="badge premium">Premium</span> : <span className="badge free">Free</span>}
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          {/* ===== Podcasts ===== */}
          {activeTab === "Podcasts" && (
            <section className="srp-section" aria-label="Podcasts">
              {podcasts.length === 0 ? (
                <div className="srp-empty">No podcasts found.</div>
              ) : (
                <ul className="srp-grid" role="list">
                  {podcasts.map((ep) => {
                    const cover = getX(ep?.extra, "coverImagePath", "CoverImagePath");
                    const desc  = getX(ep?.extra, "description", "Description");
                    const dur   = getX(ep?.extra, "duration", "Duration");
                    return (
                      <li key={ep.id} className="pod-card" role="listitem">
                        {cover && (
                          <img
                            className="pod-cover"
                            src={cover}
                            alt={`${ep.title || "Podcast"} cover`}
                            loading="lazy"
                          />
                        )}
                        <div className="pod-body">
                          <h3 className="card-title">{ep.title || "Untitled"}</h3>
                          {desc && <p className="desc">{desc}</p>}
                          <div className="sub">
                            {dur != null && (
                              <span className="badge">Duration: {formatDuration(dur)}</span>
                            )}
                            {ep.category && <span className="badge">Category: {ep.category}</span>}
                            {ep.premium ? <span className="badge premium">Premium</span> : <span className="badge free">Free</span>}
                          </div>
                          <Link to={`/podcast/${ep.id}`} className="btn">Play</Link>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          {/* ===== Articles ===== */}
          {activeTab === "Articles" && (
            <section className="srp-section" aria-label="Articles">
              {articles.length === 0 ? (
                <div className="srp-empty">No articles found.</div>
              ) : (
                <ul className="srp-grid" role="list">
                  {articles.map((a) => {
                    const fileName = getX(a?.extra, "fileName", "FileName");
                    const isText   = !!getX(a?.extra, "content", "Content");
                    const pdfUrl = fileName ? `${API_BASE}/uploads/articles/${encodeURIComponent(fileName)}` : "";
                    return (
                      <li key={a.id} className="art-card" role="listitem">
                        <div className="art-body">
                          <h3 className="card-title">{a.title || "Untitled"}</h3>
                          {a.createdAt && (
                            <p className="date">
                              {new Date(a.createdAt).toLocaleString()}
                            </p>
                          )}
                          <div className="sub">
                            {a.category && <span className="badge">Category: {a.category}</span>}
                            {a.premium ? <span className="badge premium">Premium</span> : <span className="badge free">Free</span>}
                          </div>

                          <div className="art-actions">
                            {pdfUrl ? (
                              <a
                                className="view-pdf-btn"
                                href={pdfUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Open PDF
                              </a>
                            ) : isText ? (
                              <span className="desc">Text article</span>
                            ) : (
                              <span className="desc">No file available</span>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}