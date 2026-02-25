import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./ForgotPassword.css";

// ⬇ keep API base consistent with rest of app
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5275";

// ⬇ center pop-up modal (from earlier step)
import Modal from "../../components/Modal.jsx";
// (Optional) If you want spinners inside buttons, you can import your Spinner here:
// import Spinner from "../Spinner.jsx";
// import "../Spinner.css";

export default function ForgotPassword() {
  const navigate = useNavigate();
1
  // Step machine: 1 = email, 2 = city + new password
  const [step, setStep] = useState(1);

  // Form fields
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  // UI state
  const [loading, setLoading] = useState(false);
  const [serverMsg, setServerMsg] = useState("");

  // NEW: success modal control
  const [showResetSuccess, setShowResetSuccess] = useState(false);

  // Mirror backend rule (>= 6 chars and at least one digit)
  const isValidPassword = (pwd) => /^(?=.*\d).{6,}$/.test(pwd);

  // STEP 1: Check email exists
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setServerMsg("");

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      const msg = "Email is required.";
      setServerMsg(msg);
      window.toast?.error(msg);
      return;
    }

    setLoading(true);
    try {
      const url = `${API_BASE}/api/auth/check-email?email=${encodeURIComponent(
        normalizedEmail
      )}`;
      const res = await fetch(url, { method: "GET" });

      if (!res.ok) {
        let msg = "Email not found.";
        try {
          const data = await res.json();
          if (data?.message) msg = data.message;
        } catch (_) {}
        throw new Error(msg);
      }

      window.toast?.success("Email verified. Please answer the security question.");
      setStep(2);
    } catch (err) {
      const msg = err.message || "Email verification failed.";
      setServerMsg(msg);
      window.toast?.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // STEP 2: Reset password (email + city + newPassword)
  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setServerMsg("");

    if (!isValidPassword(newPassword)) {
      const msg = "Password must be at least 6 characters and include a number.";
      setServerMsg(msg);
      window.toast?.error(msg);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      const msg = "Passwords do not match.";
      setServerMsg(msg);
      window.toast?.error(msg);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        email: email.trim().toLowerCase(),
        city: city.trim().toLowerCase(),
        newPassword,
      };

      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }

      if (!res.ok) {
        const msg =
          (data && data.message) ||
          (typeof data === "string" ? data : "") ||
          "Reset failed. Invalid email or security answer.";
        throw new Error(msg);
      }

      // 🔔 quick non-blocking toast
      window.toast?.success((data && data.message) || "Password updated successfully.");

      // ✅ show center modal to guide user to login
      setShowResetSuccess(true);

      // (Optional) If you prefer auto redirect without modal:
      // navigate("/login", { replace: true });
    } catch (err) {
      const msg = err.message || "Reset failed.";
      setServerMsg(msg);
      window.toast?.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="forgot-container">
      <section className="forgot-form" aria-labelledby="forgot-title">
        <h2 id="forgot-title" className="forgot-title">Reset your password</h2>

        {!!serverMsg && (
          <div
            role="status"
            aria-live="polite"
            style={{
              marginBottom: 10,
              color: "#a00",
              fontSize: 14,
              textAlign: "center",
            }}
          >
            {serverMsg}
          </div>
        )}

        {step === 1 && (
          <form onSubmit={handleEmailSubmit} noValidate>
            <p className="form-helper"><b>Enter your Email id to continue</b></p>

            <div className="form-field">
              <label htmlFor="fp-email" className="form-label">Email</label>
              <input
                id="fp-email"
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>

            <div className="actions">
              <button type="submit" className="login-btn" disabled={loading}>
                {loading ? "Checking..." : "Continue"}
                {/* If you want spinner:
                {loading ? (<><Spinner size={16} />&nbsp;Checking…</>) : "Continue"} */}
              </button>
              <button
                type="button"
                className="link-btn"
                onClick={() => navigate("/login")}
              >
                Back to Login
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleResetSubmit} noValidate>
            <p className="form-helper">
              <strong>Security question:</strong> City of your birth?
            </p>

            <div className="form-field">
              <label htmlFor="fp-city" className="form-label">Answer</label>
              <input
                id="fp-city"
                type="text"
                className="form-input"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g., chennai"
                required
                autoComplete="off"
              />
            </div>

            <div className="form-field">
              <label htmlFor="fp-new" className="form-label">New Password</label>
              <input
                id="fp-new"
                type="password"
                className="form-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 chars, include a number"
                required
                autoComplete="new-password"
              />
            </div>

            <div className="form-field">
              <label htmlFor="fp-confirm" className="form-label">Confirm Password</label>
              <input
                id="fp-confirm"
                type="password"
                className="form-input"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="Re-enter new password"
                required
                autoComplete="new-password"
              />
            </div>

            <div className="actions">
              <button type="submit" className="login-btn" disabled={loading}>
                {loading ? "Updating..." : "Update password"}
                {/* Or with spinner:
                {loading ? (<><Spinner size={16} />&nbsp;Updating…</>) : "Update password"} */}
              </button>
              <button
                type="button"
                className="link-btn"
                onClick={() => setStep(1)}
              >
                Change Email
              </button>
            </div>
          </form>
        )}
      </section>

      {/* ✅ Success Modal */}
      <Modal
        open={showResetSuccess}
        onClose={() => setShowResetSuccess(false)}
        icon="success"
        title="Password updated"
        message="Your password has been reset successfully. You can now log in with your new password."
        primaryText="Go to Login"
        onPrimary={() => {
          setShowResetSuccess(false);
          navigate("/login", { replace: true });
        }}
        secondaryText="Close"
        onSecondary={() => setShowResetSuccess(false)}
        // autoCloseMs={1800} // optional: auto close, then navigate in onClose
      />
    </main>
  );
}