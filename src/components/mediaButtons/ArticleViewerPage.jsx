import React, { useEffect, useState, useRef, useContext } from "react";
import { useParams } from "react-router-dom";
import "./ArticleViewerPage.css";
import Modal from "../../components/Modal.jsx";
import { UserContext } from "../../context/userContext.jsx";

const API_BASE = "http://localhost:5275";

// Safe toast helper (no-op if ToastStack not mounted)
const toast = {
  success: (msg) => (window.toast?.success ? window.toast.success(msg) : console.log("[success]", msg)),
  error:   (msg) => (window.toast?.error ? window.toast.error(msg)   : console.error("[error]", msg)),
  info:    (msg) => (window.toast?.info ? window.toast.info(msg)     : console.log("[info]", msg)),
};

// sessionStorage key
const viewStartKey = (id) => `article:viewStart:${id}`;

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
    try { return JSON.parse(text); } catch { return text; }
  }
  return text;
}

// helper: extract views
function extractViews(summary) {
  if (!summary || typeof summary !== "object") return 0;
  return summary.views ?? summary.viewCount ?? summary.viewsCount ?? 0;
}

// ===== Robust helpers based on your UserContext shape =====
const getUserId = (u) => (u?.id ?? u?.userId ?? u?.UserId ?? u?.sub ?? u?.uid ?? null);
const isAdminUser = (u) => {
  const role = (u?.role || "").toString().toLowerCase();
  const roles = Array.isArray(u?.roles) ? u.roles.map((r) => String(r).toLowerCase()) : [];
  return (
    u?.isAdmin === true ||
    role === "admin" ||
    role === "administrator" ||
    roles.includes("admin") ||
    roles.includes("administrator")
  );
};

const NAV_SELECTOR = "#top-nav";

