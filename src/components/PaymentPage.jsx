// PaymentPage.jsx
import { useLocation, useNavigate } from "react-router-dom";
import React, { useState, useContext, useEffect } from "react";
import "./PaymentPage.css";
import { UserContext } from "../context/userContext.jsx";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5275";

const PLAN_ENUM = {
  Individual: 0,
  Monthly: 1,
  Yearly: 2,
};

export default function Payment() {
  const location = useLocation();
  const navigate = useNavigate();
  const { token } = useContext(UserContext);

  const { plan } = location.state || {};
  const [nameOnCard, setNameOnCard] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAutoRenewModal, setShowAutoRenewModal] = useState(false);

  const [quote, setQuote] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      navigate("/login", { replace: true, state: { from: "/payment" } });
    }
  }, [token, navigate]);

  const safeJson = async (res) => {
    const text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const precheckAndQuote = async () => {
      if (!plan || !token) return;

      setLoading(true);
      setError("");

      try {
        const meRes = await fetch(`${API_BASE}/api/subscription/me/current`, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        });

        if (meRes.ok) {
          const current = await safeJson(meRes);
          if (current) {
            const endYmd = current.endDate
              ? new Date(current.endDate).toISOString().slice(0, 10)
              : "a future date";
            alert(
              `You already have an active ${current.plan} plan until ${endYmd}.`
            );
            navigate("/profile", { replace: true });
            return;
          }
        }

        const planValue = PLAN_ENUM[plan];
        if (planValue === undefined) {
          alert("Unknown plan selected.");
          navigate("/subscriptions", { replace: true });
          return;
        }

        const res = await fetch(`${API_BASE}/api/subscription/quote`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ plan: planValue }),
        });

        if (!res.ok) {
          const j = await safeJson(res);
          const msg = j?.message || "You already have an active subscription.";
          alert(msg);
          navigate("/profile", { replace: true });
          return;
        }

        const data = await safeJson(res);
        if (!data) {
          alert("Unable to fetch quote. Please try again.");
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

  const handleCardNumberChange = (e) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 16) value = value.slice(0, 16);
    value = value.replace(/(.{4})/g, "$1 ").trim();
    setCardNumber(value);
  };

  const handleExpiryChange = (e) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 4) value = value.slice(0, 4);
    if (value.length >= 3) {
      value = value.slice(0, 2) + "/" + value.slice(2);
    }
    setExpiry(value);
  };

  const handleCvvChange = (e) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 3) {
      alert("CVV should be exactly 3 digits");
      value = value.slice(0, 3);
    }
    setCvv(value);
  };

  // ✅ Change: On Pay Now, open the modal first.
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!quote) return;
    if (cvv.length !== 3) {
      alert("CVV must be exactly 3 digits");
      return;
    }

    // Optional: simulate payment form validation delay
    await new Promise((r) => setTimeout(r, 300));

    setShowAutoRenewModal(true);
  };

  // ✅ When user chooses, call /confirm with autoRenew
  const handleAutoRenewChoice = async (choice) => {
    setShowAutoRenewModal(false);

    setLoading(true);
    setError("");

    try {
      // Simulate payment success (no gateway integrated yet)
      await new Promise((r) => setTimeout(r, 600));

      const planValue = PLAN_ENUM[plan];

      // (Optional) re-check current before confirm—handles edge cases
      const meRes = await fetch(`${API_BASE}/api/subscription/me/current`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (meRes.ok) {
        const current = await safeJson(meRes);
        if (current) {
          const endYmd = current.endDate
            ? new Date(current.endDate).toISOString().slice(0, 10)
            : "a future date";
          alert(
            `You already have an active ${current.plan} plan until ${endYmd}.`
          );
          navigate("/profile", { replace: true });
          return;
        }
      }

      const res = await fetch(`${API_BASE}/api/subscription/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          plan: planValue,
          paymentReference: `demo_${Date.now()}`,
          autoRenew: choice, // ✅ send the user's selection
        }),
      });

      if (!res.ok) {
        const j = await safeJson(res);
        const msg = j?.message || "You already have an active subscription.";
        alert(msg);
        navigate("/profile", { replace: true });
        return;
      }

      // Optional: const created = await safeJson(res);

      alert(`Payment successful for ${plan} plan`);
      navigate("/profile");
    } finally {
      setLoading(false);
    }
  };

  const fmtDate = (iso) => {
    try {
      return new Date(iso).toISOString().slice(0, 10);
    } catch {
      return iso || "";
    }
  };

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

        <form className="checkout-form" onSubmit={handleSubmit}>
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
            />
          </div>

          {/* Card Number */}
          <div className="field">
            <label htmlFor="cardNumber" className="field-label">Card Number</label>
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
            />
          </div>

          {/* Expiry + CVV grid */}
          <div className="field-grid">
            <div className="field">
              <label htmlFor="expiry" className="field-label">Expiry Date</label>
              <input
                id="expiry"
                type="text"
                className="field-input"
                placeholder="01/23"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                required
                inputMode="numeric"
                autoComplete="cc-exp"
              />
            </div>

            <div className="field cvv-col" style={{ marginTop: 25 }}>
              <label htmlFor="cvv" className="field-label sr-only">CVV</label>
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
              />
            </div>
          </div>

          <button type="submit" className="checkout-btn" disabled={loading || !quote}>
            {loading ? "Processing..." : "Pay Now"}
          </button>

          <div className="divider">
            <span className="divider-label">or pay using e-wallet</span>
          </div>

          <div className="wallet-row">
            <button type="button" className="wallet-tile" aria-label="Google Pay">
              <svg viewBox="0 0 100 24" xmlns="http://www.w3.org/2000/svg" className="wallet-logo" aria-hidden="true">
                <text x="0" y="17" fontSize="16" fill="#240ab9ff">G</text>
                <text x="12" y="17" fontSize="16" fill="#111">Pay</text>
              </svg>
              <span className="wallet-name">G Pay</span>
            </button>
          </div>
        </form>
      </section>

      {/* Auto-Renew Modal */}
      {showAutoRenewModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Enable Auto-Renewal?</h2>
            <p>Would you like to automatically renew your {plan} plan?</p>
            <div className="modal-actions">
              <button onClick={() => handleAutoRenewChoice(true)}>Yes, Enable</button>
              <button onClick={() => handleAutoRenewChoice(false)}>Not now</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}