// ============================================================
//  LinkedApply Pro — Resume Tailor & PDF Generator
//  File: backend/src/utils/resumeTailor.js
//
//  Generates a PDF that matches the exact template layout:
//    Header → Education → Technical Skills → Projects (1,2,3)
//    → Coding Profile → Achievements → Additional
//
//  Technical Skills & Projects are filled per role from the
//  curated project bank + AI-filtered skills.
//  All other sections are static (from the template).
// ============================================================

const fs   = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const logger = require("./logger");
const { extractResumeStructure, tailorResumeForJob } = require("./groqService");

// Where we store generated tailored resumes
const TAILORED_DIR = path.resolve(__dirname, "../../../uploads/tailored");
fs.mkdirSync(TAILORED_DIR, { recursive: true });

// ── Colours & Fonts ──────────────────────────────────────────
const BLACK   = "#000000";
const ACCENT  = "#1e40af";   // Blue for links
const MUTED   = "#333333";

// ── Page Margins ─────────────────────────────────────────────
const MARGIN_X  = 50;
const MARGIN_Y  = 40;
const PAGE_W    = 595;  // A4 width in points
const CONTENT_W = PAGE_W - MARGIN_X * 2;

// ─────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────
function drawHRule(doc, y) {
  doc.save()
     .strokeColor(BLACK)
     .lineWidth(0.8)
     .moveTo(MARGIN_X, y)
     .lineTo(PAGE_W - MARGIN_X, y)
     .stroke()
     .restore();
}

function sectionTitle(doc, text) {
  doc.moveDown(0.45);
  doc.font("Helvetica-Bold")
     .fontSize(12)
     .fillColor(BLACK)
     .text(text, MARGIN_X, doc.y, { width: CONTENT_W });
  drawHRule(doc, doc.y + 2);
  doc.moveDown(0.3);
}

function bulletPoint(doc, text, indent = 10) {
  const x = MARGIN_X + indent;
  const y = doc.y;
  doc.font("Helvetica")
     .fontSize(10)
     .fillColor(BLACK)
     .text("• ", MARGIN_X, y, { continued: true, width: CONTENT_W })
     .text(text, { continued: false });
}