export default function ArticleViewerPage() {
  const { id } = useParams(); // article id (Guid)
  const token = getToken();
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
  const { user } = useContext(UserContext);

  const [article, setArticle] = useState(null);
  const [pdfUrl, setPdfUrl] = useState("");
  const [loading, setLoading] = useState(true);

  // Engagement
  const [likes, setLikes] = useState(0);
  const [liked, setLiked] = useState(false);
  const [views, setViews] = useState(0);

  // Creator follow
  const [creatorId, setCreatorId] = useState(null);
  const [creatorName, setCreatorName] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [creatorSubsCount, setCreatorSubsCount] = useState(0);

  // Comments
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");

  // Fullscreen state + ref to the viewer container
  const viewerBoxRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // View counting (from “Read Article” click): 10s threshold
  const [viewRegistered, setViewRegistered] = useState(false);
  const viewTimerRef = useRef(null);

  // Admin-guard modal
  const [guardModal, setGuardModal] = useState({ open: false, action: "" });

  const userId = getUserId(user);
  const userIsAdmin = isAdminUser(user);
  const isOwnContent = creatorId && userId && String(userId) === String(creatorId);

  const blockIfAdminOnOwn = (actionLabel) => {
    if (userIsAdmin && isOwnContent) {
      setGuardModal({ open: true, action: actionLabel });
      window.toast?.info?.(`You are an admin and cannot ${actionLabel} on your own content.`);
      return true;
    }
    return false;
  };

  // ------------- Load article + summary + comments -------------
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);

        // 1) Load article
        const res = await fetch(`${API_BASE}/api/v1/article/${id}`);
        if (res.ok) {
          const a = await res.json();
          setArticle(a);
          if (a?.fileName) {
            setPdfUrl(`${API_BASE}/uploads/articles/${encodeURIComponent(a.fileName)}`);
          }
          if (a?.createdByUserId) setCreatorId(a.createdByUserId);
        } else {
          setArticle(null);
        }

        // 2) Engagement summary
        try {
          const summary = await fetchJsonOrError(`${API_BASE}/api/v1/engagement/article/${id}`, {
            headers: { ...authHeaders },
          });
          setLikes(summary?.likes ?? 0);
          setLiked(!!summary?.likedByCurrentUser);
          setViews(extractViews(summary));
          setCreatorId((prev) => prev || summary?.creatorUserId || null);
          setCreatorName(summary?.creatorName || "");
          setSubscribed(!!summary?.subscribedToCreatorByCurrentUser);
          setCreatorSubsCount(summary?.creatorSubscribers ?? 0);
        } catch (e) {
          console.warn("[Article] Could not load engagement summary:", e);
        }

        // 3) Comments
        try {
          const page = await fetchJsonOrError(
            `${API_BASE}/api/v1/engagement/article/${id}/comments?limit=50`,
            { headers: { ...authHeaders } }
          );
          setComments(page?.items ?? []);
        } catch (e) {
          console.warn("[Article] Could not load comments:", e);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();

    // Cleanup timer and marker on unmount
    return () => {
      if (viewTimerRef.current) {
        clearTimeout(viewTimerRef.current);
        viewTimerRef.current = null;
      }
      setViewRegistered(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  // ------------- Start/finish 10s window from “Read Article” click -------------
  useEffect(() => {
    if (!token) return;

    const key = viewStartKey(id);
    let startedAt = 0;
    try {
      startedAt = Number(sessionStorage.getItem(key) || 0);
    } catch {
      startedAt = 0;
    }
    if (!startedAt || Number.isNaN(startedAt)) return;

    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(0, 10000 - elapsed); // ms

    viewTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/engagement/article/${id}/views`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({ watchedSeconds: 10 }),
        });

        if ([200, 201, 204].includes(res.status)) {
          setViewRegistered(true);
          try {
            const summary = await fetchJsonOrError(`${API_BASE}/api/v1/engagement/article/${id}`, {
              headers: { ...authHeaders },
            });
            setViews(extractViews(summary));
          } catch {}
        } else if (res.status === 403) {
          setViewRegistered(true);
        }
      } catch (e) {
        console.warn("Register article view failed:", e);
      } finally {
        if (viewTimerRef.current) {
          clearTimeout(viewTimerRef.current);
          viewTimerRef.current = null;
        }
        try { sessionStorage.removeItem(key); } catch {}
      }
    }, remaining);

    return () => {
      if (viewTimerRef.current) {
        clearTimeout(viewTimerRef.current);
        viewTimerRef.current = null;
      }
    };
  }, [id, token]);

  // ---------- UI polish: nav offset ----------
  useEffect(() => {
    const candidates = [NAV_SELECTOR, "header.top-nav", "header[role='banner']"].filter(Boolean);
    const findNav = () => {
      for (const sel of candidates) {
        const el = document.querySelector(sel);
        if (el) return el;
      }
      return null;
    };

    const nav = findNav();
    const setOffset = () => {
      const h = nav?.getBoundingClientRect().height ?? 0;
      document.documentElement.style.setProperty("--navbar-h", `${Math.round(h)}px`);
    };

    setOffset();
    window.addEventListener("resize", setOffset);
    return () => window.removeEventListener("resize", setOffset);
  }, []);

  // ---------- Fullscreen ----------
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    const el = viewerBoxRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      } else {
        if (el.requestFullscreen) await el.requestFullscreen();
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      }
    } catch (e) {
      console.error("Fullscreen error:", e);
      toast.error?.("Could not toggle full screen");
    }
  };

  const handleSubscribe = async () => {
    if (blockIfAdminOnOwn("subscribe")) return;

    if (!token) {
      toast.info("Please log in to subscribe to the creator.");
      return;
    }
    if (!creatorId) {
      toast.error("Creator not available yet. Try again.");
      return;
    }
    try {
      if (!subscribed) {
        const res = await fetch(`${API_BASE}/api/v1/creators/${creatorId}/subscriptions`, {
          method: "POST",
          headers: { ...authHeaders },
        });
        if (res.status === 201 || res.status === 204) {
          setSubscribed(true);
          setCreatorSubsCount((n) => n + (res.status === 201 ? 1 : 0));
          toast.success("Subscribed to the creator");
        }
      } else {
        const res = await fetch(`${API_BASE}/api/v1/creators/${creatorId}/subscriptions`, {
          method: "DELETE",
          headers: { ...authHeaders },
        });
        if (res.ok || res.status === 204) {
          setSubscribed(false);
          setCreatorSubsCount((n) => Math.max(0, n - 1));
          toast.info("Unsubscribed");
        }
      }
    } catch (e) {
      toast.error(e?.message || "Failed to toggle subscription");
    }
  };

  const handleLike = async () => {
    if (blockIfAdminOnOwn("like")) return;

    if (!token) {
      toast.info("Please log in to like this article.");
      return;
    }
    try {
      if (!liked) {
        const res = await fetch(`${API_BASE}/api/v1/engagement/article/${id}/likes`, {
          method: "POST",
          headers: { ...authHeaders },
        });
        if (res.status === 201 || res.status === 204) {
          setLiked(true);
          setLikes((n) => n + (res.status === 201 ? 1 : 0));
          toast.success("Liked the article");
        }
      } else {
        const res = await fetch(`${API_BASE}/api/v1/engagement/article/${id}/likes`, {
          method: "DELETE",
          headers: { ...authHeaders },
        });
        if (res.ok || res.status === 204) {
          setLiked(false);
          setLikes((n) => Math.max(0, n - 1));
          toast.info("Removed like");
        }
      }
    } catch (e) {
      toast.error(e?.message || "Failed to toggle like");
    }
  };

  const handleAddComment = async () => {
    if (blockIfAdminOnOwn("comment")) return;

    if (!token) {
      toast.info("Please log in to comment.");
      return;
    }
    const body = (newComment || "").trim();
    if (!body) {
      toast.info("Comment cannot be empty.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/v1/engagement/article/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ body }),
      });
      if (res.status === 201) {
        setNewComment("");
        const page = await fetchJsonOrError(
          `${API_BASE}/api/v1/engagement/article/${id}/comments?limit=50`,
          { headers: { ...authHeaders } }
        );
        setComments(page?.items ?? []);
        toast.success("Comment posted");
      }
    } catch (e) {
      toast.error(e?.message || "Failed to post comment");
    }
  };

  if (loading || !article) {
    return (
      <div className="article-viewer-root">
        <div className="viewer-wrapper">
          <p>Loading article…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="article-viewer-root">
      <div className="viewer-wrapper">
        {/* Title & Meta */}
        <h1 className="article-title">{article.title}</h1>
        {article.category && <p className="article-subtitle">Category: {article.category}</p>}
        {article.createdAt && <p className="article-date">Published on {article.createdAt}</p>}

        {/* Viewer actions */}
        <div className="viewer-actions">
          <button className="btn" onClick={toggleFullscreen} disabled={!pdfUrl} title={!pdfUrl ? "No PDF available" : ""}>
            {isFullscreen ? "Exit full screen" : "Full screen"}
          </button>
          <button
            className="btn"
            onClick={() => pdfUrl && window.open(`${pdfUrl}#zoom=page-width`, "_blank", "noopener,noreferrer")}
            disabled={!pdfUrl}
            title={!pdfUrl ? "No PDF available" : ""}
          >
            Open in new tab
          </button>
          <a
            className={`btn ${!pdfUrl ? "btn-disabled" : ""}`}
            href={pdfUrl || undefined}
            download
            onClick={(e) => { if(!pdfUrl) e.preventDefault(); }}
            title={!pdfUrl ? "No PDF available" : ""}
          >
            Download
          </a>
          {!pdfUrl && <span className="hint">No PDF attached for this article.</span>}
        </div>

        {/* PDF or text */}
        <div className="viewer-box" ref={viewerBoxRef}>
          {article.content ? (
            pdfUrl ? (
              <iframe title="Article PDF" src={pdfUrl} className="viewer-iframe" />
            ) : (
              <div className="viewer-content">
                <p>{article.content}</p>
              </div>
            )
          ) : pdfUrl ? (
            <iframe title="Article PDF" src={pdfUrl} className="viewer-iframe" />
          ) : (
            <div className="viewer-content"><em>No content found.</em></div>
          )}
        </div>

        {/* Bottom bar: Creator + Subscribe */}
        <div className="creator-bar">
          <div className="creator-info">
            <span className="creator-label">Creator:</span>
            <span className="creator-name">{creatorName || "—"}</span>
            {typeof creatorSubsCount === "number" && (
              <span className="creator-subs">• {creatorSubsCount} subscribers</span>
            )}
          </div>
          <button
            onClick={() => {
              if (!token) return toast.info("Please log in to subscribe to the creator.");
              if (!creatorId) return toast.error("Creator not available yet. Try again.");
              if (blockIfAdminOnOwn("subscribe")) return;
              handleSubscribe();
            }}
            className={subscribed ? "btn-subscribe subscribed" : "btn-subscribe"}
          >
            {subscribed ? "Subscribed" : "Subscribe"}
          </button>
        </div>

        {/* Engagement row — views next to Like */}
        <div className="engagement-row">
          <p className="article-views">
            {Number(views || 0).toLocaleString()} views
          </p>
          <button className="btn-like" onClick={handleLike}>
            {liked ? "💖" : "🤍"} Like {likes}
          </button>
        </div>

        {/* Comments */}
        <div className="comments-section">
          <h3>Comments</h3>
          <div className="comment-form">
            <input
              type="text"
              placeholder="Add a comment…"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
            />
            <button onClick={handleAddComment}>Post</button>
          </div>

          <ul className="comments-list">
            {comments.length === 0 && <li>No comments yet.</li>}
            {comments.map((c) => (
              <li key={c.commentId} className="comment-item">
                <div className="comment-avatar">👤</div>
                <div className="comment-text">
                  <strong>{c.authorName || c.userId}</strong>: {c.body}
                  <div className="comment-date">
                    {new Date(c.createdAt).toLocaleString()}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Admin-guard Modal (same pattern as Login) */}
      <Modal
        open={guardModal.open}
        onClose={() => setGuardModal({ open: false, action: "" })}
        icon="info"
        title="Action not allowed"
        message={`You are an admin and cannot ${guardModal.action} on your own content.`}
        primaryText="OK"
        onPrimary={() => setGuardModal({ open: false, action: "" })}
      />
    </div>
  );
}