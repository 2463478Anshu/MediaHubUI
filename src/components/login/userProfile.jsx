import { useContext, useEffect, useMemo, useState } from "react";
import { UserContext } from "../../context/userContext.jsx";
import { useNavigate, useLocation } from "react-router-dom";
import "./UserProfile.css";
import Spinner from "../Spinner.jsx";
import "../Spinner.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5275";

export default function UserProfile({ setLoggedIn }) {
  const { user, token, logout } = useContext(UserContext);
  const navigate = useNavigate();
  const location = useLocation();

  const [loggingOut, setLoggingOut] = useState(false);

  // Subscription API states
  const [subLoading, setSubLoading] = useState(false);
  const [subError, setSubError] = useState("");
  const [currentSub, setCurrentSub] = useState(null);

  const from = location.state?.from || "/";

  // Be robust to user.role vs user.Role and odd casing/spacing.
  const isAdmin = useMemo(() => {
    const role = (user?.role ?? user?.Role ?? "").toString().trim().toLowerCase();
    return role === "admin";
  }, [user?.role, user?.Role]);

  // Fetch current subscription (robust to 204/empty body)
  useEffect(() => {
    // Only fetch if logged in and token is available
    if (!user?.loggedIn || !token) {
      setCurrentSub(null);
      return;
    }

    let cancelled = false;

    const fetchCurrentSubscription = async () => {
      setSubLoading(true);
      setSubError("");

      try {
        const res = await fetch(`${API_BASE}/api/subscription/me/current`, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          let msg = "Unable to fetch current subscription.";
          const t = await res.text();
          try {
            const j = t ? JSON.parse(t) : null;
            msg = j?.message || msg;
          } catch {
            // ignore parse failure
          }
          throw new Error(msg);
        }

        // ✅ SAFE parsing even if body is empty (204 or empty 200)
        const raw = await res.text();
        const data = raw ? JSON.parse(raw) : null;

        if (!cancelled) {
          setCurrentSub(data); // null => no active subscription
        }
      } catch (err) {
        console.error("Subscription fetch error:", err);
        if (!cancelled) {
          setSubError(err?.message || "Unable to fetch current subscription.");
        }
      } finally {
        if (!cancelled) setSubLoading(false);
      }
    };

    fetchCurrentSubscription();

    return () => {
      cancelled = true;
    };
  }, [user?.loggedIn, token]);

  const handleLogout = async () => {
    const confirmLogout = window.confirm("Are you sure you want to logout?");
    if (!confirmLogout || loggingOut) return;

    try {
      setLoggingOut(true);

      // 1) Call backend logout (server will derive user from token)
      const response = await fetch(`${API_BASE}/api/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        // No body needed; server uses JWT claims
        body: null,
      });

      // Accept 204 as success
      if (!response.ok && response.status !== 204) {
        // Attempt to read error detail
        let detail = "";
        try {
          detail = await response.text();
        } catch {
          /* ignore */
        }
        throw new Error(
          `Backend logout failed${detail ? `: ${detail}` : ""} (HTTP ${response.status})`
        );
      }

      // 2) Clear client state
      logout?.(); // clear token + user in context
      setLoggedIn?.(false);

      // 3) Navigate to login
      navigate("/login", {
        replace: true,
        state: { fromLogout: true, from },
      });

      window.toast?.info?.("You have been logged out.");
    } catch (err) {
      console.error("Logout failed:", err);
      // Even if backend fails, clear client session
      logout?.();
      setLoggedIn?.(false);
      navigate("/login", { replace: true, state: { fromLogout: true, from } });

      window.toast?.error?.(
        "Logout hit a server error, but your local session was cleared."
      );
    } finally {
      setLoggingOut(false);
    }
  };

  const fmtDate = (d) => {
    if (!d) return "Not set";
    try {
      return new Date(d).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return d;
    }
  };

  return (
    <main className="profile">
      <div className="profile__container">
        <header className="profile__header">
          <div>
            <h1 className="profile__title">Profile</h1>
            <p className="profile__subtitle">Manage your account</p>
          </div>

          {user?.loggedIn && (
            <span className="profile__badge" title="Logged In">
              <span
                className="dot"
                style={{ width: 8, height: 8, background: "var(--success)", borderRadius: 4 }}
              />
              Logged in
            </span>
          )}
        </header>

        <section className="profile__grid">
          {/* Identity */}
          <article className="profile__card profile__card--accent">
            <h2 className="profile__sectionTitle">
              <span className="dot" /> Identity
            </h2>

            <div className="profile__row">
              <div className="profile__label">Name</div>
              <div className="profile__value">
                {user?.name ?? user?.fullName ?? "Not set"}
              </div>
            </div>

            <div className="profile__row">
              <div className="profile__label">Username</div>
              <div className="profile__value">
                {user?.username ?? user?.userName ?? "Not set"}
              </div>
            </div>

            <div className="profile__row">
              <div className="profile__label">Email</div>
              <div className="profile__value">{user?.email || "Not set"}</div>
            </div>

            <div className="profile__row">
              <div className="profile__label">Location</div>
              <div className="profile__value">
                {user?.location ?? "Not specified"}
              </div>
            </div>

            <div className="profile__actions">
              {/* ✅ Make Edit Profile visible to ALL logged-in users */}
              {user?.loggedIn && (
                <button
                  className="btn btn--primary"
                  onClick={() => navigate("/edit-profile")}
                >
                  Edit Profile
                </button>
              )}

              {/* Admin-only: Admin Dashboard */}
              {isAdmin && (
                <button
                  className="btn btn--primary"
                  onClick={() => navigate("/adminDashboard")}
                >
                  Admin Dashboard
                </button>
              )}

              <button
                type="button"
                className="btn btn--danger"
                onClick={handleLogout}
                disabled={loggingOut}
              >
                {loggingOut ? (
                  <>
                    <Spinner size={18} /> Logging out…
                  </>
                ) : (
                  "Logout"
                )}
              </button>
            </div>
          </article>

          {/* Subscription */}
          {!isAdmin && (
            <article className="profile__card">
              <h2 className="profile__sectionTitle">
                <span className="dot" /> Subscription
              </h2>

              {!user?.loggedIn ? (
                <div className="profile__row">
                  <div className="profile__value profile__mute">
                    Please log in to view subscription.
                  </div>
                </div>
              ) : subLoading ? (
                <div className="profile__row">
                  <div className="profile__value">
                    <Spinner size={18} /> <span style={{ marginLeft: 8 }}>Loading…</span>
                  </div>
                </div>
              ) : subError ? (
                <div className="profile__row">
                  <div className="profile__value profile__mute" role="alert">
                    {subError}
                  </div>
                </div>
              ) : !currentSub ? (
                <>
                  <div className="profile__row">
                    <div className="profile__label">Plan</div>
                    <div className="profile__value">None</div>
                  </div>

                  <div className="profile__actions">
                    <button
                      className="btn btn--primary"
                      onClick={() => navigate("/subscription")}
                    >
                      Browse Plans
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="profile__row">
                    <div className="profile__label">Plan</div>
                    <div className="profile__value">{currentSub.plan}</div>
                  </div>

                  <div className="profile__row">
                    <div className="profile__label">Status</div>
                    <div className="profile__value">{currentSub.status}</div>
                  </div>

                  <div className="profile__row">
                    <div className="profile__label">Start Date</div>
                    <div className="profile__value">
                      {fmtDate(currentSub.startDate)}
                    </div>
                  </div>

                  <div className="profile__row">
                    <div className="profile__label">End Date</div>
                    <div className="profile__value">
                      {fmtDate(currentSub.endDate)}
                    </div>
                  </div>
                </>
              )}
            </article>
          )}
        </section>
      </div>
    </main>
  );
}