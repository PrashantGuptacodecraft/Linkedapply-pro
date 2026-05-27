// ============================================================
//  LinkedApply Pro — LinkedIn API Router
//  File: backend/src/linkedin/linkedinRouter.js
// ============================================================

const express = require("express");
const router = express.Router();
const { loginLinkedIn, searchJobPosts, closeBrowser } = require("./linkedinService");
const logger = require("../utils/logger");

// POST /api/linkedin/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password required" });

  logger.info(`LinkedIn login attempt for: ${email}`);
  const result = await loginLinkedIn(email, password);
  res.json(result);
});

// POST /api/linkedin/search
router.post("/search", async (req, res) => {
  const { keywords, hoursBack = 24, location, workAuth } = req.body;
  if (!keywords)
    return res.status(400).json({ error: "Keywords required" });

  logger.info(`Job search: "${keywords}" in "${location || "Anywhere"}" last ${hoursBack}h (workAuth: ${workAuth || "any"})`);
  const result = await searchJobPosts(keywords, hoursBack, location, workAuth || "");
  res.json(result);
});

// POST /api/linkedin/logout
router.post("/logout", async (req, res) => {
  await closeBrowser();
  res.json({ success: true, message: "Browser closed" });
});

// POST /api/linkedin/auto-apply
router.post("/auto-apply", async (req, res) => {
  const { userData, jobKeywords, location, allowedTitles } = req.body;
  if (!userData || !jobKeywords || !location || !allowedTitles) {
    return res.status(400).json({ error: "Missing required fields for auto-apply" });
  }

  logger.info(`Starting portal auto-apply flow for keywords: ${jobKeywords.join(", ")}`);
  try {
    const { autoApplyJobs } = require("./jobSearchService");
    const result = await autoApplyJobs(userData, jobKeywords, location, allowedTitles);
    res.json(result);
  } catch (error) {
    logger.error(`Error in auto-apply: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
