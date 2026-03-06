import React, { useEffect, useState, useContext, useRef } from "react";
import { useParams /*, Link*/ } from "react-router-dom";
import "./PodcastPlayer.css";
import { UserContext } from "../../context/userContext.jsx";
import Modal from "../../components/Modal.jsx";

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
  error:   (msg) => (window.toast?.error ? window.toast.error(msg)   : console.error("[error]", msg)),
  info:    (msg) => (window.toast?.info ? window.toast.info(msg)     : console.log("[info]", msg)),
};

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

/* ---------- Relative date formatter (YouTube-like: "13 years ago") ---------- */
function formatRelativeDate(iso) {
  try {
    const d = new Date(iso);
    if (isNaN(d)) return "—";
    const now = new Date();
    const diff = Math.max(0, now - d);
    const sec = Math.floor(diff / 1000);
    const min = Math.floor(sec / 60);
    const hr  = Math.floor(min / 60);
    const day = Math.floor(hr / 24);
    const mon = Math.floor(day / 30);
    const yr  = Math.floor(day / 365);
    const unit = (n, s) => `${n} ${s}${n !== 1 ? "s" : ""} ago`;
    if (yr  >= 1) return unit(yr,  "year");
    if (mon >= 1) return unit(mon, "month");
    if (day >= 1) return unit(day, "day");
    if (hr  >= 1) return unit(hr,  "hour");
    if (min >= 1) return unit(min, "minute");
    return unit(sec, "second");
  } catch {
    return "—";
  }
}

