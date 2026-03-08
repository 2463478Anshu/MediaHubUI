// Payment.jsx
import React, { useState, useContext, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./PaymentPage.css";

// ⬇️ Adjust these relative paths if your file is in a different folder depth
import { UserContext } from "../context/userContext.jsx";
import Spinner from "../components/Spinner.jsx";
import "../components/Modal.css";
import "../components/Spinner.css"
import Modal from "../components/Modal.jsx";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5275";

// Toast helpers (top-right) — same behavior as Login.jsx
const toastError = (msg) => window.toast?.error(msg, { position: "top-right" });
const toastInfo = (msg) => window.toast?.info(msg, { position: "top-right" });
const toastSuccess = (msg) =>
  window.toast?.success(msg, { position: "top-right" });

// Extract a first validation message from 400 ProblemDetails (same pattern as login)
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

const PLAN_ENUM = {
  Individual: 0,
  Monthly: 1,
  Yearly: 2,
};

// ---------- helpers ----------
const safeJson = async (res) => {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const onlyDigits = (s) => String(s || "").replace(/\D/g, "");

// ---------- validators/formatters ----------
const isValidName = (s) => !!s && s.trim().length >= 2;

const isValidCardNumber = (pretty) => {
  const digits = onlyDigits(pretty);
  return digits.length === 16;
};

const isValidExpiry = (exp) => {
  // MM/YY in a realistic window: current year … current year + 15
  if (!/^\d{2}\/\d{2}$/.test(exp)) return false;
  const [mmStr, yyStr] = exp.split("/");
  const mm = parseInt(mmStr, 10);
  const yy = parseInt(yyStr, 10);
  if (mm < 1 || mm > 12) return false;

  const now = new Date();
  const currentYearFull = now.getFullYear();
  const currentYY = parseInt(currentYearFull.toString().slice(-2), 10);
  const currentMM = now.getMonth() + 1;
  const maxFullYear = currentYearFull + 15;

  const century = Math.floor(currentYearFull / 100) * 100;
  const fullYear = century + yy;

  if (fullYear < currentYearFull || fullYear > maxFullYear) return false;
  if (fullYear === currentYearFull && mm < currentMM) return false;

  return true;
};

// ---------- component ----------
export default function Payment() {
  const { token } = useContext(UserContext);
  const location = useLocation();
  const navigate = useNavigate();

  const { plan } = location.state || {};

  const [nameOnCard, setNameOnCard] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAutoRenewModal, setShowAutoRenewModal] = useState(false);
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState("");

  // Redirect unauthenticated users
  useEffect(() => {
    if (!token) {
      navigate("/login", { replace: true, state: { from: "/payment" } });
    }
  }, [token, navigate]);

  // Input formatters
  const handleCardNumberChange = (e) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 16) value = value.slice(0, 16);
    value = value.replace(/(.{4})/g, "$1 ").trim();
    setCardNumber(value);
  };

  const handleExpiryChange = (e) => {
    let digits = e.target.value.replace(/\D/g, "");
    if (digits.length > 4) digits = digits.slice(0, 4);
    if (digits.length === 1 && parseInt(digits, 10) > 1) {
      digits = "0" + digits;
    }
    if (digits.length >= 3) {
      const mm = digits.slice(0, 2);
      const yy = digits.slice(2, 4);
      e.target.value = yy.length ? `${mm}/${yy}` : `${mm}/`;
    } else if (digits.length >= 1) {
      e.target.value = digits;
    } else {
      e.target.value = "";
    }
    setExpiry(e.target.value);
  };

  const handleExpiryKeyDown = (e) => {
    const allowed = [
      "Backspace",
      "Delete",
      "Tab",
      "ArrowLeft",
      "ArrowRight",
      "Home",
      "End",
    ];
    if (allowed.includes(e.key)) return;
    if (!/^\d$/.test(e.key)) e.preventDefault();
  };

  const handleExpiryPaste = (e) => {
    const pasted =
      (e.clipboardData || window.clipboardData)?.getData("text") || "";
    if (!/^\d+$/.test(pasted.replace(/\D/g, ""))) e.preventDefault();
  };

  const handleCvvChange = (e) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 3) {
      toastInfo?.("CVV should be exactly 3 digits.");
      value = value.slice(0, 3);
    }
    setCvv(value);
  };

  // Format a date (YYYY-MM-DD)
  const fmtDate = (iso) => {
    try {
      return new Date(iso).toISOString().slice(0, 10);
    } catch {
      return iso || "";
    }
  };

  // Pre-check: existing subscription + load quote, with timeout & network error handling
  useEffect(() => {
    const precheckAndQuote = async () => {
      if (!plan || !token) return;

      setLoading(true);
      setError("");
      try {
        // 1) Check if user already has active subscription
        {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 15000);
          try {
            const meRes = await fetch(`${API_BASE}/api/subscription/me/current`, {
              method: "GET",
              headers: { Authorization: `Bearer ${token}` },
              signal: controller.signal,
            });
            clearTimeout(timer);
            const cid = meRes.headers.get("X-Correlation-ID");
            const ref = cid ? ` (Ref: ${cid})` : "";

            if (meRes.ok) {
              const current = await safeJson(meRes);
              if (current) {
                try {
                  window.toast?.dismiss?.();
                } catch {}
                alert(`You already have an active ${current.plan} plan until ${fmtDate(current.endDate)}.${ref}`);
                navigate("/profile", { replace: true });
                return;
              }
            }
          } catch (err) {
            try {
              window.toast?.dismiss?.();
            } catch {}
            if (err?.name === "AbortError") {
              toastError(
                "Request timed out. Please check your network and try again."
              );
              setError("Timed out while checking current subscription.");
              return;
            }
            toastError("Unable to reach server. Please try again later.");
            setError("Unable to reach server while checking subscription.");
            return;
          }
        }

        // 2) Get quote for selected plan
        const planValue = PLAN_ENUM[plan];
        if (planValue === undefined) {
          toastError("Unknown plan selected.");
          navigate("/subscriptions", { replace: true });
          return;
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        const res = await fetch(`${API_BASE}/api/subscription/quote`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ plan: planValue }),
          signal: controller.signal,
        });
        clearTimeout(timer);

        const data = await safeJson(res);
        const cid = res.headers.get("X-Correlation-ID");
        const ref = cid ? ` (Ref: ${cid})` : "";

        if (!res.ok) {
          try {
            window.toast?.dismiss?.();
          } catch {}
          if (res.status === 400) {
            toastError(getFirstValidationMessage(data) + ref);
          } else if (res.status === 404) {
            toastError((data?.detail || "Plan not found.") + ref);
          } else if (res.status === 500) {
            toastError("Server error. Please try again." + ref);
          } else {
            toastError(
              (data?.message ||
                (typeof data === "string" ? data : "Unable to fetch quote.")) +
                ref
            );
          }
          setError("Unable to fetch quote.");
          navigate("/profile", { replace: true });
          return;
        }

        if (!data) {
          toastError("Unable to fetch quote. Please try again.");
          setError("No quote returned by server.");
          navigate("/subscriptions", { replace: true });
          return;
        }

        setQuote(data);
      } finally {
        setLoading(false);
      }
    };

    precheckAndQuote();
  }, [plan, token, navigate]);

  if (!plan) {
    return (
      <main className="payment-page-bg">
        <section className="payment-card">
          <p>No plan selected. Please go back to subscriptions.</p>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => navigate("/subscription")}
          >
            Back to Subscriptions
          </button>
        </section>
      </main>
    );
  }

  // Submit == first show a short spinner (validations) and then open Auto-Renew modal
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!quote) return;

    try {
      window.toast?.dismiss?.();
    } catch {}
    setError("");

    // Show the spinner right after clicking submit (as requested)
    setLoading(true);

    // Front-end validations
    if (!isValidName(nameOnCard)) {
      setLoading(false);
      toastError("Please enter the card holder's full name.");
      return;
    }
    if (!isValidCardNumber(cardNumber)) {
      setLoading(false);
      toastError("Please enter a valid 16-digit card number.");
      return;
    }
    if (!isValidExpiry(expiry)) {
      setLoading(false);
      toastError(
        "Please enter a valid expiry in MM/YY format (not in the past, within 15 years)."
      );
      return;
    }
    if (cvv.length !== 3 || /\D/.test(cvv)) {
      setLoading(false);
      toastError("CVV must be exactly 3 digits.");
      return;
    }

    // A tiny delay to make the spinner visible before opening modal
    await new Promise((r) => setTimeout(r, 300));
    setLoading(false);
    setShowAutoRenewModal(true);
  };

  // Confirm with user's auto-renew choice
  const handleAutoRenewChoice = async (autoRenew) => {
    setShowAutoRenewModal(false);
    setLoading(true);
    setError("");

    try {
      // Optional small "processing payment" delay to allow spinner visibility
      await new Promise((r) => setTimeout(r, 500));

      // Guard: re-check current subscription before confirm
      {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        try {
          const meRes = await fetch(`${API_BASE}/api/subscription/me/current`, {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          });
          clearTimeout(timer);

          const current = meRes.ok ? await safeJson(meRes) : null;
          const cid = meRes.headers.get("X-Correlation-ID");
          const ref = cid ? ` (Ref: ${cid})` : "";

          if (current) {
            try {
              window.toast?.dismiss?.();
            } catch {}
            toastInfo(
              `You already have an active ${current.plan} plan until ${fmtDate(
                current.endDate
              )}.${ref}`
            );
            navigate("/profile", { replace: true });
            return;
          }
        } catch (err) {
          try {
            window.toast?.dismiss?.();
          } catch {}
          if (err?.name === "AbortError") {
            toastError(
              "Request timed out. Please check your network and try again."
            );
            setError("Timed out while verifying subscription.");
            return;
          }
          toastError("Unable to reach server. Please try again later.");
          setError("Unable to reach server while verifying subscription.");
          return;
        }
      }

      // Confirm subscription after (simulated) successful payment
      const planValue = PLAN_ENUM[plan];
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(`${API_BASE}/api/subscription/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          plan: planValue,
          paymentReference: `demo_${Date.now()}`,
          autoRenew,
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);
      const data = await safeJson(res);
      const cid = res.headers.get("X-Correlation-ID");
      const ref = cid ? ` (Ref: ${cid})` : "";

      if (!res.ok) {
        try {
          window.toast?.dismiss?.();
        } catch {}
        if (res.status === 400) {
          toastError(getFirstValidationMessage(data) + ref);
        } else if (res.status === 409) {
          toastInfo((data?.message || "Subscription already active.") + ref);
        } else if (res.status === 500) {
          toastError("Server error. Please try again." + ref);
        } else {
          toastError(
            (data?.message ||
              (typeof data === "string"
                ? data
                : "Payment/Subscription failed.")) + ref
          );
        }
        setError("Failed to confirm subscription.");
        return;
      }

      // Success: Toast + Success Modal (same UX as Login)
      try {
        window.toast?.dismiss?.();
      } catch {}
      toastSuccess(`Payment successful! Your ${plan} subscription is active.` + ref);
      setShowPaymentSuccess(true);
    } catch (err) {
      try {
        window.toast?.dismiss?.();
      } catch {}
      if (err?.name === "AbortError") {
        toastError("Request timed out. Please check your network and try again.");
        setError("Timed out while confirming subscription.");
        return;
      }
      toastError("Unable to reach server. Please try again later.");
      setError("Unable to reach server while confirming subscription.");
    } finally {
      setLoading(false);
    }
  };

  const isSubmitDisabled = loading || !quote;

  return (
    <main className="payment-page-bg">
      <section className="payment-card" role="form" aria-label="Payment form">
        <header className="payment-summary">
          <h1 className="sr-only">Payment Page</h1>
          <h2 className="plan-title">{plan} Plan</h2>

          {error ? (
            <p className="error-banner" role="alert">
              {error}
            </p>
          ) : quote ? (
            <>
              <p className="plan-meta">
                <strong>Start Date:</strong> {fmtDate(quote.startDate)}
              </p>
              <p className="plan-meta">
                <strong>End Date:</strong> {fmtDate(quote.endDate)}
              </p>
              <p className="plan-meta">
                <strong>Amount:</strong> {quote.currency} {quote.amount}
              </p>
            </>
          ) : (
            <p>Loading quote…</p>
          )}
        </header>

        <form className="checkout-form" onSubmit={handleSubmit} noValidate>
          {/* Name */}
          <div className="field">
            <label htmlFor="fullName" className="field-label">
              Card holder full name
            </label>
            <input
              id="fullName"
              type="text"
              className="field-input"
              placeholder="Enter your full name"
              value={nameOnCard}
              onChange={(e) => setNameOnCard(e.target.value)}
              required
              autoComplete="cc-name"
              disabled={loading}
            />
          </div>

          {/* Card Number */}
          <div className="field">
            <label htmlFor="cardNumber" className="field-label">
              Card Number
            </label>
            <input
              id="cardNumber"
              type="text"
              className="field-input"
              placeholder="0000 0000 0000 0000"
              value={cardNumber}
              onChange={handleCardNumberChange}
              required
              inputMode="numeric"
              autoComplete="cc-number"
              disabled={loading}
            />
          </div>

          {/* Expiry + CVV */}
          <div className="field-grid">
            <div className="field">
              <label htmlFor="expiry" className="field-label">
                Expiry Date
              </label>
              <input
                id="expiry"
                type="text"
                className="field-input"
                placeholder="01/23"
                value={expiry}
                onChange={handleExpiryChange}
                required
                inputMode="numeric"
                autoComplete="cc-exp"
                maxLength={5}
                onKeyDown={handleExpiryKeyDown}
                onPaste={handleExpiryPaste}
                disabled={loading}
              />
            </div>

            <div className="field cvv-col" style={{ marginTop: 25 }}>
              <label htmlFor="cvv" className="field-label sr-only">
                CVV
              </label>
              <input
                id="cvv"
                type="text"
                className="field-input"
                placeholder="CVV"
                value={cvv}
                onChange={handleCvvChange}
                required
                inputMode="numeric"
                autoComplete="cc-csc"
                disabled={loading}
              />
            </div>
          </div>

          <button type="submit" className="checkout-btn" disabled={isSubmitDisabled}>
            {loading ? (
              <>
                <Spinner size={18} /> Processing…
              </>
            ) : (
              "Pay Now"
            )}
          </button>
        </form>
      </section>

      {/* Auto-Renew Modal */}
      {showAutoRenewModal && (
        <div className="modal-overlay">
          <div className="modal" role="dialog" aria-labelledby="autoRenewTitle" aria-modal="true">
            <h2 id="autoRenewTitle">Enable Auto-Renewal?</h2>
            <p>Would you like to automatically renew your {plan} plan?</p>
            <div className="modal-actions">
              <button onClick={() => handleAutoRenewChoice(true)} disabled={loading}>
                Yes, Enable
              </button>
              <button onClick={() => handleAutoRenewChoice(false)} disabled={loading}>
                Not now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal — same UX pattern as Login.jsx */}
      <Modal
        open={showPaymentSuccess}
        onClose={() => setShowPaymentSuccess(false)}
        icon="success"
        title="Payment Successful"
        message={`Your ${plan} subscription is now active.`}
        primaryText="Go to profile"
        onPrimary={() => {
          setShowPaymentSuccess(false);
          navigate("/profile", { replace: true });
        }}
      />
    </main>
  );
}
