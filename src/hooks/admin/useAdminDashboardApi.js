// src/hooks/admin/useAdminDashboardApi.js
import { useEffect, useState, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5275";

// Normalize token: strip any "Bearer " prefix
function toJwt(raw) {
  if (!raw) return "";
  const t = String(raw).trim();
  return t.startsWith("Bearer ") ? t.slice(7) : t;
}

// Headers with Authorization
function authHeaders(json = true) {
  const raw = localStorage.getItem("token");
  const jwt = toJwt(raw);
  const h = {};
  if (jwt) h.Authorization = `Bearer ${jwt}`;
  if (json) h["Content-Type"] = "application/json";
  return h;
}

// Fetch helpers
async function getJson(path, params) {
  const url = new URL(`${API_BASE}${path}`);
  if (params && typeof params === "object") {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    });
  }
  const res = await fetch(url.toString(), { headers: authHeaders(false) });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function postNoBody(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: authHeaders(false),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `${res.status} ${res.statusText}`);
  }
}

async function del(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers: authHeaders(false),
  });
  if (!res.ok && res.status !== 204) {
    const body = await res.text();
    throw new Error(body || `${res.status} ${res.statusText}`);
  }
}

// Map server DTOs -> UI shape
function mapSummaryItemsToEngagement(items) {
  return (items || []).map((e) => ({
    id: e.id,
    type: e.type,
    title: e.title,
    category: e.category || "Uncategorized",
    createdAt: e.createdAt || "N/A",
    likes: e.likes,
    commentsCount: e.comments,
    subscriptions: e.subscriptions,
    views: e.views,
  }));
}

function mapCommentsToFeedbackRows(rows) {
  return (rows || []).map((r, index) => ({
    videoId: r.contentId,       // keep key name stable for UI
    videoTitle: r.contentTitle,
    type: r.contentType,        // "Video" | "Article" | "Podcast"
    index,                      // local display index
    username: r.username,
    text: r.body,
    reviewed: !!r.isReviewed,
    commentId: r.commentId,     // real id for actions
  }));
}

export default function useAdminDashboardApi() {
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  const [engagement, setEngagement] = useState([]);
  const [totals, setTotals]         = useState({ views:0, likes:0, comments:0, subscriptions:0 });
  const [topContent, setTopContent] = useState([]);

  const [feedbackRows, setFeedbackRows] = useState([]);
  const [reviewedMap, setReviewedMap]   = useState({});

  const [growth, setGrowth] = useState({ labels: [], counts: [] });

  // Initial load: summary + first comments page
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        setError(null);

        // 1) Summary
        const summary = await getJson("/api/v1/engagement/admin/summary", { type: "All" });
        if (!mounted) return;

        const eng = mapSummaryItemsToEngagement(summary.items);
        setEngagement(eng);
        setTotals({
          views: summary.totalViews,
          likes: summary.totalLikes,
          comments: summary.totalComments,
          subscriptions: summary.totalSubscriptions,
        });
        setTopContent(mapSummaryItemsToEngagement(summary.topContent));

        // 2) Comments
        const commentsPage = await getJson("/api/v1/engagement/admin/comments", { limit: 100 });
        if (!mounted) return;

        const rows = mapCommentsToFeedbackRows(commentsPage.items);
        setFeedbackRows(rows);

        const rmap = {};
        rows.forEach((r) => {
          rmap[`${r.videoId}_${r.commentId}`] = r.reviewed;
        });
        setReviewedMap(rmap);
      } catch (e) {
        setError(e);
        console.error("AdminDashboard load error:", e);
        window.toast?.error(e?.message || "Failed to load Admin Dashboard data.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  // Actions
  async function handleMarkReviewed(row) {
    const key = `${row.videoId}_${row.commentId}`;
    // optimistic
    setReviewedMap((prev) => ({ ...prev, [key]: true }));
    setFeedbackRows((rows) => rows.map((r) => (r.commentId === row.commentId ? { ...r, reviewed: true } : r)));
    try {
      await postNoBody(`/api/v1/engagement/admin/comments/${row.commentId}/review`);
      window.toast?.success("Marked as reviewed.");
    } catch (e) {
      // revert on error
      setReviewedMap((prev) => ({ ...prev, [key]: false }));
      setFeedbackRows((rows) => rows.map((r) => (r.commentId === row.commentId ? { ...r, reviewed: false } : r)));
      window.toast?.error(e?.message || "Failed to mark reviewed.");
      throw e;
    }
  }

  async function handleDeleteComment(row) {
    const id = row.commentId;
    const vid = row.videoId;
    const prevRows = feedbackRows;
    // optimistic
    setFeedbackRows((rows) => rows.filter((r) => r.commentId !== id));
    setReviewedMap((prev) => {
      const clone = { ...prev };
      delete clone[`${vid}_${id}`];
      return clone;
    });
    setEngagement((eng) =>
      eng.map((e) => (e.id === vid ? { ...e, commentsCount: Math.max(0, e.commentsCount - 1) } : e))
    );
    try {
      await del(`/api/v1/engagement/comments/${id}`);
      window.toast?.success("Comment deleted.");
    } catch (e) {
      // revert on error
      setFeedbackRows(prevRows);
      window.toast?.error(e?.message || "Failed to delete comment.");
      throw e;
    }
  }

  // Growth: call server and store series (memoized to prevent identity changes)
  const fetchGrowth = useCallback(async (metric = "views", weeks = 12) => {
    const series = await getJson("/api/v1/engagement/admin/growth", { metric, weeks });
    setGrowth(series);
    return series;
  }, []); // setGrowth is stable; getJson is module-scoped and stable

  return {
    loading, error,
    engagement, totals, topContent,
    feedbackRows, reviewedMap,
    handleMarkReviewed, handleDeleteComment,
    growth, fetchGrowth,
  };
}