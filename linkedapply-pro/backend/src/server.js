// ============================================================
//  LinkedApply Pro — Backend Server
//  File: backend/src/server.js
// ============================================================

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

require("dotenv").config({ path: path.resolve(__dirname, "../../config/.env") });
const logger = require("./utils/logger");

const linkedinRouter = require("./linkedin/linkedinRouter");
const gmailRouter = require("./gmail/gmailRouter");

const app = express();
const PORT = process.env.PORT || 5000;
const uploadsDir = path.resolve(__dirname, "../../uploads");

fs.mkdirSync(uploadsDir, { recursive: true });

// ── Middleware ───────────────────────────────────────────────
app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ── File Upload (Resume) ─────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `resume_${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const { parseResume } = require("./utils/resumeParser");
const { buildTailoredResumePDF } = require("./utils/resumeTailor");

app.use("/api/downloads", express.static(uploadsDir));

app.post("/api/upload-resume", upload.single("resume"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  logger.info(`Resume uploaded: ${req.file.filename}`);
  res.json({ success: true, filename: req.file.filename, path: req.file.path });
});

// ── Smart Resume Parse (AI extraction) ───────────────────────
app.post("/api/parse-resume", upload.single("resume"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  logger.info(`Parsing resume with AI: ${req.file.filename}`);
  try {
    const result = await parseResume(req.file.path);
    res.json({
      success: result.success,
      filename: req.file.filename,
      path: req.file.path,
      profile: result.profile,
      rawText: result.rawText,           // Full text for AI tailoring
      rawTextPreview: result.rawText?.slice(0, 2000) || "",  // Short preview for UI
      error: result.error || null,
    });
  } catch (err) {
    logger.error(`Resume parse error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Routes ───────────────────────────────────────────────────
app.use("/api/linkedin", linkedinRouter);
app.use("/api/gmail", gmailRouter);

// ── Preview Resume (Generates a sample PDF for viewing) ──────
app.post("/api/preview-resume", async (req, res) => {
  try {
    const { profile, jobDescription, targetRole } = req.body;
    
    // Strip " + C2C" suffix if present so project bank matches correctly
    const cleanRole = targetRole ? targetRole.replace(/ \+ C2C/i, "") : "JAVA DEVELOPER";

    // Map the flat frontend profile to the expected resumeStructure format
    const formattedProfile = {
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      linkedIn: profile.linkedin,
      location: profile.location,
      summary: "",
      skills: profile.skills,
      experience: [{ title: profile.title, company: "Various", description: profile.experience }],
      education: [{ degree: profile.education, institution: "" }]
    };

    // Call buildTailoredResumePDF to generate the PDF
    const result = await buildTailoredResumePDF(
      formattedProfile, 
      jobDescription || "Sample Job Description", 
      "preview", 
      cleanRole
    );
    if (result.success) {
      // Return the static URL for the generated PDF
      res.json({ success: true, url: `http://localhost:${PORT}/api/downloads/tailored/${result.filename}` });
    } else {
      res.status(500).json({ success: false, error: "Failed to generate preview PDF." });
    }
  } catch (err) {
    logger.error(`Preview error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Latest Resume (auto-detect on startup) ───────────────────
app.get("/api/latest-resume", (req, res) => {
  try {
    const files = fs.readdirSync(uploadsDir)
      .filter(f => /\.(pdf|docx|doc)$/i.test(f))
      .map(f => ({ name: f, mtime: fs.statSync(path.join(uploadsDir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length === 0) return res.json({ found: false });

    const latest = files[0];
    res.json({
      found: true,
      filename: latest.name,
      path: path.join(uploadsDir, latest.name),
    });
  } catch (err) {
    res.json({ found: false, error: err.message });
  }
});

// ── Server Logs Endpoint (Polling for UI Console) ────────────
app.get("/api/logs", (req, res) => {
  try {
    const logPath = path.resolve(__dirname, "../../logs/app.log");
    if (!fs.existsSync(logPath)) {
      return res.json({ logs: [] });
    }
    const content = fs.readFileSync(logPath, "utf8");
    const lines = content.split("\n").filter(Boolean);
    res.json({ logs: lines.slice(-100) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Health Check ─────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// ── Start Server ─────────────────────────────────────────────
const server = app.listen(PORT, () => {
  logger.info(`✅ LinkedApply Pro backend running on http://localhost:${PORT}`);
});

// Allow long-running scraping + bulk email sends
server.setTimeout(60 * 60 * 1000); // 60 minutes

module.exports = app;
