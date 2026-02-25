import React, { useContext, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./MediaLibrary.css";
import { UserContext } from "../../context/userContext.jsx";
/** Adjust the import path below if your Modal lives elsewhere */
import Modal from "../../components/Modal.jsx";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5275";

/* ====================== fetch helpers ====================== */
function toJwt(raw) {
  if (!raw) return "";
  const t = String(raw).trim();
  return t.startsWith("Bearer ") ? t.slice(7) : t;
}

function authHeaders(json = false) {
  const raw = localStorage.getItem("token");
  const jwt = toJwt(raw);
  const h = {};
  if (jwt) h.Authorization = `Bearer ${jwt}`;
  if (json) h["Content-Type"] = "application/json";
  return h;
}

async function getJson(path, params) {
  const url = new URL(`${API_BASE}${path}`);
  if (params && typeof params === "object") {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, String(v));
      }
    });
  }
  const res = await fetch(url.toString(), { headers: authHeaders(false) });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `${res.status} ${res.statusText}`);
  }
  return res.json();
}

/** Small helper for DELETE requests (auth only, no API shape changes) */
async function del(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers: authHeaders(false),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `${res.status} ${res.statusText}`);
  }
  return true;
}

function fmtDate(dt) {
  if (!dt) return "N/A";
  try {
    const d = new Date(dt);
    if (isNaN(d.getTime())) return String(dt);
    return d.toLocaleString();
  } catch {
    return String(dt);
  }
}

