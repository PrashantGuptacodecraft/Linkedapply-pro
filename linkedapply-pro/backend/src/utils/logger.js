// ============================================================
//  LinkedApply Pro — Logger Utility
//  File: backend/src/utils/logger.js
// ============================================================

const { createLogger, format, transports } = require("winston");
const fs = require("fs");
const path = require("path");

const logsDir = path.resolve(__dirname, "../../../logs");
fs.mkdirSync(logsDir, { recursive: true });

const logger = createLogger({
  level: "info",
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()}: ${message}`)
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: path.join(logsDir, "app.log") }),
    new transports.File({ filename: path.join(logsDir, "error.log"), level: "error" }),
  ],
});

module.exports = logger;
