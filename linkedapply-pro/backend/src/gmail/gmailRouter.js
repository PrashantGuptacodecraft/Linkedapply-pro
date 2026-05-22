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
  const {
    fromEmail, recruiters, candidate, resumePath, resumeRawText,
    ccEmails, bccEmails, skillLabel, teamLeadName, teamLeadEmail, useTailoring,
  } = req.body;
  if (!recruiters || !Array.isArray(recruiters) || recruiters.length === 0)
    return res.status(400).json({ error: "Recruiters array required" });

  const MAX_BULK_EMAILS = 500;
  let processedRecruiters = recruiters;
  let dropped = 0;
  if (recruiters.length > MAX_BULK_EMAILS) {
    dropped = recruiters.length - MAX_BULK_EMAILS;
    processedRecruiters = recruiters.slice(0, MAX_BULK_EMAILS);
    logger.warn(`Recruiter list truncated to ${MAX_BULK_EMAILS} emails per run. ${dropped} recruiters were dropped.`);
  }

  logger.info(`Bulk send: ${processedRecruiters.length} emails (requested ${recruiters.length}, AI tailoring: ${!!useTailoring}, resumeText: ${resumeRawText ? resumeRawText.length + " chars" : "none"})`);
  const results = await sendBulkEmails({
    fromEmail, recruiters: processedRecruiters, candidate, resumePath, resumeRawText,
    ccEmails, bccEmails, skillLabel, teamLeadName, teamLeadEmail, useTailoring,
  });
  const sent   = results.filter((r) => r.success).length;
  const tailoredPdfCount = results.filter((r) => r.tailoredResume).length;
  res.json({
    success: true,
    total: recruiters.length,
    processed: processedRecruiters.length,
    dropped,
    sent,
    failed: processedRecruiters.length - sent,
    tailoredPdfCount,
    results,
    message: dropped ? `Max 500 emails per run. Sent first ${processedRecruiters.length} recruiters.` : undefined,
  });
});

// POST /api/gmail/preview
router.post("/preview", (req, res) => {
  const { candidate, teamLeadName, teamLeadEmail, jobDescription } = req.body;
  const { buildEmailBody } = require("./gmailService");
  const body = buildEmailBody(candidate || {}, teamLeadName || "", teamLeadEmail || "", jobDescription || "");
  res.json({ preview: body });
});

module.exports = router;
