import React, { useContext, useState } from "react";
import { Link } from "react-router-dom";
import "./adminDashboard.css";
import { UserContext } from "../../context/userContext.jsx";

// Tabs
import SummaryCards from "./components/SummaryCards.jsx";
import AnalyticsTab from "./components/AnalyticsTab.jsx";
import FeedbackTab from "./components/FeedbackTab.jsx";
import GrowthTab from "./components/GrowthTab.jsx";

// ✅ Use the new fetch-based hook
import useAdminDashboardApi from "../../hooks/admin/useAdminDashboardApi.js";

// CSV utils (path matches your tree: /src/pages/utils/adminUtils.js)
import { exportCSV as exportCsvUtil } from "../utils/adminUtils.js";

export default function AdminDashboard() {
  const { user } = useContext(UserContext);
  const [activeTab, setActiveTab] = useState("analytics"); // analytics | feedback | growth

  const {
    loading, error,
    engagement, totals, topContent,
    feedbackRows, reviewedMap,
    handleMarkReviewed, handleDeleteComment,
    growth, fetchGrowth,
  } = useAdminDashboardApi();

  const handleExportCSV = () => {
    exportCsvUtil(user, engagement, feedbackRows);
  };

  return (
    <div className="admin-dashboard">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <h2 className="brand">Admin</h2>
        <div className="admin-user">
          <div className="avatar">{(user?.name || "A").charAt(0)}</div>
          <div className="info">
            <div className="name">{user?.name || "Admin"}</div>
            {user?.email && <div className="sub">{user.email}</div>}
          </div>
        </div>
        <nav>
          <button
            className={`nav-btn ${activeTab === "analytics" ? "active" : ""}`}
            onClick={() => setActiveTab("analytics")}
          >
            Engagement Analytics
          </button>
          <button
            className={`nav-btn ${activeTab === "feedback" ? "active" : ""}`}
            onClick={() => setActiveTab("feedback")}
          >
            Feedback & Moderation
          </button>
          <button
            className={`nav-btn ${activeTab === "growth" ? "active" : ""}`}
            onClick={() => setActiveTab("growth")}
          >
            Growth Analytics
          </button>

          <div className="sidebar-divider" />

          <Link to="/media-library" className="link-btn">Media Library</Link>
        </nav>
      </aside>

      {/* Main */}
      <main className="admin-content">
        <div className="admin-header">
          <h1>Dashboard — {user?.name || "Admin"}</h1>
          <div className="header-actions">
            <button className="export-btn" onClick={handleExportCSV} disabled={loading}>
              Export CSV
            </button>
          </div>
        </div>

        {error && (
          <div className="notice" role="alert">
            <strong>Failed to load:</strong> {String(error.message || error)}
          </div>
        )}

        {activeTab === "analytics" && (
          <AnalyticsTab
            loading={loading}
            error={error}
            engagement={engagement}
            totals={totals}
            topContent={topContent}
          />
        )}

        {activeTab === "feedback" && (
          <FeedbackTab
            feedbackRows={feedbackRows}
            reviewedMap={reviewedMap}
            onMarkReviewed={handleMarkReviewed}
            onDeleteComment={handleDeleteComment}
          />
        )}

        {activeTab === "growth" && (
          <GrowthTab fetchGrowth={fetchGrowth} growth={growth} />
        )}
      </main>
    </div>
  );
}