// Publishing.jsx
import React, { useState } from "react";
import "./publishing.css";
import Modal from "./Modal.jsx";
import ToastStack from "./ToastStack.jsx";

/** --- API base for backend integration --- */
const API_BASE = "http://localhost:5275";

/** Build public URL for PDFs saved under wwwroot/uploads/articles */
const articlePdfUrl = (fileName) =>
  fileName ? `${API_BASE}/uploads/articles/${encodeURIComponent(fileName)}` : "";

/* ------------------------------------------------------------------ */
/* ----------------- Helpers: auth, identity, fetch ------------------ */
/* ------------------------------------------------------------------ */

/** Returns true if value looks like a GUID */
function isGuid(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value)
  );
}

/** Try to read the admin/user id from localStorage.user.id, user.UserId, or JWT (token) */
function getUploaderId() {
  // 1) From localStorage "user"
  try {
    const raw = localStorage.getItem("user");
    if (raw) {
      const u = JSON.parse(raw);
      const id = u?.id || u?.UserId || u?.userId;
      if (isGuid(id)) return id;
    }
  } catch {
    // ignore
  }

  // 2) From JWT token payload (common claim: sub or nameidentifier)
  try {
    const token = localStorage.getItem("token");
    if (token && token.split(".").length === 3) {
      const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      const json = JSON.parse(atob(base64));
      const candidate =
        json?.sub ||
        json?.nameid ||
        json?.nameidentifier ||
        json?.["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"];
      if (isGuid(candidate)) return candidate;
    }
  } catch {
    // ignore
  }

  return ""; // not found or invalid
}

/** Try to read uploader name from localStorage user.name or JWT 'name' */
function getUploaderName() {
  // 1) From localStorage "user"
  try {
    const raw = localStorage.getItem("user");
    if (raw) {
      const u = JSON.parse(raw);
      const name = u?.name || u?.Name || u?.fullName || u?.FullName || u?.username;
      if (name && typeof name === "string") return name;
    }
  } catch {
    // ignore
  }

  // 2) From JWT token payload (OpenID 'name' or fallback)
  try {
    const token = localStorage.getItem("token");
    if (token && token.split(".").length === 3) {
      const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      const json = JSON.parse(atob(base64));
      const name =
        json?.name ||
        json?.given_name ||
        json?.preferred_username ||
        json?.["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"] ||
        "";
      if (name && typeof name === "string") return name;
    }
  } catch {
    // ignore
  }

  return "";
}

/** Read bearer token from localStorage (if present) */
function getToken() {
  try {
    const token = localStorage.getItem("token");
    return token && token.split(".").length === 3 ? token : "";
  } catch {
    return "";
  }
}

