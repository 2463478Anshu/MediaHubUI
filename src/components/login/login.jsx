import { useNavigate, useLocation } from "react-router-dom";
import { useState, useContext, useEffect } from "react";
import { UserContext } from "../../context/userContext.jsx";
import "./login.css";
import Spinner from "../Spinner.jsx";
import "../Spinner.css";
import Modal from "../../components/Modal.jsx";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5275";

export default function Login({ setLoggedIn }) {
  const { setUser, setToken } = useContext(UserContext);
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from || "/";

  // 🔹 Controlled state (ensure empty on show)
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");
  const [showLoginSuccess, setShowLoginSuccess] = useState(false);

  // 🔹 ALWAYS clear fields on mount & when coming from logout
  useEffect(() => {
    setEmail("");
    setPassword("");
  }, []);

  useEffect(() => {
    if (location.state?.fromLogout) {
      setEmail("");
      setPassword("");
      // remove the flag so back/forward won't re-trigger
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  // Utility: normalize raw token -> bare JWT string (no "Bearer ")
  const toJwt = (raw) => {
    if (!raw) return "";
    const t = String(raw).trim();
    return t.startsWith("Bearer ") ? t.slice(7) : t;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Login failed. Please check your credentials.");
      }

      const data = await res.json();
      localStorage.setItem("token", data.token);
      const jwt = toJwt(data.token ?? data.Token);
      if (!jwt) throw new Error("No token returned by API.");

      setToken(jwt);

      const normalizedUser = {
        id: data.user?.userId ?? data.User?.UserId,
        name: data.user?.fullName ?? data.User?.FullName ?? "",
        username: data.user?.userName ?? data.User?.UserName ?? "",
        email: data.user?.email ?? data.User?.Email ?? email,
        role: data.user?.role ?? data.User?.Role ?? "user",
        loggedIn: true,
        IsActive: data.user?.isActive ?? data.User?.IsActive ?? 1,
      };

      setUser(normalizedUser);
      localStorage.setItem("user", JSON.stringify(normalizedUser));
      localStorage.setItem("loggedIn", "true");
      setLoggedIn?.(true);

      window.toast?.success("Logged in successfully!");
      setShowLoginSuccess(true);
    } catch (error) {
      console.error("Login error:", error);
      const msg = error?.message || "Unable to login at the moment. Please try again.";
      setError(msg);
      window.toast?.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-container login-page">
      <form
        className="login-form"
        onSubmit={handleSubmit}
        aria-labelledby="login-title"
        noValidate
        // 🔹 helps reduce browser autofill
        autoComplete="off"
      >
        <button
          type="button"
          className="signup-close-btn"
          aria-label="Go to home"
          title="Go to home"
          onClick={() => navigate("/", { replace: true })}
        >
          ×
        </button>
        <h1 id="login-title" className="form-title">Login</h1>

        {!!error && <div className="error-banner" role="alert">{error}</div>}

        {/* Email */}
        <div className="form-field">
          <label htmlFor="email" className="form-label">Email</label>
          <input
            id="email"
            type="email"
            className="form-input"
            value={email ?? ""}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            // 🔹 further reduce autofill:
            name="login-email"           // non-standardized name to avoid saved creds
            autoComplete="off"           // override browser suggestions
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        {/* Password */}
        <div className="form-field">
          <label htmlFor="password" className="form-label">Password</label>
          <input
            id="password"
            type="password"
            className="form-input"
            value={password ?? ""}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            name="login-password"       // non-standardized name
            autoComplete="new-password" // avoids "current-password" autofill
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        <div className="actions">
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? (
              <>
                <Spinner size={18} />&nbsp;Logging in…
              </>
            ) : (
              "Log in"
            )}
          </button>

          <button
            type="button"
            className="link-btn"
            onClick={() => navigate("/forgot-password")}
          >
            Forgot password?
          </button>
        </div>
      </form>

      {/* Success Modal */}
      <Modal
        open={showLoginSuccess}
        onClose={() => setShowLoginSuccess(false)}
        icon="success"
        title="Welcome back"
        message="You have logged in successfully."
        primaryText="Go to profile"
        onPrimary={() => {
          setShowLoginSuccess(false);
          navigate(from || "/profile", { replace: true });
        }}
        // secondaryText="Stay here"
        // onSecondary={() => setShowLoginSuccess(false)}
      />
    </main>
  );
}