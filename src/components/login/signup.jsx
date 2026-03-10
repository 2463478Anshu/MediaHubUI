// src/pages/auth/Signup.jsx
import React, { useState, useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { UserContext } from "../../context/userContext.jsx";
import "./signup.css";
import Spinner from "../Spinner.jsx";
import "../Spinner.css";
import Modal from "../../components/Modal.jsx";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5275";

// Extract the first validation message from our standardized 400 body
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

// Normalize raw token -> bare JWT string (no "Bearer ")
function toJwt(raw) {
  if (!raw) return "";
  const t = String(raw).trim();
  return t.startsWith("Bearer ") ? t.slice(7) : t;
}

// Normalize role to "User" | "Admin" regardless of server casing
function normalizeRole(r) {
  if (!r) return "User";
  const v = String(r).trim().toLowerCase();
  if (v === "admin") return "Admin";
  return "User";
}

function Signup({ setLoggedIn }) {
  const { setUser, setToken } = useContext(UserContext);
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/";

  // Form state
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [birthCity, setBirthCity] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Backend expects "User" | "Admin"
  const [role, setRole] = useState("User");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [showSignupSuccess, setShowSignupSuccess] = useState(false);

  // =========================
  // Client-side validators
  // =========================

  // Full Name: letters + spaces only, length 2–100
  const validateName = (val) => /^[A-Za-z ]{2,100}$/.test(val.trim());

  // Username: letters, numbers, underscore only; length 3–20
  const validateUserName = (val) => /^[A-Za-z0-9_]{3,20}$/.test(val);

  // Email with TLD requirement
  const validateEmail = (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);

  // Strong password: at least 1 lower, 1 upper, 1 digit, 1 special; 6–100
  const STRONG_PWD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,100}$/;
  const validatePassword = (val) => STRONG_PWD_REGEX.test(val);

  const validateBirthCity = (val) =>
    val && val.trim().length >= 2 && val.trim().length <= 100;

  // Convenience toast wrappers (top-right)
  const toastError = (msg) => window.toast?.error(msg, { position: "top-right" });
  const toastInfo = (msg) => window.toast?.info(msg, { position: "top-right" });
  const toastSuccess = (msg) => window.toast?.success(msg, { position: "top-right" });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccess("");

    // Prevent multiple submissions while request is in-flight
    if (submitting) return;

    // Client-side validation → use toast (top-right), no inline error banners
    if (!validateUserName(username)) {
      toastError("Username must be 3–20 characters and can contain only letters, numbers, and underscore (_).");
      return;
    }
    if (!validateName(name)) {
      toastError("Full Name can contain only letters and spaces, and must be 2–100 characters long.");
      return;
    }
    if (!validateEmail(email)) {
      toastError("Invalid email format. Example: user@example.com");
      return;
    }
    if (!validatePassword(password)) {
      toastError("Password must be 6–100 chars and include at least 1 uppercase, 1 lowercase, 1 number, and 1 special character.");
      return;
    }
    if (password !== confirmPassword) {
      toastError("Passwords do not match!");
      return;
    }
    if (!validateBirthCity(birthCity)) {
      toastError("Please enter a valid city name (2–100 characters).");
      return;
    }
    if (!(role === "User" || role === "Admin")) {
      toastError("Role must be 'User' or 'Admin'.");
      return;
    }

    const payload = {
      email: email.trim().toLowerCase(),
      password,
      role, // "User" | "Admin"
      userName: username.trim(),
      fullName: name.trim(),
      city: birthCity.trim().toLowerCase(), // security answer
    };

    // Add a 15s network timeout like Login.jsx for consistent UX
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      setSubmitting(true);

      const response = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      let data = null;
      const text = await response.text();
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text; // fallback
      }

      if (!response.ok) {
        if (response.status === 409) {
          const msg = (data && data.detail) || "Email already registered.";
          toastError(msg);
          return;
        }
        if (response.status === 400) {
          const msg = getFirstValidationMessage(data);
          toastError(msg);
          return;
        }
        if (response.status === 422) {
          const msg = (data && data.detail) || "Invalid role.";
          toastError(msg);
          return;
        }
        if (response.status === 500) {
          toastError("Server error. Please try again.");
          return;
        }
        const serverMsg =
          (data && data.message) ||
          (typeof data === "string" ? data : "") ||
          "Registration failed.";
        toastError(serverMsg);
        return;
      }

      const jwt = toJwt(data?.token ?? data?.Token);

      if (jwt) {
        setToken(jwt);
        localStorage.setItem("token", jwt);

        const normalizedUser = {
          id: data.user?.userId ?? data.User?.UserId,
          name: data.user?.fullName ?? data.User?.FullName ?? name,
          username: data.user?.userName ?? data.User?.UserName ?? username,
          email: data.user?.email ?? data.User?.Email ?? payload.email,
          role: normalizeRole(data.user?.role ?? data.User?.Role ?? role),
          loggedIn: true,
        };

        setUser(normalizedUser);
        localStorage.setItem("user", JSON.stringify(normalizedUser));
        localStorage.setItem("loggedIn", "true");
        setLoggedIn?.(true);

        setSuccess("Signup successful!");
        toastSuccess("Account created successfully!");
        setShowSignupSuccess(true);

        // Clear
        setName("");
        setUsername("");
        setEmail("");
        setBirthCity("");
        setPassword("");
        setConfirmPassword("");
        setRole("User");
      } else {
        toastInfo("Account created. Please log in.");
        navigate("/login", { replace: true });
      }
    } catch (err) {
      clearTimeout(timeout);

      // Show friendly network errors (server down, connection refused, CORS, offline)
      if (err?.name === "AbortError") {
        toastError("Request timed out. Please check your network and try again.");
      } else {
        toastError("Unable to reach server. Please try again later.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="signup-container signup-page">
      <form onSubmit={handleSubmit} className="signup-form" noValidate>
        <button
          type="button"
          className="signup-close-btn"
          aria-label="Go to home"
          title="Go to home"
          onClick={() => navigate("/", { replace: true })}
        >
          ×
        </button>

        <h2>Sign Up</h2>

        {/* Removed inline error-banner; relying on top-right toast instead */}
        {!!success && <div className="success-banner">{success}</div>}

        <input
          type="text"
          placeholder="Full Name"
          value={name}
          autoComplete="name"
          onChange={(e) => setName(e.target.value)}
          disabled={submitting}
        />

        <input
          type="text"
          placeholder="Username"
          value={username}
          autoComplete="username"
          onChange={(e) => setUsername(e.target.value)}
          disabled={submitting}
        />

        <div className="form-row">
          <label htmlFor="role" className="form-label">Role</label>
          <select
            id="role"
            className="form-select"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={submitting}
          >
            <option value="User">User</option>
            <option value="Admin">Admin</option>
          </select>
        </div>

        <input
          type="email"
          placeholder="Email"
          value={email}
          autoComplete="email"
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
        />

        <div className="input-wrapper">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            autoComplete="new-password"
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
          />
          <span
            className="toggle-visibility"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            role="button"
            tabIndex={0}
          />
        </div>

        <div className="input-wrapper">
          <input
            type={showConfirmPassword ? "text" : "password"}
            placeholder="Re-enter password"
            value={confirmPassword}
            autoComplete="new-password"
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={submitting}
          />
          <span
            className="toggle-visibility"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
            role="button"
            tabIndex={0}
          />
        </div>

        <br />
        <div className="security-question-field">
          <label htmlFor="securityQuestion" className="form-label">Security Question</label>
          <input
            id="securityQuestion"
            type="text"
            placeholder="City of your birth?"
            value={birthCity}
            onChange={(e) => setBirthCity(e.target.value)}
            disabled={submitting}
          />
        </div>

        <button type="submit" className="signup-btn" disabled={submitting}>
          {submitting ? (
            <>
              <Spinner size={18} /> &nbsp;Signing up…
            </>
          ) : (
            "Sign Up"
          )}
        </button>
      </form>

      {/* Success Modal */}
      <Modal
        open={showSignupSuccess}
        onClose={() => setShowSignupSuccess(false)}
        icon="success"
        title="Account created"
        message="Your account has been created successfully."
        primaryText="Go to profile"
        onPrimary={() => {
          setShowSignupSuccess(false);
          navigate(from || "/profile", { replace: true });
        }}
      />
    </div>
  );
}

export default Signup;