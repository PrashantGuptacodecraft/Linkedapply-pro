// ============================================================
//  LinkedApply Pro — Gmail API Router
//  File: backend/src/gmail/gmailRouter.js
// ============================================================

const express = require("express");
const router = express.Router();
const { loginGmail, sendApplicationEmail, sendBulkEmails } = require("./gmailService");
const logger = require("../utils/logger");

// POST /api/gmail/login
router.post("/login", async (req, res) => {
  const { gmailUser, gmailAppPassword } = req.body;
  if (!gmailUser || !gmailAppPassword)
    return res.status(400).json({ error: "Gmail credentials required" });

  const result = await loginGmail(gmailUser, gmailAppPassword);
  res.json(result);
});

// POST /api/gmail/send-single
router.post("/send-single", async (req, res) => {
  const { fromEmail, recruiterEmail, recruiterName, jobTitle, candidate, resumePath, ccEmails, bccEmails, skillLabel, teamLeadName, teamLeadEmail, jobDescription, postUrl } = req.body;
  if (!recruiterEmail || !jobTitle || !candidate)
    return res.status(400).json({ error: "Missing required fields" });

  const result = await sendApplicationEmail({
    fromEmail, recruiterEmail, recruiterName, jobTitle, candidate, resumePath,
    ccEmails, bccEmails, skillLabel, teamLeadName, teamLeadEmail, jobDescription, postUrl,
  });
  res.json(result);
});

// POST /api/gmail/send-bulk
router.post("/send-bulk", async (req, res) => {
  const { fromEmail, recruiters, candidate, resumePath, ccEmails, bccEmails, skillLabel, teamLeadName, teamLeadEmail } = req.body;
  if (!recruiters || !Array.isArray(recruiters) || recruiters.length === 0)
    return res.status(400).json({ error: "Recruiters array required" });

  logger.info(`Bulk send: ${recruiters.length} emails`);
  const results = await sendBulkEmails({
    fromEmail, recruiters, candidate, resumePath,
    ccEmails, bccEmails, skillLabel, teamLeadName, teamLeadEmail,
  });
  const sent = results.filter((r) => r.success).length;
  res.json({ success: true, total: recruiters.length, sent, failed: recruiters.length - sent, results });
});

// POST /api/gmail/preview
router.post("/preview", (req, res) => {
  const { candidate, teamLeadName, teamLeadEmail, jobDescription } = req.body;
  const { buildEmailBody } = require("./gmailService");
  const body = buildEmailBody(candidate || {}, teamLeadName || "", teamLeadEmail || "", jobDescription || "");
  res.json({ preview: body });
});

module.exports = router;