/* ====================== Component ====================== */
export default function MediaLibrary() {
  const { user } = useContext(UserContext);

  // Data
  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);

  // UX
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Delete confirmation modal state
  const [confirm, setConfirm] = useState({
    open: false,
    item: null,   // the item being deleted
    busy: false,  // while delete request is in-flight
  });

  // Filters
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState("All"); // All | Video | Article | Podcast
  const [categoryFilter, setCategoryFilter] = useState("All");

  // Debounced server fetch whenever filters change
  useEffect(() => {
    let mounted = true;
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);

        // Call admin library endpoint — server scopes to current admin via token
        const dto = await getJson("/api/v1/engagement/admin/library", {
          type: typeFilter,
          q: searchText || undefined,
          category: categoryFilter !== "All" ? categoryFilter : undefined,
          limit: 100,
          after: null,
        });

        if (!mounted) return;

        // Expecting { items: [], nextCursor }
        setItems(Array.isArray(dto?.items) ? dto.items : []);
        setNextCursor(dto?.nextCursor ?? null);
      } catch (e) {
        if (!mounted) return;
        setError(e);
        console.error("MediaLibrary load error:", e);
        window.toast?.error(e?.message || "Failed to load your media library.");
      } finally {
        if (mounted) setLoading(false);
      }
    }, 300); // debounce

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [typeFilter, categoryFilter, searchText]);

  // Build categories from current items
  const categories = useMemo(() => {
    const set = new Set((items || []).map((i) => i.category || "Uncategorized"));
    return ["All", ...Array.from(set)];
  }, [items]);

  const filtered = useMemo(() => (Array.isArray(items) ? items : []), [items]);

  /** Map library item -> backend delete endpoint (no API changes) */
  function deleteEndpointFor(item) {
    if (!item || !item.id) return null;
    const t = item.type;
    if (t === "Article") return `/api/v1/article/${item.id}`;
    if (t === "Podcast") return `/api/v1/podcast/${item.id}`;
    if (t === "Video") return `/api/v1/video/${item.id}`;
    return null;
  }

  /** Open modal for delete */
  function openDeleteModal(item) {
    setConfirm({ open: true, item, busy: false });
  }

  /** Close modal */
  function closeDeleteModal() {
    setConfirm({ open: false, item: null, busy: false });
  }

  /** Delete confirmed (via modal primary action) */
  async function confirmDelete() {
    const item = confirm.item;
    if (!item) return;
    const endpoint = deleteEndpointFor(item);
    if (!endpoint) {
      window.toast?.error?.("Unsupported content type.");
      return;
    }

    try {
      setConfirm((c) => ({ ...c, busy: true }));
      await del(endpoint);

      // Optimistically remove from state
      setItems((prev) => prev.filter((x) => x.id !== item.id));

      window.toast?.success?.(`${item.type} deleted.`);
      closeDeleteModal();
    } catch (e) {
      console.error("Delete failed:", e);
      const msg =
        e?.message?.includes("403") || e?.message?.toLowerCase().includes("forbid")
          ? "You are not allowed to delete this item."
          : e?.message || "Failed to delete item.";
      window.toast?.error?.(msg);
      setConfirm((c) => ({ ...c, busy: false }));
    }
  }

  return (
    <div className="media-library">
      {/* Delete Confirmation Modal */}
      <Modal
        open={confirm.open}
        onClose={confirm.busy ? () => {} : closeDeleteModal}
        icon="error"
        title={
          confirm.item
            ? `Delete ${confirm.item.type}?`
            : "Delete"
        }
        message={
          confirm.item
            ? `Are you sure you want to delete “${confirm.item.title || confirm.item.fileName || confirm.item.id}”?`
            : ""
        }
        secondaryText="Cancel"
        onSecondary={confirm.busy ? () => {} : closeDeleteModal}
        primaryText={confirm.busy ? "Deleting…" : "Delete"}
        onPrimary={confirm.busy ? () => {} : confirmDelete}
      />

      {/* Sidebar */}
      <aside className="media-sidebar">
        <h2 className="media-brand">Admin</h2>
        <div className="media-user">
          <div className="avatar">{(user?.name || "A").charAt(0)}</div>
          <div className="info">
            <div className="name">{user?.name || "Admin"}</div>
            {user?.email && <div className="sub">{user.email}</div>}
          </div>
        </div>
        <nav>
          <Link to="/adminDashboard" className="media-link-btn">
            Admin Dashboard
          </Link>
          <button className="media-nav-btn active" disabled>
            Media Library
          </button>
          <div className="media-divider" />
        </nav>
      </aside>

      {/* Main */}
      <main className="media-content">
        <div className="media-header">
          <h1>Media Library — {user?.name || "Admin"}</h1>
          <div className="actions">{/* Optional: upload button in future */}</div>
        </div>

        {loading && (
          <div className="media-notice" role="status">
            Loading your uploads…
          </div>
        )}
        {error && (
          <div className="media-notice" role="alert">
            <strong>Failed to load:</strong> {String(error.message || error)}
          </div>
        )}

        {/* Filters */}
        <div className="media-filters">
          <input
            type="text"
            placeholder="Search by title, ID, file name or category…"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            aria-label="Search by title, ID, file name or category"
          />
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            {["All", "Video", "Article", "Podcast"].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Grid of cards */}
        <section>
          <h2>Your Uploaded Content</h2>
          {filtered.length === 0 && !loading ? (
            <p className="empty">No media found for your filters.</p>
          ) : (
            <div className="library-grid">
              {filtered.map((m) => {
                const isPremium = m?.premium === true;

                // Use viewPath from server if provided; else fallback by type
                const viewPath =
                  m.viewPath ||
                  (m.type === "Video"
                    ? `/videos/${m.id}`
                    : m.type === "Article"
                    ? `/articles/${m.id}`
                    : `/podcast/${m.id}`);

                return (
                  <div key={m.id} className="library-card">
                    {/* Topline badges */}
                    <div className="library-topline">
                      <span className={`badge type-${m.type}`}>{m.type}</span>
                      <span className="badge">{m.category || "Uncategorized"}</span>
                      {isPremium ? <span className="premium-pill">Premium</span> : ""}
                    </div>

                    {/* Thumbnail placeholder */}
                    <div className="library-thumb">
                      <div className="thumb-fallback">
                        {m.type} • {m.title || m.fileName || m.id}
                      </div>
                    </div>

                    {/* Title & meta */}
                    <div className="library-title">{m.title || `${m.type} ${m.id}`}</div>
                    <div className="library-meta">
                      <span>Created: {fmtDate(m.createdAt)}</span>
                    </div>

                    {/* Snippet for articles */}
                    {m.type === "Article" && (
                      <div className="library-snippet" title={m.fileName || ""}>
                        {m.fileName ? `📄 ${m.fileName}` : m.contentSnippet || "—"}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="library-actions">
                      <Link className="view-link" to={viewPath}>
                        Open
                      </Link>
                      <button
                        className="btn-link"
                        type="button"
                        onClick={() => openDeleteModal(m)}
                        disabled={confirm.busy && confirm.item?.id === m.id}
                        aria-label={`Delete ${m.type}`}
                      >
                        {confirm.busy && confirm.item?.id === m.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Optional: Load more (when you enable server paging with nextCursor) */}
          {nextCursor && !loading && (
            <div style={{ marginTop: "10px" }}>
              <button
                className="media-nav-btn"
                onClick={async () => {
                  try {
                    setLoading(true);
                    const dto = await getJson("/api/v1/engagement/admin/library", {
                      type: typeFilter,
                      q: searchText || undefined,
                      category: categoryFilter !== "All" ? categoryFilter : undefined,
                      limit: 100,
                      after: nextCursor,
                    });
                    const more = Array.isArray(dto?.items) ? dto.items : [];
                    setItems((prev) => [...prev, ...more]);
                    setNextCursor(dto?.nextCursor ?? null);
                  } catch (e) {
                    setError(e);
                    window.toast?.error(e?.message || "Failed to load more items.");
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                Load more
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}