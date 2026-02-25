// MediaHub/src/pages/admin/utils/adminUtils.js

/* ===== Metadata helpers ===== */
export function hasAnyUploaderMeta(item) {
  const keys = [
    "uploadedBy","uploader","owner","createdBy","adminName",
    "adminId","uploadedById","ownerId","creatorId","adminEmail",
  ];
  return keys.some((k) => item?.[k] !== undefined && item?.[k] !== null);
}

export function isOwnedByAdmin(item, userObj) {
  if (!userObj) return false;
  const uname = (userObj?.name || userObj?.username || "").trim().toLowerCase();
  const uids = [userObj?.id, userObj?.userId, userObj?.email, userObj?.mail, userObj?.upn]
    .filter(Boolean)
    .map((v) => String(v).trim().toLowerCase());

  const nameCandidates = [item?.uploadedBy, item?.uploader, item?.owner, item?.createdBy, item?.adminName]
    .filter(Boolean)
    .map((v) => String(v).trim().toLowerCase());

  const idCandidates = [item?.adminId, item?.uploadedById, item?.ownerId, item?.creatorId, item?.adminEmail]
    .filter(Boolean)
    .map((v) => String(v).trim().toLowerCase());

  if (uname && nameCandidates.some((n) => n === uname)) return true;
  if (uids.length > 0 && idCandidates.some((id) => uids.includes(id))) return true;
  return false;
}

export function countSubscriptionsForVideo(videoId) {
  let count = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(`subscribed-${videoId}-`) && localStorage.getItem(key) === "true") {
      count++;
    }
  }
  return count;
}

export function splitComment(c, user) {
  const parts = String(c).split(": ");
  const username = parts[0] || user?.name || "user";
  const text = parts.slice(1).join(": ") || "";
  return { username, text };
}

/* ===== CSV ===== */
export function escapeCSV(val) {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function exportCSV(user, engagement, feedbackRows) {
  const engagementHeader = [
    "Video ID","Title","Category","Created At","Views","Likes","Comments","Subscriptions",
  ];
  const engagementRows = engagement.map((e) => [
    e.id, escapeCSV(e.title), escapeCSV(e.category), escapeCSV(e.createdAt),
    e.views, e.likes, e.commentsCount, e.subscriptions,
  ]);

  const feedbackHeader = ["Video ID","Video Title","Comment Index","Username","Text","Reviewed"];
  const feedbackData = feedbackRows.map((r) => [
    r.videoId, escapeCSV(r.videoTitle), r.index, escapeCSV(r.username),
    escapeCSV(r.text), r.reviewed ? "Yes" : "No",
  ]);

  const csv =
    "# Engagement Summary\n" +
    engagementHeader.join(",") + "\n" +
    engagementRows.map((row) => row.join(",")).join("\n") +
    "\n\n# Feedback (Comments)\n" +
    feedbackHeader.join(",") + "\n" +
    feedbackData.map((row) => row.join(",")).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `admin-dashboard-${(user?.name || "admin").replace(/\s+/g, "-").toLowerCase()}-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ===== Dates & Growth helpers ===== */
export function parseDateSafe(d) {
  if (!d) return null;
  const t = new Date(d);
  return isNaN(t.getTime()) ? null : t;
}

// Week starts on Monday
export function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0-6
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function labelForWeekStart(d) {
  return `Week of ${d.toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  })}`;
}

export function weekKey(d) {
  return d.toISOString().slice(0, 10);
}

export function getRecentWeekStarts(n) {
  const weeks = [];
  const today = new Date();
  let cur = startOfWeek(today);
  for (let i = 0; i < n; i++) {
    weeks.unshift(new Date(cur));
    cur.setDate(cur.getDate() - 7);
  }
  return weeks;
}
