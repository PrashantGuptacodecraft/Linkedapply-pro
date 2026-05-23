// ============================================================
//  LinkedApply Pro — Frontend API Service
//  File: frontend/src/api.js
// ============================================================

import axios from "axios";

const BASE = "/api";

// ── LinkedIn ─────────────────────────────────────────────────
export const linkedinLogin = (email, password) =>
  axios.post(`${BASE}/linkedin/login`, { email, password });

export const linkedinSearch = (keywords, hoursBack, location, workAuth) =>
  axios.post(`${BASE}/linkedin/search`, { keywords, hoursBack, location, workAuth }, { timeout: 60 * 60 * 1000 }); // 60 min — scraping takes time

export const linkedinLogout = () =>
  axios.post(`${BASE}/linkedin/logout`);

// ── Gmail ────────────────────────────────────────────────────
export const gmailLogin = (gmailUser, gmailAppPassword) =>
  axios.post(`${BASE}/gmail/login`, { gmailUser, gmailAppPassword });

export const sendBulkEmails = (payload) =>
  axios.post(`${BASE}/gmail/send-bulk`, payload, { timeout: 20 * 60 * 1000 }); // 20 min timeout

export const previewEmail = (recruiterName, jobTitle, candidate) =>
  axios.post(`${BASE}/gmail/preview`, { recruiterName, jobTitle, candidate });

// ── Resume Upload ─────────────────────────────────────────────
export const uploadResume = (file) => {
  const formData = new FormData();
  formData.append("resume", file);
  return axios.post(`${BASE}/upload-resume`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

// ── Smart Resume Parse (AI extraction) ────────────────────────
export const parseResume = (file) => {
  const formData = new FormData();
  formData.append("resume", file);
  return axios.post(`${BASE}/parse-resume`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 60000,
  });
};

// ── Preview Generated PDF ─────────────────────────────────────
export const previewResume = (profile, targetRole) =>
  axios.post(`${BASE}/preview-resume`, { profile, targetRole }, { timeout: 60000 });

// ── Auto-detect latest uploaded resume ────────────────────────
export const getLatestResume = () => axios.get(`${BASE}/latest-resume`);

// ── Poll Server Logs ──────────────────────────────────────────
export const getLogs = () => axios.get(`${BASE}/logs`);