// ─────────────────────────────────────────────────────────────
//  generateTailoredPDF
//  Builds PDF matching the exact resume template layout.
//  Static sections are hardcoded. Skills + Projects are dynamic.
// ─────────────────────────────────────────────────────────────
function generateTailoredPDF(structure, tailored, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: MARGIN_Y, bottom: 40, left: MARGIN_X, right: MARGIN_X },
        info: {
          Title: `${structure.name || "Resume"} — Tailored Resume`,
          Author: structure.name || "Candidate",
        },
      });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // ══════════════════════════════════════════════════════════
      //  HEADER — Name, Location, Contact, Links
      // ══════════════════════════════════════════════════════════
      doc.font("Helvetica-Bold")
         .fontSize(22)
         .fillColor(BLACK)
         .text(structure.name || "Prashant Gupta", MARGIN_X, MARGIN_Y, {
           align: "center", width: CONTENT_W,
         });

      doc.font("Helvetica")
         .fontSize(10)
         .fillColor(MUTED)
         .text("Ghaziabad, India", { align: "center", width: CONTENT_W });

      doc.moveDown(0.15);

      // Email + Phone line
      const contactLine = [
        structure.email || "adityagupta983869@gmail.com",
        structure.phone || "+91-9838693305",
      ].join("     ");
      doc.font("Helvetica")
         .fontSize(9)
         .fillColor(BLACK)
         .text(contactLine, MARGIN_X, doc.y, { align: "center", width: CONTENT_W });

      doc.moveDown(0.1);

      // Links line — GitHub | LinkedIn | LeetCode
      doc.font("Helvetica")
         .fontSize(9)
         .fillColor(ACCENT)
         .text("GitHub   |   LinkedIn   |   LeetCode", MARGIN_X, doc.y, {
           align: "center", width: CONTENT_W,
         });

      doc.moveDown(0.5);

      // ══════════════════════════════════════════════════════════
      //  EDUCATION (Static)
      // ══════════════════════════════════════════════════════════
      sectionTitle(doc, "Education");

      doc.font("Helvetica-Bold")
         .fontSize(10)
         .fillColor(BLACK)
         .text("Bachelor of Technology (B.Tech) – Computer Science Engineering", MARGIN_X, doc.y, {
           width: CONTENT_W,
         });

      // KIET + year on same line
      const eduY = doc.y;
      doc.font("Helvetica")
         .fontSize(10)
         .fillColor(BLACK)
         .text("KIET Group of Institutions", MARGIN_X, eduY, { width: CONTENT_W * 0.7 });
      doc.font("Helvetica")
         .fontSize(10)
         .fillColor(BLACK)
         .text("2024 – 2028", MARGIN_X, eduY, { width: CONTENT_W, align: "right" });

      doc.font("Helvetica")
         .fontSize(10)
         .fillColor(BLACK)
         .text("SGPA: 8.0 / 10", MARGIN_X, doc.y);

      // ══════════════════════════════════════════════════════════
      //  TECHNICAL SKILLS (Dynamic — filled per role by AI)
      // ══════════════════════════════════════════════════════════
      sectionTitle(doc, "Technical Skills");

      const skills = tailored.relevantSkills || [];
      if (skills.length > 0) {
        // Group skills into categories if possible, otherwise just list them
        doc.font("Helvetica")
           .fontSize(10)
           .fillColor(BLACK)
           .text(skills.join(",  "), MARGIN_X, doc.y, { width: CONTENT_W });
      }

      doc.moveDown(0.2);

      // ══════════════════════════════════════════════════════════
      //  PROJECTS (Dynamic — 3 projects from bank, per role)
      // ══════════════════════════════════════════════════════════
      sectionTitle(doc, "Projects");

      const projects = tailored.relevantProjects || [];
      projects.forEach((proj, idx) => {
        // Project label: "1. Project Name" in bold
        doc.font("Helvetica-Bold")
           .fontSize(10)
           .fillColor(BLACK)
           .text(`${idx + 1}. ${proj.name || ""}`, MARGIN_X, doc.y, {
             width: CONTENT_W,
           });

        if (proj.techStack) {
          doc.moveDown(0.1);
          doc.font("Helvetica")
             .fontSize(10)
             .fillColor(BLACK)
             .text(`Tech Stack: ${proj.techStack}`, MARGIN_X, doc.y, {
               width: CONTENT_W,
             });
        }

        doc.moveDown(0.2);

        // Description as bullet points
        if (proj.description) {
          // Split description by sentences/periods for cleaner bullet points
          const sentences = proj.description
            .split(/\.\s+/)
            .map(s => s.trim())
            .filter(s => s.length > 5);

          sentences.forEach(sentence => {
            const cleaned = sentence.endsWith(".") ? sentence : sentence + ".";
            bulletPoint(doc, cleaned);
          });
        }

        doc.moveDown(0.35);
      });

      // ══════════════════════════════════════════════════════════
      //  CODING PROFILE (Static)
      // ══════════════════════════════════════════════════════════
      sectionTitle(doc, "Coding Profile");

      bulletPoint(doc, "Solved 400+ coding problems on LeetCode.");
      bulletPoint(doc, "Strong understanding of arrays, strings, recursion, sorting, searching, linked lists, stacks, queues, trees, and graphs.");
      bulletPoint(doc, "Practicing Java-based problem solving for interviews and competitive programming.");

      // ══════════════════════════════════════════════════════════
      //  ACHIEVEMENTS (Static)
      // ══════════════════════════════════════════════════════════
      sectionTitle(doc, "Achievements");

      bulletPoint(doc, "AWS Certified Cloud Practitioner – Foundational Level.");
      bulletPoint(doc, "Participated in Stellaris Hackathon and developed a project under time constraints.");
      bulletPoint(doc, "Active learner in Java development, backend APIs, and software engineering fundamentals.");

      // ══════════════════════════════════════════════════════════
      //  ADDITIONAL (Static)
      // ══════════════════════════════════════════════════════════
      sectionTitle(doc, "Additional");

      bulletPoint(doc, "Interested in Java Developer, Backend Developer, and Full Stack Developer roles.");
      bulletPoint(doc, "Comfortable working with GitHub, REST APIs, databases, and web application development.");
      bulletPoint(doc, "Continuously improving Java, Spring Boot, DSA, DBMS, and system design basics.");

      // ── Finalize ────────────────────────────────────────────
      doc.end();
      stream.on("finish", () => {
        logger.info(`[ResumeTailor] PDF generated: ${path.basename(outputPath)}`);
        resolve(outputPath);
      });
      stream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
}

// ─────────────────────────────────────────────────────────────
//  Main exported function
//
//  resumeStructure : already-extracted structure (cached per batch)
//  jobDescription  : text of the LinkedIn job post
//  jobId           : unique identifier to name the output file
//  targetRole      : selected role keyword (e.g. "Java Developer")
//
//  Returns: { success, path, filename, relevantProjects }
// ─────────────────────────────────────────────────────────────
async function buildTailoredResumePDF(resumeStructure, jobDescription, jobId, targetRole) {
  try {
    // 1. Ask AI to tailor skills + pick projects from bank for this role
    const tailored = await tailorResumeForJob(resumeStructure, jobDescription, targetRole);

    // 2. Generate the PDF matching the template layout
    const safeName = (resumeStructure.name || "resume").replace(/[^a-zA-Z0-9]/g, "_");
    const filename  = `tailored_${safeName}_${jobId || Date.now()}.pdf`;
    const outputPath = path.join(TAILORED_DIR, filename);

    await generateTailoredPDF(resumeStructure, tailored, outputPath);
    return { success: true, path: outputPath, filename, relevantProjects: tailored.relevantProjects || [] };
  } catch (err) {
    logger.error(`[ResumeTailor] Failed to build tailored PDF: ${err.message}`);
    return { success: false, path: null, relevantProjects: [] };
  }
}

/**
 * One-time extraction: parse raw resume text → structured JSON.
 * Call this ONCE per upload/batch, cache the result.
 */
async function extractStructureFromRawText(rawText) {
  return extractResumeStructure(rawText);
}

module.exports = { buildTailoredResumePDF, extractStructureFromRawText };