export default function PodcastPlayer() {
  const { id } = useParams();
  const { user } = useContext(UserContext);

  const [episode, setEpisode] = useState(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [loading, setLoading] = useState(true);

  // Engagement
  const [likes, setLikes] = useState(0);
  const [liked, setLiked] = useState(false);
  const [views, setViews] = useState(0);

  // Follow creator
  const [subscribed, setSubscribed] = useState(false);
  const [creatorId, setCreatorId] = useState(null);

  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");

  // view register guard + timer (10s rule)
  const [viewRegistered, setViewRegistered] = useState(false);
  const viewTimerRef = useRef(null);

  // Admin-guard modal
  const [guardModal, setGuardModal] = useState({ open: false, action: "" });

  const token = getToken();
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

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

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);

        // Fetch podcast
        const response = await fetch(`${API_BASE}/api/v1/podcast/${id}`);
        if (response.ok) {
          const podcastData = await response.json();
          setEpisode(podcastData);
          if (podcastData.filePath) {
            setAudioUrl(`${API_BASE}${podcastData.filePath}`);
          }
          if (podcastData?.createdByUserId) setCreatorId(podcastData.createdByUserId);
        } else {
          setEpisode(null);
        }

        // Engagement summary (creator info + like status/counters + views)
        const summary = await fetchJsonOrError(`${API_BASE}/api/v1/engagement/podcast/${id}`, {
          headers: { ...authHeaders },
        });
        setLikes(summary?.likes ?? 0);
        setLiked(!!summary?.likedByCurrentUser);
        setSubscribed(!!summary?.subscribedToCreatorByCurrentUser);
        setViews(extractViews(summary));
        if (!creatorId && summary?.creatorUserId) setCreatorId(summary.creatorUserId);

        // Comments
        const page = await fetchJsonOrError(
          `${API_BASE}/api/v1/engagement/podcast/${id}/comments?limit=50`,
          { headers: { ...authHeaders } }
        );
        setComments(page?.items ?? []);
      } catch (err) {
        console.error("Error loading podcast or engagement:", err);
        toast.error(err.message || "Failed to load podcast engagement");
      } finally {
        setLoading(false);
      }
    }
    load();

    // cleanup timers on unmount or id change
    return () => {
      if (viewTimerRef.current) {
        clearTimeout(viewTimerRef.current);
        viewTimerRef.current = null;
      }
      setViewRegistered(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  // === View counting with 10s threshold ===
  const handlePlay = () => {
    if (viewRegistered) return;
    if (!token) return; // backend requires auth
    if (viewTimerRef.current) return; // already running

    viewTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/engagement/podcast/${id}/views`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({ watchedSeconds: 10 }),
        });

        if (res.status === 204 || res.status === 201 || res.status === 200) {
          setViewRegistered(true);
          // Re-fetch summary to sync accurate views
          try {
            const summary = await fetchJsonOrError(`${API_BASE}/api/v1/engagement/podcast/${id}`, {
              headers: { ...authHeaders },
            });
            setViews(extractViews(summary));
          } catch {}
        } else if (res.status === 403) {
          setViewRegistered(true);
        }
      } catch (err) {
        console.warn("Register podcast view failed:", err);
      } finally {
        if (viewTimerRef.current) {
          clearTimeout(viewTimerRef.current);
          viewTimerRef.current = null;
        }
      }
    }, 10000); // 10 seconds
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
      toast.info("Please log in to like this podcast.");
      return;
    }
    try {
      if (!liked) {
        const res = await fetch(`${API_BASE}/api/v1/engagement/podcast/${id}/likes`, {
          method: "POST",
          headers: { ...authHeaders },
        });
        if (res.status === 201 || res.status === 204) {
          setLiked(true);
          setLikes((n) => n + (res.status === 201 ? 1 : 0));
          toast.success("Liked the podcast");
        }
      } else {
        const res = await fetch(`${API_BASE}/api/v1/engagement/podcast/${id}/likes`, {
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
      toast.info("Please log in to subscribe to this creator.");
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

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (blockIfAdminOnOwn("comment")) return;

    if (!token) {
      toast.info("Please log in to post a comment.");
      return;
    }
    const body = (newComment || "").trim();
    if (!body) {
      toast.info("Comment cannot be empty.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/v1/engagement/podcast/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ body }),
      });
      if (res.status === 201) {
        setNewComment("");
        const page = await fetchJsonOrError(
          `${API_BASE}/api/v1/engagement/podcast/${id}/comments?limit=50`,
          { headers: { ...authHeaders } }
        );
        setComments(page?.items ?? []);
        toast.success("Comment posted");
      }
    } catch (err) {
      toast.error(err.message || "Failed to post comment");
    }
  };

  if (!episode) {
    return <p className="not-found">Podcast not found or loading...</p>;
  }

  /* NEW: pull the cover image path (same as Podcast.jsx cards) */
  const coverUrl = episode?.coverImagePath ? `${API_BASE}${episode.coverImagePath}` : "";

  return (
    <div className="podcast-page-root">
      <div className="podcast-wrapper">
        {/* LEFT column: main card */}
        <main className="podcast-main">
          <div className="player-fullpage">
            {loading ? (
              <p>Loading podcast...</p>
            ) : (
              <>
                {/* COVER IMAGE — main media canvas (like YouTube video area) */}
                {coverUrl && (
                  <img
                    src={coverUrl}
                    alt={`${episode.title} cover`}
                    className="player-cover"
                    loading="eager"
                  />
                )}

                {/* AUDIO CONTROL — sits below the cover, left aligned */}
                {audioUrl ? (
                  <audio
                    key={audioUrl}
                    className="player-audio"
                    controls
                    controlsList="nodownload"
                    src={audioUrl}
                    onError={(e) => console.error("Audio error:", e)}
                    crossOrigin="anonymous"
                    onPlay={handlePlay}
                    onPause={handlePauseOrEnded}
                    onEnded={handlePauseOrEnded}
                  />
                ) : (
                  <p>No audio file available.</p>
                )}
              </>
            )}

            {/* INFO: Title above uploader row (YouTube-like) */}
            <div className="player-info">
              <h2>{episode.title}</h2>

              <div className="uploader-row">
                <div className="uploader-avatar" aria-hidden="true">🎧</div>
                <div className="uploader-meta">
                  <div className="uploader-name">
                    {episode.createdBy || episode.uploaderName || "Creator"}
                  </div>
                  {/* <div className="uploader-subs">7.04M subscribers</div> */}
                </div>
                <button
                  onClick={handleSubscribe}
                  className={subscribed ? "subscribed-btn uploader-sub-btn" : "subscribe-btn uploader-sub-btn"}
                  type="button"
                >
                  {subscribed ? "Subscribed" : "Subscribe"}
                </button>
              </div>

              <div className="watch-meta">
                <span className="watch-views">{Number(views || 0).toLocaleString()} views</span>
                {episode.createdAt && (
                  <>
                    <span className="dot-sep">•</span>
                    <span
                      className="watch-date"
                      title={new Date(episode.createdAt).toLocaleString()}
                    >
                      {formatRelativeDate(episode.createdAt)}
                    </span>
                  </>
                )}
              </div>

              {episode.description && <p className="player-description">{episode.description}</p>}
            </div>

            <div className="engagement">
              <button onClick={handleLike}>
                {liked ? "💖" : "🤍"} Likes {likes}
              </button>
            </div>

            <div className="comments-section">
              <h3>Comments</h3>
              <form onSubmit={handleAddComment} className="comment-form">
                <input
                  type="text"
                  placeholder="Add a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                />
                <button type="submit">Post</button>
              </form>
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
        </main>

        {/* RIGHT column reserved for future “Next Episodes” if needed */}
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