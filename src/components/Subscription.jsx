import { useNavigate } from "react-router-dom";
import React from "react";
import "./Subscription.css";

export default function Subscription() {
  const navigate = useNavigate();

  const plans = [
    {
      title: "Individual",
      billingLabel: "Prepaid or monthly",
      price: "Starts at ₹149.00/month",
      description:
        "Perfect for one account. Watch and listen without ads, online or offline.",
      ctaText: "Get MediaHub Premium",
    },
    {
      title: "Monthly",
      billingLabel: "Monthly",
      price: "₹219.00/month",
      description:
        "Monthly verification required. Free trial for eligible new members only.",
      ctaText: "Get MediaHub Premium",
    },
    {
      title: "Yearly",
      billingLabel: "Yearly",
      price: "₹899.00/year",
      description:
        "Annual verification required. Free trial for eligible new members only.",
      ctaText: "Get MediaHub Premium",
    },
  ];

  const onSelectPlan = (plan) => {
    // ✅ No localStorage checks, no client date math.
    // The Payment page will ask the backend for a quote (dates + amount).
    navigate("/payment", {
      state: {
        plan: plan.title, // "Individual" | "Monthly" | "Yearly"
      },
    });
  };

  return (
    <main className="subscription">
      {/* Hero Section */}
      <section className="subscription__hero">
        <h1>MediaHub Premium</h1>
        <h2>All Entertainment. Zero Interruptions.</h2>
        <p className="subscription__lead">
          Subscribe to MediaHub Premium for an ad‑free experience across all your devices.
          Enjoy offline downloads, background playback, and uninterrupted music &amp; videos —
          all in one place.
        </p>
      </section>

      {/* Plans Grid */}
      <section className="subscription__grid">
        {plans.map((plan) => (
          <article
            key={plan.title}
            className="sub-card"
            aria-label={`${plan.title} subscription plan`}
          >
            <header className="sub-card__header">
              <div className="sub-card__title">
                <h3>{plan.title}</h3>
              </div>
            </header>

            <hr className="sub-card__divider" />

            <div className="sub-card__content">
              <p className="sub-card__billing">{plan.billingLabel}</p>
              <p className="sub-card__price">{plan.price}</p>
              {plan.description && (
                <p className="sub-card__desc">{plan.description}</p>
              )}
            </div>

            <div className="sub-card__actions">
              <button
                className="sub-card__btn"
                type="button"
                aria-label={plan.ctaText}
                onClick={() => onSelectPlan(plan)}
              >
                <span className="sub-card__btnIcon" aria-hidden="true">↗</span>
                {plan.ctaText}
              </button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}