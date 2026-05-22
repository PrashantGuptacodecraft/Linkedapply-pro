// ============================================================
//  LinkedApply Pro — Resume Parser Service
//  File: backend/src/utils/resumeParser.js
//  Parses PDF / DOCX → plain text, then uses Groq AI to
//  extract structured candidate profile data from it.
// ============================================================

const fs = require("fs");
const path = require("path");
const logger = require("./logger");
const { callGroq } = require("./groqService");

/**
 * Extract raw text from a resume file (PDF or DOCX).
 * Returns plain text string.
 */
async function extractTextFromResume(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".pdf") {
    const pdfParse = require("pdf-parse");
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text || "";
  }

  if (ext === ".docx") {
    const mammoth = require("mammoth");
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value || "";
  }

  if (ext === ".doc") {
    // Basic fallback for .doc — read as buffer, extract printable chars
    const buffer = fs.readFileSync(filePath);
    return buffer.toString("utf8").replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s+/g, " ");
  }

  throw new Error(`Unsupported resume format: ${ext}. Please upload PDF or DOCX.`);
}

/**
 * Use Groq AI to parse the resume text into a structured candidate profile.
 * Returns an object matching the candidate profile fields used by the app.
 */
async function parseResumeWithAI(resumeText) {
  const truncatedText = resumeText.slice(0, 4000); // Groq context limit safety

  const prompt = `You are an expert resume parser. Extract structured information from this resume text and return ONLY a valid JSON object — no markdown, no explanation, just the raw JSON.

RESUME TEXT:
"""
${truncatedText}
"""

Extract these fields exactly. If a field is not found, use an empty string "":
{
  "candidateName": "Full name of the person",
  "candidateTitle": "Current or most recent job title (e.g. Senior Java Developer)",
  "candidateSkills": "Comma-separated list of top technical skills found in the resume",
  "candidateLocation": "City, State or City, Country if found",
  "candidatePhone": "Phone number if found",
  "candidateEmailContact": "Email address if found",
  "candidateLinkedIn": "LinkedIn URL if found",
  "totalExperience": "Total years of experience (e.g. '4 Years', '6+ Years')",
  "workAuthorization": "Work authorization status if mentioned (e.g. 'US Citizen', 'H1B', 'GC', 'EAD')",
  "candidateSummary": "A 2-3 sentence professional summary extracted or inferred from the resume",
  "topTechnologies": "Top 5-8 specific technologies/tools from the resume (comma separated)",
  "educationHighlight": "Highest degree and field, university name",
  "certifications": "Any certifications found (comma separated)"
}

Return ONLY the JSON object, nothing else.`;

  try {
    const response = await callGroq([
      {
        role: "system",
        content: "You are a precise resume parser. Always respond with valid JSON only, no markdown fences, no extra text.",
      },
      { role: "user", content: prompt },
    ], 600);

    // Strip any markdown fences if model added them
    const cleaned = response.replace(/```json\n?/gi, "").replace(/```\n?/gi, "").trim();
    const parsed = JSON.parse(cleaned);
    logger.info(`[ResumeParser] Extracted profile for: ${parsed.candidateName || "Unknown"}`);
    return { success: true, profile: parsed };
  } catch (err) {
    logger.error(`[ResumeParser] AI parse failed: ${err.message}`);
    return { success: false, profile: null, error: err.message };
  }
}

/**
 * Full pipeline: file path → text extraction → AI parsing → structured profile
 */
async function parseResume(filePath) {
  try {
    logger.info(`[ResumeParser] Parsing resume: ${path.basename(filePath)}`);
    const rawText = await extractTextFromResume(filePath);

    if (!rawText || rawText.trim().length < 50) {
      return {
        success: false,
        error: "Could not extract enough text from the resume. Please make sure it's not a scanned image PDF.",
        rawText: "",
        profile: null,
      };
    }

    logger.info(`[ResumeParser] Extracted ${rawText.length} chars from resume`);
    const aiResult = await parseResumeWithAI(rawText);

    return {
      success: aiResult.success,
      rawText: rawText,              // Full text for tailoring
      profile: aiResult.profile,
      error: aiResult.error || null,
    };
  } catch (err) {
    logger.error(`[ResumeParser] Parse error: ${err.message}`);
    return {
      success: false,
      error: err.message,
      rawText: "",
      profile: null,
    };
  }
}

module.exports = { parseResume, extractTextFromResume };
