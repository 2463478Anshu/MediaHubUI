// src/pages/auth/Signup.jsx
import React, { useState, useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { UserContext } from "../../context/userContext.jsx";
import "./signup.css";
import Spinner from "../Spinner.jsx";
import "../Spinner.css";
import Modal from "../../components/Modal.jsx"; // ⬅️ align with Login.jsx

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5275";

function Signup({ setLoggedIn }) {
  // ⬅️ Bring in setToken to store JWT like Login.jsx
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
  const [role, setRole] = useState("user");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showSignupSuccess, setShowSignupSuccess] = useState(false);

  // ✅ Same helpers/validators as in Login.jsx
  const validateName = (name) => /^[a-zA-Z0-9]{3,15}$/.test(name);
  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validatePassword = (password) => /^(?=.*[0-9]).{6,}$/.test(password);
  const validateBirthCity = (city) => /^[a-zA-Z\s]{2,30}$/.test(city.trim());

  // Normalize raw token -> bare JWT string (no "Bearer ")
  const toJwt = (raw) => {
    if (!raw) return "";
    const t = String(raw).trim();
    return t.startsWith("Bearer ") ? t.slice(7) : t;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Client-side validation
    if (!validateName(username)) {
      setError("Invalid Username format! Example: user123");
      return;
    }
    if (!validateEmail(email)) {
      setError("Invalid email format! Example: user@example.com");
      return;
    }
    if (!validatePassword(password)) {
      setError("Password must be at least 6 characters and contain a number. Example: Pass123");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match!");
      return;
    }
    if (!validateBirthCity(birthCity)) {
      setError("Please enter a valid city name (letters and spaces only, 2–30 characters).");
      return;
    }

    const payload = {
      email: email.trim().toLowerCase(),
      password,
      role,
      userName: username,
      fullName: name,
      city: birthCity.trim().toLowerCase(), // security answer
    };

    try {
      setSubmitting(true);

      const response = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // Read as text first to show better error messages
      const text = await response.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text; // raw text fallback
      }

      if (!response.ok) {
        const serverMsg =
          (data && data.message) ||
          (typeof data === "string" ? data : "") ||
          "Registration failed.";
        throw new Error(serverMsg);
      }

      // 👉 If backend mirrors Login: data should have token + user
      const jwt = toJwt(data?.token ?? data?.Token);

      if (jwt) {
        // ✔ Save token EXACTLY like Login.jsx
        setToken(jwt);
        localStorage.setItem("token", jwt);

        // ✔ Normalize user object (same fields you used in Login.jsx)
        const normalizedUser = {
          id: data.user?.userId ?? data.User?.UserId,
          name: data.user?.fullName ?? data.User?.FullName ?? name,
          username: data.user?.userName ?? data.User?.UserName ?? username,
          email: data.user?.email ?? data.User?.Email ?? payload.email,
          role: data.user?.role ?? data.User?.Role ?? role,
          loggedIn: true,
        };

        setUser(normalizedUser);
        localStorage.setItem("user", JSON.stringify(normalizedUser));
        localStorage.setItem("loggedIn", "true");

        setLoggedIn?.(true);

        // ✅ Success UI feedback
        setSuccess("Signup successful!");
        window.toast?.success("Account created successfully!");
        setShowSignupSuccess(true);
      } else {
        // 🚨 Backend does NOT return token → send to login
        window.toast?.info("Account created. Please log in.");
        navigate("/login", { replace: true });
        return;
      }

      // Clear fields
      setName("");
      setUsername("");
      setEmail("");
      setBirthCity("");
      setPassword("");
      setConfirmPassword("");
      setRole("user");
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
      window.toast?.error(err.message || "Registration failed.");
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

        {!!error && <div className="error-banner" role="alert">{error}</div>}
        {!!success && <div className="success-banner">{success}</div>}

        <input
          type="text"
          placeholder="Name"
          value={name}
          autoComplete="name"
          onChange={(e) => setName(e.target.value)}
        />

        <input
          type="text"
          placeholder="Username"
          value={username}
          autoComplete="username"
          onChange={(e) => setUsername(e.target.value)}
        />

        <div className="form-row">
          <label htmlFor="role" className="form-label">Role</label>
          <select
            id="role"
            className="form-select"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <input
          type="email"
          placeholder="Email"
          value={email}
          autoComplete="email"
          onChange={(e) => setEmail(e.target.value)}
        />

        <div className="input-wrapper">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            autoComplete="new-password"
            onChange={(e) => setPassword(e.target.value)}
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
        // secondaryText="Stay here"
        // onSecondary={() => setShowSignupSuccess(false)}
      />
    </div>
  );
}

export default Signup;