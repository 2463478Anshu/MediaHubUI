import React, { useState, useEffect, useContext, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import "./videoPage.css";
import { UserContext } from "../../context/userContext.jsx";
import Modal from "../../components/Modal.jsx";

/** API base */
const API_BASE = "http://localhost:5275";

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

// Safe toast helper
const toast = {
  success: (msg) => (window.toast?.success ? window.toast.success(msg) : console.log("[success]", msg)),
  error:   (msg) => (window.toast?.error ? window.toast.error(msg)   : console.error("[error]", msg)),
  info:    (msg) => (window.toast?.info ? window.toast.info(msg)     : console.log("[info]", msg)),
};

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

export default function VideoPage() {
  const { id } = useParams(); // contentId (Guid)
  const { user } = useContext(UserContext);

  const [video, setVideo] = useState(null);
  const [otherVideos, setOtherVideos] = useState([]);

  // Engagement state (+ views)
  const [likes, setLikes] = useState(0);
  const [liked, setLiked] = useState(false);
  const [views, setViews] = useState(0);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");

  // Subscribe is creator-based
  const [subscribed, setSubscribed] = useState(false);
  const [creatorId, setCreatorId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewRegistered, setViewRegistered] = useState(false);

  // timer ref for 10s watch threshold
  const viewTimerRef = useRef(null);

  // Admin-guard modal
  const [guardModal, setGuardModal] = useState({ open: false, action: "" });

  const token = getToken();
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  // helper to read views from summary safely
  function extractViews(summary) {
    if (!summary || typeof summary !== "object") return 0;
    return summary.views ?? summary.viewCount ?? summary.viewsCount ?? 0;
  }

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

  // Load video + engagement (+ views)
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);

        // 1) Video
        const res = await fetch(`${API_BASE}/api/v1/video/${id}`);
        if (res.ok) {
          const v = await res.json();
          setVideo(v);
          if (v?.createdByUserId) setCreatorId(v.createdByUserId);
        } else {
          setVideo(null);
        }

        // 2) Other videos
        const allRes = await fetch(`${API_BASE}/api/v1/video`);
        if (allRes.ok) {
          const allVideos = await allRes.json();
          setOtherVideos(allVideos.filter((v) => String(v.id ?? v.Id) !== id));
        }

        // 3) Engagement summary
        const summary = await fetchJsonOrError(`${API_BASE}/api/v1/engagement/video/${id}`, {
          headers: { ...authHeaders },
        });
        setLikes(summary?.likes ?? 0);
        setLiked(!!summary?.likedByCurrentUser);
        setSubscribed(!!summary?.subscribedToCreatorByCurrentUser);
        setViews(extractViews(summary));
        if (!creatorId && summary?.creatorUserId) setCreatorId(summary.creatorUserId);

        // 4) Comments page 1
        const page = await fetchJsonOrError(
          `${API_BASE}/api/v1/engagement/video/${id}/comments?limit=50`,
          { headers: { ...authHeaders } }
        );
        setComments(page?.items ?? []);
      } catch (err) {
        console.error("Load video or engagement failed:", err);
        toast.error(err.message || "Failed to load video engagement");
      } finally {
        setLoading(false);
      }
    }
    load();

  // cleanup timers
    return () => {
      if (viewTimerRef.current) {
        clearTimeout(viewTimerRef.current);
        viewTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  if (loading || !video) return <p>Loading video...</p>;

  // === View counting with 10s threshold ===
  const handlePlay = () => {
    if (viewRegistered) return;
    if (!token) return;
    if (viewTimerRef.current) return;

    viewTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/engagement/video/${id}/views`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({ watchedSeconds: 10 }),
        });

        if (res.status === 204 || res.status === 201 || res.status === 200) {
          setViewRegistered(true);
          try {
            const summary = await fetchJsonOrError(`${API_BASE}/api/v1/engagement/video/${id}`, {
              headers: { ...authHeaders },
            });
            setViews(extractViews(summary));
          } catch {}
        } else if (res.status === 403) {
          setViewRegistered(true);
        }
      } catch (err) {
        console.warn("Register view failed:", err);
      } finally {
        if (viewTimerRef.current) {
          clearTimeout(viewTimerRef.current);
          viewTimerRef.current = null;
        }
      }
    }, 10000);
  };

  const handlePauseOrEnded = () => {
    if (viewTimerRef.current) {
      clearTimeout(viewTimerRef.current);
      viewTimerRef.current = null;
    }
  };

  const handleLike = async () => {
    if (blockIfAdminOnOwn("like")) return;

    if (!token) {
      toast.info("Please log in to like this video.");
      return;
    }
    try {
      if (!liked) {
        const res = await fetch(`${API_BASE}/api/v1/engagement/video/${id}/likes`, {
          method: "POST",
          headers: { ...authHeaders },
        });
        if (res.status === 201 || res.status === 204) {
          setLiked(true);
          setLikes((n) => n + (res.status === 201 ? 1 : 0));
          toast.success("Liked the video");
        }
      } else {
        const res = await fetch(`${API_BASE}/api/v1/engagement/video/${id}/likes`, {
          method: "DELETE",
          headers: { ...authHeaders },
        });
        if (res.ok || res.status === 204) {
          setLiked(false);
          setLikes((n) => Math.max(0, n - 1));
          toast.info("Removed like");
        }
      }
    } catch (err) {
      toast.error(err.message || "Failed to toggle like");
    }
  };

  const handleSubscribe = async () => {
    if (blockIfAdminOnOwn("subscribe")) return;

    if (!token) {
      toast.info("Please log in to subscribe to the creator.");
      return;
    }
    if (!creatorId) {
      toast.error("Creator information not available yet. Please try again in a moment.");
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
          toast.success("Subscribed to the creator");
        }
      } else {
        const res = await fetch(`${API_BASE}/api/v1/creators/${creatorId}/subscriptions`, {
          method: "DELETE",
          headers: { ...authHeaders },
        });
        if (res.ok || res.status === 204) {
          setSubscribed(false);
          toast.info("Unsubscribed from the creator");
        }
      }
    } catch (err) {
      toast.error(err.message || "Failed to toggle subscription");
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
      const res = await fetch(`${API_BASE}/api/v1/engagement/video/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ body }),
      });
      if (res.status === 201) {
        setNewComment("");
        const page = await fetchJsonOrError(
          `${API_BASE}/api/v1/engagement/video/${id}/comments?limit=50`,
          { headers: { ...authHeaders } }
        );
        setComments(page?.items ?? []);
        toast.success("Comment posted");
      }
    } catch (err) {
      toast.error(err.message || "Failed to post comment");
    }
  };

  return (
    <div className="video-page-root">
      <div className="video-wrapper">
        {/* Main video */}
        <div className="video-main">
          <video
            className="video-player"
            controls
            src={`${API_BASE}${video.filePath}`}
            onPlay={handlePlay}
            onPause={handlePauseOrEnded}
            onEnded={handlePauseOrEnded}
          />
          <h2 className="video-title">{video.title}</h2>
          {video.category && <p className="video-category">Category: {video.category}</p>}
          {/* Views and date */}
          <p className="video-date">{Number(views || 0).toLocaleString()} views</p>
          <p className="video-date">Uploaded on {video.createdAt}</p>

          {/* Engagement Section */}
          <div className="video-engagement">
            <button className="video-like-btn" onClick={handleLike}>
              {liked ? "💖" : "🤍"} Likes {likes}
            </button>
            <button
              onClick={handleSubscribe}
              className={subscribed ? "video-subscribed-btn" : "video-subscribe-btn"}
            >
              {subscribed ? "Subscribed" : "Subscribe"}
            </button>
          </div>

          {/* Comments Section */}
          <div className="video-comments">
            <h3 className="comments-title">Comments</h3>
            <div className="comment-form">
              <input
                className="comment-input"
                type="text"
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
              />
              <button className="comment-post-btn" onClick={handleAddComment}>
                Post
              </button>
            </div>
            <ul className="comments-list">
              {comments.map((c) => (
                <li key={c.commentId} className="comment-item">
                  <div className="comment-avatar">👤</div>
                  <div className="comment-text">
                    <strong>{c.authorName || c.userId}</strong>: {c.body}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Next Videos Section */}
        <div className="video-next">
          <h3 className="next-title">Next Videos</h3>
          <div className="next-grid">
            {otherVideos.map((v) => (
              <div key={v.id} className="next-card">
                <Link to={`/videos/${v.id}`} className="next-link">
                  <video className="next-video" src={`${API_BASE}${v.filePath}`} />
                  <p className="next-label">{v.title}</p>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Admin-guard Modal */}
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