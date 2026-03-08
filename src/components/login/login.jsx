import { useNavigate, useLocation } from "react-router-dom";
import { useState, useContext, useEffect } from "react";
import { UserContext } from "../../context/userContext.jsx";
import "./login.css";
import Spinner from "../Spinner.jsx";
import "../Spinner.css";
import Modal from "../../components/Modal.jsx";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5275";

// Toast helpers (top-right)
const toastError = (msg) => window.toast?.error(msg, { position: "top-right" });
// We keep toastInfo for other flows if needed, but NOT used for logout now
const toastInfo = (msg) => window.toast?.info(msg, { position: "top-right" });
const toastSuccess = (msg) => window.toast?.success(msg, { position: "top-right" });

// Extract first validation message from 400 ProblemDetails
function getFirstValidationMessage(body) {
  try {
    if (body?.errors && Array.isArray(body.errors) && body.errors.length > 0) {
      const first = body.errors[0];
      if (first?.messages?.length > 0) return first.messages[0];
    }
    if (body?.title) return body.title;
  } catch {}
  return "Validation failed. Please check your inputs.";
}

// Email with TLD requirement
const isValidEmail = (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
// Keep login password validation simple (length only)
const isValidPassword = (val) => typeof val === "string" && val.length >= 6 && val.length <= 100;

// Normalize raw token -> bare JWT string (no "Bearer ")
function toJwt(raw) {
  if (!raw) return "";
  const t = String(raw).trim();
  return t.startsWith("Bearer ") ? t.slice(7) : t;
}

export default function Login({ setLoggedIn }) {
  const { setUser, setToken } = useContext(UserContext);
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from || "/";

  // Controlled state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showLoginSuccess, setShowLoginSuccess] = useState(false);

  // Helper to hard-clear the form fields
  const clearForm = () => {
    setEmail("");
    setPassword("");
  };

  // Always clear on mount
  useEffect(() => {
    clearForm();
  }, []);

  // Clear when coming from logout, then remove the state flag
  useEffect(() => {
    if (location.state?.fromLogout) {
      clearForm();

      // ❌ Removed: "You have been logged out." toast
      // try { window.toast?.dismiss?.(); } catch {}
      // toastInfo?.("You have been logged out.");

      // Remove the flag so back/forward won't re-trigger
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // ✅ Ignore repeated clicks if a request is in-flight
    if (loading) return;

    const emailTrim = (email || "").trim().toLowerCase();
    const pwd = password || "";

    // OPTIONAL: dismiss any old toasts before showing new ones
    try { window.toast?.dismiss?.(); } catch {}

    // REQUIRED checks first (no API call on empty fields)
    if (!emailTrim) {
      toastError("Email is required.");
      return;
    }
    if (!pwd) {
      toastError("Password is required.");
      return;
    }

    // Format/length checks next
    if (!isValidEmail(emailTrim)) {
      toastError("Invalid email format. Example: user@example.com");
      return;
    }
    if (!isValidPassword(pwd)) {
      toastError("Password must be at least 6 characters.");
      return;
    }

    const payload = { email: emailTrim, password: pwd };

    // Timeout with AbortController (15s)
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 15000);

    try {
      // Spinner ON
      setLoading(true);

      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(t);

      // Try read JSON; fall back to text
      const raw = await res.text();
      let data = null;
      try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }

      // Correlation id for support/debug
      const cid = res.headers.get("X-Correlation-ID");
      const ref = cid ? ` (Ref: ${cid})` : "";

      if (!res.ok) {
        try { window.toast?.dismiss?.(); } catch {}
        if (res.status === 404) {
          const msg = (data && data.detail) || "Email not registered.";
          toastError(msg + ref);
          return;
        }
        if (res.status === 401) {
          const msg = (data && data.detail) || "Invalid credentials.";
          toastError(msg + ref);
          return;
        }
        if (res.status === 400) {
          const msg = getFirstValidationMessage(data);
          toastError(msg + ref);
          return;
        }
        if (res.status === 500) {
          toastError("Server error. Please try again." + ref);
          return;
        }
        const msg = (data && data.message) || (typeof data === "string" ? data : "Login failed.");
        toastError(msg + ref);
        return;
      }

      // OK
      const jwt = toJwt(data?.token ?? data?.Token);
      if (!jwt) {
        try { window.toast?.dismiss?.(); } catch {}
        // Not a logout toast—keep info toast if you want
        // toastInfo("Login succeeded but no token returned. Please try again." + ref);
        toastError("Login succeeded but no token returned. Please try again." + ref);
        return;
      }

      setToken(jwt);
      localStorage.setItem("token", jwt);

      // Normalize user object
      const normalizedUser = {
        id: data.user?.userId ?? data.User?.UserId,
        name: data.user?.fullName ?? data.User?.FullName ?? "",
        username: data.user?.userName ?? data.User?.UserName ?? "",
        email: data.user?.email ?? data.User?.Email ?? emailTrim,
        role: data.user?.role ?? data.User?.Role ?? "User",
        loggedIn: true,
        IsActive: data.user?.isActive ?? data.User?.IsActive ?? 1
      };

      // Persist
      setUser(normalizedUser);
      localStorage.setItem("user", JSON.stringify(normalizedUser));
      localStorage.setItem("loggedIn", "true");
      setLoggedIn?.(true);

      // Clear the form right after successful login
      clearForm();

      try { window.toast?.dismiss?.(); } catch {}
      toastSuccess("Logged in successfully!" + ref);
      setShowLoginSuccess(true);
    } catch (err) {
      clearTimeout(t);
      try { window.toast?.dismiss?.(); } catch {}
      if (err?.name === "AbortError") {
        toastError("Request timed out. Please check your network and try again.");
        return;
      }
      // Network failure / CORS / server unreachable
      toastError("Unable to reach server. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  // Disable submit button if mandatory fields are empty or a request is in-flight
  const isSubmitDisabled = loading || !email || !password;

  return (
    <main className="login-container login-page">
      <form
        className="login-form"
        onSubmit={handleSubmit}
        aria-labelledby="login-title"
        noValidate
        autoComplete="off"
      >
        <button
          type="button"
          className="signup-close-btn"
          aria-label="Go to home"
          title="Go to home"
          onClick={() => {
            clearForm();
            navigate("/", { replace: true });
          }}
        >
          ×
        </button>

        <h1 id="login-title" className="form-title">Login</h1>

        {/* Email */}
        <div className="form-field">
          <label htmlFor="email" className="form-label">Email</label>
          <input
            id="email"
            type="email"
            className="form-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            name="login-email"
            autoComplete="off"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={loading}
          />
        </div>

        {/* Password */}
        <div className="form-field">
          <label htmlFor="password" className="form-label">Password</label>
          <input
            id="password"
            type="password"
            className="form-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            name="login-password"
            autoComplete="new-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={loading}
          />
        </div>

        <div className="actions">
          <button type="submit" className="login-btn" disabled={isSubmitDisabled}>
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
            onClick={() => {
              clearForm();
              navigate("/forgot-password");
            }}
            disabled={loading}
          >
            Forgot password?
          </button>
        </div>
      </form>

      {/* Success Modal */}
      <Modal
        open={showLoginSuccess}
        onClose={() => {
          setShowLoginSuccess(false);
          clearForm();
        }}
        icon="success"
        title="Welcome back"
        message="You have logged in successfully."
        primaryText="Go to profile"
        onPrimary={() => {
          setShowLoginSuccess(false);
          clearForm();
          navigate(from || "/profile", { replace: true });
        }}
      />
    </main>
  );
}