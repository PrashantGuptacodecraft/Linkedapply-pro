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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── File Upload (Resume) ─────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `resume_${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

app.post("/api/upload-resume", upload.single("resume"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  logger.info(`Resume uploaded: ${req.file.filename}`);
  res.json({ success: true, filename: req.file.filename, path: req.file.path });
});

// ── Routes ───────────────────────────────────────────────────
app.use("/api/linkedin", linkedinRouter);
app.use("/api/gmail", gmailRouter);

// ── Health Check ─────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// ── Start Server ─────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`✅ LinkedApply Pro backend running on http://localhost:${PORT}`);
});

module.exports = app;
