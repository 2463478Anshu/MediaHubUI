import React, { useMemo, useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./videos.css";

/** API base */
const API_BASE = "http://localhost:5275";

/* ----- subscription helpers ----- */
function getUserFromStorage() {
  try { return JSON.parse(localStorage.getItem("user") || "{}"); }
  catch { return {}; }
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

// ---- views helper: tolerate multiple property names from DTO ----
function extractViews(summary) {
  if (!summary || typeof summary !== "object") return 0;
  return (
    summary.views ??
    summary.viewCount ??
    summary.viewsCount ??
    0
  );
}

function VideoCard({ video }) {
  const navigate = useNavigate();
  const [views, setViews] = useState(0);

  function onCardClick(e) {
    const user = getUserFromStorage();
    const isPremium = video?.premium === true;

    if (isPremium && !isActiveSubscription(user)) {
      e.preventDefault();
      e.stopPropagation();
      alert("You need an active subscription to open this premium video.\n\nPlease choose a plan to continue.");
      return;
    }
    navigate(`/videos/${video.id}`);
  }

  // Load views for this card via Engagement Summary
  useEffect(() => {
    let aborted = false;
    async function loadViews() {
      if (!video?.id) return;
      try {
        const res = await fetch(`${API_BASE}/api/v1/engagement/video/${video.id}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!aborted) setViews(extractViews(data));
      } catch (err) {
        // silent fail on cards—don’t block list rendering
        console.warn("Failed to load views for card:", err);
      }
    }
    loadViews();
    return () => { aborted = true; };
  }, [video?.id]);

  return (
    <article className="video-card">
      {video?.premium === true && <span className="premium-badge">Premium</span>}
      <Link to={`/videos/${video.id}`} onClick={onCardClick}>
        <video
          controls
          src={`${API_BASE}${video.filePath}`}
          style={{ maxWidth: "300px" }}
        />
        <h2>{video.title}</h2>
      </Link>
      {video.category && <p className="author">Category: {video.category}</p>}
      {/* Views line */}
      <p className="excerpt">{Number(views || 0).toLocaleString()} views</p>
      {video.createdAt && <p className="excerpt">Uploaded on {video.createdAt}</p>}
    </article>
  );
}

export default function Videos() {
  const [videos, setVideos] = useState([]);

  // Load published videos from backend API
  useEffect(() => {
    async function loadVideos() {
      try {
        const response = await fetch(`${API_BASE}/api/v1/video`);
        if (response.ok) {
          const data = await response.json();
          setVideos(Array.isArray(data) ? data : []);
        } else {
          setVideos([]);
        }
      } catch (err) {
        console.error("Error loading videos from backend:", err);
        setVideos([]);
      }
    }
    loadVideos();
  }, []);

  return (
    <section>
      <h1 className="page-title">VIDEOS</h1>
      {videos.length === 0 && <p style={{ color: "gray" }}>No uploaded videos found.</p>}

      <div className="videos-grid">
        {videos.map((video) => (
          <VideoCard key={video.id} video={video} />
        ))}
      </div>
    </section>
  );
}