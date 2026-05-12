// ============================================================
//  LinkedApply Pro — Frontend API Service
//  File: frontend/src/api.js
// ============================================================

import axios from "axios";

const BASE = "/api";

// ── LinkedIn ─────────────────────────────────────────────────
export const linkedinLogin = (email, password) =>
  axios.post(`${BASE}/linkedin/login`, { email, password });

export const linkedinSearch = (keywords, hoursBack) =>
  axios.post(`${BASE}/linkedin/search`, { keywords, hoursBack });

export const linkedinLogout = () =>
  axios.post(`${BASE}/linkedin/logout`);

// ── Gmail ────────────────────────────────────────────────────
export const gmailLogin = (gmailUser, gmailAppPassword) =>
  axios.post(`${BASE}/gmail/login`, { gmailUser, gmailAppPassword });

export const sendBulkEmails = (payload) =>
  axios.post(`${BASE}/gmail/send-bulk`, payload);

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
