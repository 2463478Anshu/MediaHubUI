import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { FaRegHeart } from "react-icons/fa";
import Popup from "reactjs-popup";
import "reactjs-popup/dist/index.css";
import "./SearchResults.css";

/* ========= IndexedDB ========= */
const DB_NAME = "media-store";
const DB_VERSION = 1;
const STORE_NAME = "files";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getBlobRecord(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function openPdfFromIndexedDB(id) {
  const record = await getBlobRecord(id);
  if (record?.blob) {
    const url = URL.createObjectURL(record.blob);
    window.open(url, "_blank", "noopener,noreferrer");
  } else {
    alert("Failed to load PDF from storage.");
  }
}

/* ========= Utils ========= */
function formatDuration(totalSeconds) {
  if (totalSeconds == null || isNaN(Number(totalSeconds))) return null;
  const t = Number(totalSeconds);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/* ========= Main Component ========= */
export default function SearchResults() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const category = (params.get("category") || "").trim();

  // Tabs: "Videos" | "Podcasts" | "Articles"
  const [activeTab, setActiveTab] = useState("Videos");
  const [loading, setLoading] = useState(true);

  // Results
  const [videos, setVideos] = useState([]);     // { id, title, url, category, description }
  const [podcasts, setPodcasts] = useState([]); // { id, title, coverUrl, description, duration, tags, category, createdAt }
  const [articles, setArticles] = useState([]); // enriched with views, likes, liked, comments

  // Blob URL cleanup
  const urlsRef = useRef([]);

  // User context (consistent with your Articles code)
  const userId = localStorage.getItem("user") || "guest";
  const loggedInFlag = localStorage.getItem("loggedIn") === "true";
  const isLoggedIn = loggedInFlag && userId !== "guest";
  const displayUser = "Admin";

  // Load and filter all three types by category
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      // Revoke previous URLs
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      urlsRef.current = [];

      try {
        const saved = localStorage.getItem("mediaItems");
        const all = JSON.parse(saved || "[]");
        const needle = category.toLowerCase();

        // Split & filter by category
        const vidsRaw = all.filter(
          (x) =>
            String(x?.type || "").toLowerCase() === "video" &&
            x?.category &&
            String(x.category).toLowerCase().includes(needle)
        );
        const podsRaw = all.filter(
          (x) =>
            String(x?.type || "").toLowerCase() === "podcast" &&
            x?.category &&
            String(x.category).toLowerCase().includes(needle)
        );
        const artsRaw = all.filter(
          (x) =>
            String(x?.type || "").toLowerCase() === "article" &&
            x?.category &&
            String(x.category).toLowerCase().includes(needle)
        );

        // Resolve video blobs
        const vidsResolved = await Promise.all(
          vidsRaw.map(async (v) => {
            const rec = await getBlobRecord(v.id);
            if (rec?.blob) {
              const url = URL.createObjectURL(rec.blob);
              urlsRef.current.push(url);
              return { ...v, url };
            }
            return null;
          })
        );

        // Podcast covers: prefer localStorage (publishing flow) then coverImage
        const podsResolved = podsRaw.map((p) => {
          const key = `pod_${String(p.id)}__cover`;
          let coverUrl = "";
          try {
            coverUrl = localStorage.getItem(key) || "";
          } catch {
            coverUrl = "";
          }
          return { ...p, coverUrl: coverUrl || p.coverImage || "" };
        });

        // Articles: enrich with engagement state from localStorage
        const artsResolved = artsRaw.map((a) => {
          const savedViews = localStorage.getItem(`views-${a.id}`);
          const savedLikes = localStorage.getItem(`likes-${a.id}`);
          const savedLiked = localStorage.getItem(`liked-${a.id}-${userId}`);
          const savedComments = localStorage.getItem(`comments-${a.id}`);
          const desc = a.description || a.excerpt || a.content || "";
          return {
            ...a,
            excerpt: a.fileName || (desc ? desc.slice(0, 100) : ""),
            views: savedViews ? parseInt(savedViews, 10) : 0,
            likes: savedLikes ? parseInt(savedLikes, 10) : 0,
            liked: savedLiked === "true",
            comments: savedComments ? JSON.parse(savedComments) : [],
          };
        });

        if (!cancelled) {
          setVideos(vidsResolved.filter(Boolean));
          setPodcasts(podsResolved);
          setArticles(artsResolved);
        }
      } catch (e) {
        console.error("Search results load failed:", e);
        if (!cancelled) {
          setVideos([]);
          setPodcasts([]);
          setArticles([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      urlsRef.current = [];
    };
  }, [category, userId]);

  /* ==== Articles engagement (same behavior as your Articles page) ==== */
  function logEvent(articleId, type) {
    const key = `eventlog_${articleId}`;
    const current = JSON.parse(localStorage.getItem(key) || "[]");
    current.push({ type, user: userId, ts: Date.now() });
    localStorage.setItem(key, JSON.stringify(current));
  }

  const handleArticleView = (id) => {
    const alreadyViewed = localStorage.getItem(`viewed-${id}-${userId}`);
    if (!alreadyViewed) {
      setArticles((prev) =>
        prev.map((a) => {
          if (a.id === id) {
            const newViews = a.views + 1;
            localStorage.setItem(`views-${id}`, newViews);
            localStorage.setItem(`viewed-${id}-${userId}`, "true");
            return { ...a, views: newViews };
          }
          return a;
        })
      );
    }
    logEvent(id, "views");
  };

  const handleArticleLike = (id) => {
    if (!isLoggedIn) {
      alert("Please log in to like this article.");
      return;
    }
    setArticles((prev) =>
      prev.map((a) => {
        if (a.id === id) {
          let newLikes = a.likes;
          const newLiked = !a.liked;
          if (newLiked) {
            newLikes++;
            localStorage.setItem(`likes-${id}`, String(newLikes));
            localStorage.setItem(`liked-${id}-${userId}`, "true");
            logEvent(id, "likes");
          } else {
            newLikes--;
            localStorage.setItem(`likes-${id}`, String(newLikes));
            localStorage.setItem(`liked-${id}-${userId}`, "false");
            // Remove most recent like event for this user
            const logKey = `eventlog_${id}`;
            const log = JSON.parse(localStorage.getItem(logKey) || "[]");
            const updatedLog = log.filter(
              (ev, i, arr) =>
                !(ev.type === "likes" && ev.user === userId && i === arr.length - 1)
            );
            localStorage.setItem(logKey, JSON.stringify(updatedLog));
          }
          return { ...a, liked: newLiked, likes: newLikes };
        }
        return a;
      })
    );
  };

  const handleArticleComment = (id, text) => {
    if (!isLoggedIn) {
      alert("Please log in to comment.");
      return;
    }
    if (!text.trim()) return;
    setArticles((prev) =>
      prev.map((a) => {
        if (a.id === id) {
          const updatedComments = [...a.comments, `Anonymous: ${text.trim()}`];
          localStorage.setItem(`comments-${id}`, JSON.stringify(updatedComments));
          return { ...a, comments: updatedComments };
        }
        return a;
      })
    );
    logEvent(id, "comment");
  };

  /* ==== Render ==== */
  return (
    <div className="srp">
      <header className="srp-header">
        <h1 className="srp-title">
          Results for category: <span className="srp-accent">{category || "—"}</span>
        </h1>

        {/* Tabs (like Google Search) */}
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

      {!category ? (
        <p className="srp-muted">
          Tip: Provide a category in the URL, e.g. <code>?category=music</code>
        </p>
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
      ) : (
        <>
          {/* ===== Videos ===== */}
          {activeTab === "Videos" && (
            <section className="srp-section" aria-label="Videos">
              {videos.length === 0 ? (
                <div className="srp-empty">No videos found for this category.</div>
              ) : (
                <ul className="srp-grid" role="list">
                  {videos.map((v) => (
                    <li key={v.id} className="video-card" role="listitem">
                      <Link to={`/videos/${v.id}`} className="card-link" aria-label={`Open video: ${v.title || "Untitled"}`}>
                        <div className="video-wrap">
                          <video
                            className="video-el"
                            src={v.url}
                            preload="metadata"
                            controls
                            playsInline
                            muted
                          />
                        </div>
                      </Link>

                      <div className="video-meta">
                        <div className="avatar" aria-hidden="true">
                          <div className="avatar-fallback">{displayUser.slice(0, 1).toUpperCase()}</div>
                        </div>
                        <div className="video-texts">
                          <h3 className="card-title">
                            <Link to={`/videos/${v.id}`} className="title-link">
                              {v.title || "Untitled"}
                            </Link>
                          </h3>
                          <div className="sub">
                            <span className="channel">{displayUser}</span>
                            {v.category && (
                              <>
                                <span className="dot">•</span>
                                <span className="category">{v.category}</span>
                              </>
                            )}
                          </div>
                          {v.description && (
                            <p className="desc" title={v.description}>
                              {v.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* ===== Podcasts ===== */}
          {activeTab === "Podcasts" && (
            <section className="srp-section" aria-label="Podcasts">
              {podcasts.length === 0 ? (
                <div className="srp-empty">No podcasts found for this category.</div>
              ) : (
                <ul className="srp-grid" role="list">
                  {podcasts.map((ep) => (
                    <li key={ep.id} className="pod-card" role="listitem">
                      {(ep.coverUrl || ep.coverImage) && (
                        <img
                          className="pod-cover"
                          src={ep.coverUrl || ep.coverImage}
                          alt={`${ep.title || "Podcast"} cover`}
                          loading="lazy"
                        />
                      )}
                      <div className="pod-body">
                        <h3 className="card-title">{ep.title || "Untitled"}</h3>
                        {ep.description && <p className="desc">{ep.description}</p>}
                        <div className="sub">
                          {ep.duration != null && (
                            <span className="badge">Duration: {formatDuration(ep.duration)}</span>
                          )}
                          {Array.isArray(ep.tags) && ep.tags.length > 0 && (
                            <span className="badge">Tags: {ep.tags.join(", ")}</span>
                          )}
                          {ep.category && <span className="badge">Category: {ep.category}</span>}
                        </div>
                        <Link to={`/podcast/${ep.id}`} className="btn">Play</Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* ===== Articles ===== */}
          {activeTab === "Articles" && (
            <section className="srp-section" aria-label="Articles">
              {articles.length === 0 ? (
                <div className="srp-empty">No articles found for this category.</div>
              ) : (
                <ul className="srp-grid" role="list">
                  {articles.map((article) => (
                    <li key={article.id} className="art-card" role="listitem">
                      <div className="art-body">
                        <h3 className="card-title">{article.title || "Untitled"}</h3>
                        {article.createdAt && <p className="date">{article.createdAt}</p>}
                        {article.excerpt && <p className="desc">{article.excerpt}</p>}

                        <button
                          className="view-pdf-btn"
                          onClick={() => {
                            handleArticleView(article.id);
                            if (article.hasBlob && article.fileName?.endsWith(".pdf")) {
                              openPdfFromIndexedDB(article.id);
                            } else if (article.content) {
                              alert("This article has text content only, not a PDF.");
                            } else {
                              alert("No PDF available for this article.");
                            }
                          }}
                        >
                          View PDF
                        </button>

                        <div className="article-engagement">
                          <p className="metric">Views: {article.views}</p>
                          <button
                            className={`like-btn ${article.liked ? "liked" : ""}`}
                            onClick={() => handleArticleLike(article.id)}
                            title={article.liked ? "Unlike" : "Like"}
                          >
                            <FaRegHeart /> {article.likes}
                          </button>

                          <Popup
                            trigger={<button className="view-comments-btn">Comments</button>}
                            modal
                            nested
                            contentClassName="popup-content"
                            overlayStyle={{ backdropFilter: "blur(5px)" }}
                          >
                            {(close) => (
                              <div className="comments-popup">
                                <h3>Comments for {article.title}</h3>
                                <div className="comments-feed">
                                  {article.comments.map((c, i) => (
                                    <div key={i} className="comment-card">
                                      <div className="comment-avatar">👤</div>
                                      <div className="comment-body">
                                        <p className="comment-text">{c}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                <input
                                  type="text"
                                  placeholder="Add a comment..."
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      handleArticleComment(article.id, e.target.value);
                                      e.target.value = "";
                                    }
                                  }}
                                />
                                <button onClick={close}>Close</button>
                              </div>
                            )}
                          </Popup>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