/** SAFE fetch: read response ONCE, JSON-parse if possible, throw friendly Error on !ok */
async function fetchJsonOrError(input, init) {
  const res = await fetch(input, init);
  const contentType = res.headers.get("content-type") || "";
  const text = await res.text(); // single read

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

/* ------------------------------------------------------------------ */
/* ---------------------------- Component ---------------------------- */
/* ------------------------------------------------------------------ */

const Publishing = () => {
  const [selectedType, setSelectedType] = useState(null);

  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState(""); // podcast only
  const [tags, setTags] = useState(""); // (not used by server yet)
  const [files, setFiles] = useState([]);
  const [content, setContent] = useState(""); // article text (optional)
  const [dbError, setDbError] = useState("");
  const [category, setCategory] = useState("");
  const [premium, setPremium] = useState(false);
  const [coverFile, setCoverFile] = useState(null);

  // Modal state (success/error/info)
  const [modal, setModal] = useState({
    open: false,
    icon: "success",
    title: "",
    message: "",
  });

  const handleFileChange = (e) => {
    const chosenFiles = Array.from(e.target.files || []);
    setFiles(chosenFiles);
  };

  /** Submit handler */
  const addItem = async (e) => {
    e.preventDefault();
    setDbError("");

    // Guards
    if (!title.trim()) {
      setDbError("Title is required.");
      window.toast?.error?.("Title is required.");
      return;
    }
    if (!category) {
      setDbError("Category is required.");
      window.toast?.error?.("Category is required.");
      return;
    }
    if (selectedType === "Article" && files.length === 0 && !content.trim()) {
      setDbError("Please enter content or upload a PDF.");
      window.toast?.error?.("Please enter content or upload a PDF.");
      return;
    }

    // Preserve and clear
    const prevTitle = title;
    const prevDescription = description;
    const prevCategory = category;
    const prevPremium = premium;
    const prevContent = content;
    const prevCover = coverFile;

    setTitle("");
    setDescription("");
    setTags("");
    setContent("");
    setFiles([]);
    setCoverFile(null);

    // Resolve uploader id & name now (from localStorage user or JWT)
    const uploaderId = getUploaderId();
    const uploaderName = getUploaderName();
    const token = getToken();

    let uploadedCount = 0;
    let failedCount = 0;

    try {
      if (files && files.length > 0) {
        for (const f of files) {
          if (selectedType === "Podcast") {
            // --- Podcast: send to backend (one request per audio file) ---
            try {
              const form = new FormData();
              form.append("Title", prevTitle.trim());
              form.append("Description", (prevDescription || "").trim());
              form.append("Category", prevCategory);
              form.append("Premium", String(!!prevPremium));
              form.append("File", f); // MUST be "File"
              if (prevCover) form.append("CoverImage", prevCover); // MUST be "CoverImage"

              await fetchJsonOrError(`${API_BASE}/api/v1/podcast`, {
                method: "POST",
                body: form, // DO NOT set Content-Type manually
                headers: {
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                  ...(isGuid(uploaderId) ? { "X-User-Id": uploaderId } : {}),
                  ...(uploaderName ? { "X-User-Name": uploaderName } : {}),
                },
              });

              uploadedCount++;
              window.toast?.success?.(`Podcast uploaded: ${f.name}`);
            } catch (err) {
              failedCount++;
              console.error(err);
              const msg = (err && err.message) || "Failed to upload podcast to server.";
              setDbError(msg);
              window.toast?.error?.(msg);
            }
          } else if (selectedType === "Article") {
            // --- Article: server upload (PDF per request) ---
            try {
              const form = new FormData();
              form.append("Title", prevTitle.trim());
              form.append("Category", prevCategory);
              form.append("Premium", String(!!prevPremium));
              form.append("File", f); // PDF
              if (prevContent && prevContent.trim()) {
                form.append("Content", prevContent.trim());
              }

              await fetchJsonOrError(`${API_BASE}/api/v1/article`, {
                method: "POST",
                body: form,
                headers: {
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                  ...(isGuid(uploaderId) ? { "X-User-Id": uploaderId } : {}),
                  ...(uploaderName ? { "X-User-Name": uploaderName } : {}),
                },
              });

              uploadedCount++;
              window.toast?.success?.(`Article uploaded: ${f.name}`);
            } catch (err) {
              failedCount++;
              console.error(err);
              const msg = (err && err.message) || "Failed to upload article to server.";
              setDbError(msg);
              window.toast?.error?.(msg);
            }
          } else if (selectedType === "Video") {
            // --- Video: server upload (one request per video file) ---
            try {
              const form = new FormData();
              form.append("Title", prevTitle.trim());
              form.append("Category", prevCategory);
              form.append("Premium", String(!!prevPremium));
              form.append("File", f); // MUST be "File"

              await fetchJsonOrError(`${API_BASE}/api/v1/video`, {
                method: "POST",
                body: form, // don't set Content-Type manually
                headers: {
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                  ...(isGuid(uploaderId) ? { "X-User-Id": uploaderId } : {}),
                  ...(uploaderName ? { "X-User-Name": uploaderName } : {}),
                },
              });

              uploadedCount++;
              window.toast?.success?.(`Video uploaded: ${f.name}`);
            } catch (err) {
              failedCount++;
              console.error(err);
              const msg = (err && err.message) || "Failed to upload video to server.";
              setDbError(msg);
              window.toast?.error?.(msg);
            }
          }
        }
      } else if (prevContent.trim()) {
        if (selectedType === "Article") {
          // --- Article: text-only server create ---
          try {
            const form = new FormData();
            form.append("Title", prevTitle.trim());
            form.append("Category", prevCategory);
            form.append("Premium", String(!!prevPremium));
            form.append("Content", prevContent.trim());

            await fetchJsonOrError(`${API_BASE}/api/v1/article`, {
              method: "POST",
              body: form,
              headers: {
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(isGuid(uploaderId) ? { "X-User-Id": uploaderId } : {}),
                ...(uploaderName ? { "X-User-Name": uploaderName } : {}),
              },
            });

            uploadedCount++;
            window.toast?.success?.(`Article created (text only).`);
          } catch (err) {
            failedCount++;
            console.error(err);
            const msg = (err && err.message) || "Failed to create text article on server.";
            setDbError(msg);
            window.toast?.error?.(msg);
          }
        } else {
          // Other content types don't support text-only
          const msg = "Please upload a file for this content type.";
          setDbError(msg);
          window.toast?.error?.(msg);
        }
      } else {
        const msg = "Please provide content or upload a file";
        setDbError(msg);
        window.toast?.error?.(msg);
      }
    } finally {
      // Show a concise modal summary after attempts
      if (uploadedCount > 0 || failedCount > 0) {
        const title =
          failedCount === 0
            ? "Upload complete"
            : uploadedCount === 0
            ? "Upload failed"
            : "Upload partially complete";

        const icon =
          failedCount === 0 ? "success" : uploadedCount === 0 ? "error" : "info";

        const plural = uploadedCount === 1 ? "" : "s";
        const failureNote = failedCount ? ` • Failed: ${failedCount}` : "";

        setModal({
          open: true,
          icon,
          title,
          message: `${uploadedCount} ${selectedType || "item"}${plural} uploaded${failureNote}.`,
        });
      }
    }
  };

  return (
    <div className="create-container">
      {/* Toasts at page level */}
      <ToastStack />

      {/* Result modal */}
      <Modal
        open={modal.open}
        onClose={() => setModal((m) => ({ ...m, open: false }))}
        icon={modal.icon}
        title={modal.title}
        message={modal.message}
        primaryText="OK"
        autoCloseMs={1800}
      />

      <h2>Upload Content</h2>

      {/* Type tabs */}
      <div className="cards-grid">
        <button type="button" onClick={() => setSelectedType("Video")}>
          Video
        </button>
        <button type="button" onClick={() => setSelectedType("Article")}>
          Article
        </button>
        <button type="button" onClick={() => setSelectedType("Podcast")}>
          Podcast
        </button>
      </div>

      {dbError && <div style={{ color: "crimson", marginTop: 8 }}>{dbError}</div>}

      {selectedType && (
        <>
          {/* FORM */}
          <form className="form-container" onSubmit={addItem}>
            <h3>Upload {selectedType}</h3>

            <label>
              Title:
              <br />
              <textarea
                className="textarea"
                placeholder="Add Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <br />
            <br />

            <label>
              Category:
              <br />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="dropdown"
              >
                <option value="">Select category</option>
                <option value="Entertainment">Entertainment</option>
                <option value="Education">Education</option>
                <option value="Sports">Sports</option>
                <option value="News">News</option>
                <option value="Other">Other</option>
              </select>
            </label>
            <br />
            <br />

            <label>
              Free / Premium:
              <br />
              <select
                name="premium"
                id="premium"
                value={premium ? "true" : "false"}
                onChange={(e) => setPremium(e.target.value === "true")}
                className="dropdown"
              >
                <option value="false">Free</option>
                <option value="true">Premium</option>
              </select>
            </label>

            <br />
            <br />

            {selectedType === "Video" && (
              <input type="file" accept="video/*" multiple onChange={handleFileChange} />
            )}

            {selectedType === "Podcast" && (
              <>
                <label>
                  Description:
                  <br />
                  <textarea
                    className="textarea"
                    rows={3}
                    cols={40}
                    placeholder="Add Description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </label>

                <input type="file" accept="audio/*" multiple onChange={handleFileChange} />

                <br />
                <label>
                  Cover image (PNG/JPG/WebP):
                  <br />
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={(e) => {
                      const f = (e.target.files && e.target.files[0]) ? e.target.files[0] : null;
                      setCoverFile(f);
                    }}
                  />
                </label>
              </>
            )}

            {selectedType === "Article" && (
              <>
                <input type="file" accept="application/pdf" multiple onChange={handleFileChange} />
                <br />
                <br />
                <label>
                  Content (optional if PDF uploaded):
                  <br />
                  <textarea
                    className="textarea"
                    rows={5}
                    placeholder="Write article content here (or upload a PDF)"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                </label>
              </>
            )}

            <br />
            <br />
            <button className="submit-btn" type="submit">
              Save {selectedType}
            </button>
          </form>

          {/* NOTE:
              The list of saved items and delete buttons are intentionally removed
              from the publishing page. Manage deletion from the Media Library page.
           */}
        </>
      )}
    </div>
  );
};

export default Publishing;