// src/pages/profile/EditProfile.jsx
import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom"; // ⬅️ new
import { UserContext } from "../../context/userContext.jsx";
import "./EditProfile.css";
import Spinner from "../Spinner.jsx";
import "../Spinner.css";
import Modal from "../../components/Modal.jsx"; // ⬅️ modal
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5275";

export default function EditProfile() {
  const navigate = useNavigate(); // ⬅️ new
  // Expect token+user from context, but DO NOT redirect from here
  const { user, setUser, token } = useContext(UserContext);

  const [name, setName] = useState(user?.name || user?.FullName || "");
  const [username, setUsername] = useState(user?.username || user?.UserName || "");
  const [location, setLocation] = useState(user?.location || user?.Location || "");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  // success modal toggle
  const [showSavedModal, setShowSavedModal] = useState(false);

  // Helper: get safe Bearer header (fallback to localStorage)
  const getBearer = () => {
    const t = token || localStorage.getItem("token") || "";
    if (!t) return "";
    return t.startsWith("Bearer ") ? t : `Bearer ${t}`;
  };

  // Load latest profile from server (no redirect if token missing)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setError("");
      setInfo("");
      setLoading(true);

      try {
        const bearer = getBearer();
        if (!bearer) {
          setInfo("You appear to be logged out. Please log in to edit your profile.");
          return;
        }

        const res = await fetch(`${API_BASE}/api/auth/me`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: bearer,
          },
        });

        if (res.status === 401) {
          setError("Your session has expired or is invalid. Please log in again.");
          return;
        }
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || "Failed to load profile");
        }

        const me = await res.json();
        if (cancelled) return;

        setName(me.fullName ?? me.FullName ?? "");
        setUsername(me.userName ?? me.UserName ?? "");
        setLocation(me.location ?? me.Location ?? "");

        const normalized = {
          id: me.userId || me.UserId,
          name: me.fullName || me.FullName || "",
          username: me.userName || me.UserName || "",
          email: me.email || me.Email || "",
          role: me.role || me.Role || "",
          location: me.location || me.Location || "",
          loggedIn: true,
        };
        setUser?.(normalized);
      } catch (err) {
        console.error(err);
        setError(err.message || "Unable to load profile.");
        window.toast?.error(err.message || "Unable to load profile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, setUser]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setInfo("");

    try {
      const bearer = getBearer();
      if (!bearer) {
        const msg = "You are not logged in. Please log in to save changes.";
        setError(msg);
        window.toast?.error(msg);
        return;
      }

      const payload = {
        fullName: name,
        userName: username,
        location: location,
      };

      const res = await fetch(`${API_BASE}/api/auth/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: bearer,
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        const msg = "Your session has expired. Please log in again to save changes.";
        setError(msg);
        window.toast?.error(msg);
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to update profile");
      }

      const updated = await res.json();

      const normalized = {
        id: updated.userId || updated.UserId,
        name: updated.fullName || updated.FullName || "",
        username: updated.userName || updated.UserName || "",
        email: updated.email || updated.Email || "",
        role: updated.role || updated.Role || "",
        location: updated.location || updated.Location || "",
        loggedIn: true,
      };

      setUser?.(normalized);

      window.toast?.success("Profile updated!");
      setShowSavedModal(true);
    } catch (err) {
      console.error(err);
      const msg = err.message || "Failed to save changes.";
      setError(msg);
      window.toast?.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="edit-profile">
      <div className="edit-profile__container">
        {/* ⬇⬇ NEW: cross (×) button same as Login page */}
        <button
          type="button"
          className="signup-close-btn"
          aria-label="Go to home"
          title="Go to home"
          onClick={() => navigate("/profile", { replace: true })}
        >
          ×
        </button>

        <h1 className="edit-profile__title">Edit Profile</h1>

        {info && <div className="edit-profile__info">{info}</div>}
        {error && (
          <div className="edit-profile__error" role="alert">
            {error}
          </div>
        )}

        {loading ? (
          <div className="edit-profile__loading">Loading profile…</div>
        ) : (
          <form className="edit-profile__form" onSubmit={handleSave}>
            <div className="edit-profile__group">
              <label className="edit-profile__label">Name:</label>
              <input
                className="edit-profile__input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                required
              />
            </div>

            <div className="edit-profile__group">
              <label className="edit-profile__label">Username:</label>
              <input
                className="edit-profile__input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                required
              />
            </div>

            <div className="edit-profile__group">
              <label className="edit-profile__label">Location:</label>
              <input
                className="edit-profile__input"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Enter your location"
              />
            </div>

            <div className="edit-profile__actions">
              <button type="submit" className="edit-profile__button" disabled={saving}>
                {saving ? (
                  <>
                    <Spinner size={18} />&nbsp;Saving…
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Success Modal */}
      <Modal
        open={showSavedModal}
        onClose={() => setShowSavedModal(false)}
        icon="success"
        title="Saved"
        message="Your profile changes have been saved successfully."
        primaryText="Great"
        onPrimary={() => setShowSavedModal(false)}
      />
    </main>
  );
}