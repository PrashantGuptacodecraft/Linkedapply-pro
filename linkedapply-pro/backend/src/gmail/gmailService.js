// ============================================================
//  LinkedApply Pro — Gmail Service
//  File: backend/src/gmail/gmailService.js
//  Uses: Nodemailer with Gmail App Password (SMTP)
// ============================================================

const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger");
const { tailorForJob } = require("../utils/groqService");
const { buildTailoredResumePDF, extractStructureFromRawText } = require("../utils/resumeTailor");

let transporter = null;

// ── Step 3: Login Gmail (create transporter) ─────────────────
async function loginGmail(gmailUser, gmailAppPassword) {
  try {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser,
        pass: gmailAppPassword,   // Use Gmail App Password (not account password)
      },
    });

    // Verify connection
    await transporter.verify();
    logger.info(`Gmail authenticated: ${gmailUser}`);
    return { success: true, message: "Gmail authenticated successfully" };
  } catch (err) {
    logger.error(`Gmail auth error: ${err.message}`);
    return { success: false, message: err.message };
  }
}

// ── Step 4: Send Application Email ───────────────────────────
async function sendApplicationEmail({ fromEmail, recruiterEmail, recruiterName, jobTitle, candidate, resumePath, ccEmails, bccEmails, skillLabel, teamLeadName, teamLeadEmail, jobDescription, postUrl, tailoredPitch, tailoredSkills, tailoredProjects }) {
  try {
    if (!transporter) {
      return { success: false, message: "Gmail not authenticated. Call /login first." };
    }

    const emailBody = buildEmailBody(candidate, jobDescription, postUrl, teamLeadEmail, tailoredPitch, tailoredSkills, tailoredProjects);
    const location = candidate.location || "Location";
    const skill = skillLabel || jobTitle || "Candidate";
    const subject = `Submission "${skill}" Local to "${location}"`;

    const mailOptions = {
      from: `"${candidate.name}" <${fromEmail}>`,
      to: recruiterEmail,
      subject,
      text: buildPlainTextFallback(candidate, jobDescription, postUrl, teamLeadEmail, tailoredPitch, tailoredSkills, tailoredProjects),
      html: emailBody,
      attachments: resumePath && fs.existsSync(resumePath)
        ? [{ filename: path.basename(resumePath), path: resumePath }]
        : [],
    };

    // Auto-CC: candidate email + team lead email + any extra CC emails
    const autoCc = [
      candidate.email,
      teamLeadEmail,
    ].filter(Boolean);
    const extraCc = ccEmails
      ? ccEmails.split(";").map(e => e.trim()).filter(Boolean)
      : [];
    const fullCc = [...new Set([...autoCc, ...extraCc])];
    if (fullCc.length > 0) mailOptions.cc = fullCc;

    // Add BCC
    if (bccEmails) {
      const bccList = bccEmails.split(";").map(e => e.trim()).filter(Boolean);
      if (bccList.length > 0) mailOptions.bcc = bccList;
    }

    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email sent to ${recruiterEmail} — MessageID: ${info.messageId}`);

    return {
      success: true,
      messageId: info.messageId,
      to: recruiterEmail,
      subject,
    };
  } catch (err) {
    logger.error(`Send email error to ${recruiterEmail}: ${err.message}`);
    return { success: false, message: err.message, to: recruiterEmail };
  }
}

// ── Bulk Send to Multiple Recruiters ─────────────────────────
async function sendBulkEmails({ fromEmail, recruiters, candidate, resumePath, resumeRawText, ccEmails, bccEmails, skillLabel, teamLeadName, teamLeadEmail, useTailoring }) {
  const results = [];
  let tailoringEnabled = useTailoring && !!process.env.GROQ_API_KEY;

  if (useTailoring && !process.env.GROQ_API_KEY) {
    logger.warn("[Groq] AI tailoring requested but GROQ_API_KEY is not set — sending with default content.");
  }

  // ── Extract resume structure ONCE per batch (AI call, expensive) ─
  let resumeStructure = null;
  if (tailoringEnabled && resumeRawText && resumeRawText.trim().length > 50) {
    logger.info("[ResumeTailor] Extracting resume structure for batch tailoring...");
    const extracted = await extractStructureFromRawText(resumeRawText);
    if (extracted.success && extracted.structure) {
      resumeStructure = extracted.structure;
      // Fill any missing fields from the candidate profile
      if (!resumeStructure.name)              resumeStructure.name              = candidate.name;
      if (!resumeStructure.email)             resumeStructure.email             = candidate.email;
      if (!resumeStructure.phone)             resumeStructure.phone             = candidate.phone;
      if (!resumeStructure.location)          resumeStructure.location          = candidate.location;
      if (!resumeStructure.linkedIn)          resumeStructure.linkedIn          = candidate.linkedIn;
      if (!resumeStructure.totalExperience)   resumeStructure.totalExperience   = candidate.totalExperience;
      if (!resumeStructure.workAuthorization) resumeStructure.workAuthorization = candidate.workAuthorization;
      if (!resumeStructure.title)             resumeStructure.title             = candidate.title;
      logger.info(`[ResumeTailor] Structure ready: ${resumeStructure.projects?.length || 0} projects, ${resumeStructure.skills?.length || 0} skills`);
    } else {
      logger.warn("[ResumeTailor] Structure extraction failed — will use original resume PDF.");
    }
  }

  let jobCounter = 0;

  for (const recruiter of recruiters) {
    jobCounter++;
    let tailoredPitch  = null;
    let tailoredSkills = null;
    let tailoredProjectsList = [];   // AI-selected projects filtered by role
    let attachResumePath = resumePath; // default: original PDF
    let isTailoredPdf = false;

    if (tailoringEnabled) {
      // ── Always tailor using role + job description ───────────────────────
      // skillLabel (e.g. "Data Analyst") is the domain filter.
      // Even when job description is empty the AI filters strictly by role.
      const tailored = await tailorForJob(candidate, recruiter.jobDescription || "", skillLabel);
      tailoredPitch  = tailored.tailoredPitch;
      tailoredSkills = tailored.tailoredSkills;

      // ── Generate role-filtered tailored PDF resume ───────────────────────
      if (resumeStructure) {
        const pdfResult = await buildTailoredResumePDF(
          resumeStructure,
          recruiter.jobDescription || "",
          jobCounter,
          skillLabel   // AI uses this as the domain filter
        );
        if (pdfResult.success && pdfResult.path && fs.existsSync(pdfResult.path)) {
          attachResumePath = pdfResult.path;
          isTailoredPdf = true;
          // Role-filtered projects go into the email body
          tailoredProjectsList = pdfResult.relevantProjects || [];
          logger.info(`[ResumeTailor] Attaching role-filtered PDF for "${skillLabel}": ${pdfResult.filename}`);
        }
      }
    }

    const result = await sendApplicationEmail({
      fromEmail,
      recruiterEmail: recruiter.email,
      recruiterName: recruiter.name,
      jobTitle: recruiter.jobTitle,
      candidate,
      resumePath: attachResumePath,
      ccEmails,
      bccEmails,
      skillLabel,
      teamLeadName,
      teamLeadEmail,
      jobDescription: recruiter.jobDescription || "",
      postUrl: recruiter.postUrl || "",
      tailoredPitch,
      tailoredSkills,
      tailoredProjects: tailoredProjectsList,
    });
    results.push({
      ...result,
      recruiter: recruiter.name,
      tailored: tailoringEnabled && !!tailoredPitch,
      tailoredResume: isTailoredPdf,
    });

    // Small delay between sends to avoid spam detection
    await new Promise((r) => setTimeout(r, 300));
  }
  return results;
}

// ── Email Template (Simple Clean Format) ─────────────────
function buildEmailBody(candidate, jobDescription, postUrl, teamLeadEmail, tailoredPitch, tailoredSkills, tailoredProjects) {
  const emailHtml = candidate.email ? `<a href="mailto:${candidate.email}" style="color:#2563eb;text-decoration:none;">${candidate.email}</a>` : "";
  const linkedInHtml = candidate.linkedIn ? `<a href="${candidate.linkedIn}" style="color:#2563eb;text-decoration:none;">${candidate.linkedIn}</a>` : "";
  const postUrlHtml = postUrl ? `<a href="${postUrl}" style="color:#2563eb;text-decoration:none;">${postUrl}</a>` : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px 0;">

    <p style="font-size:14px;color:#1e293b;line-height:1.7;margin:0 0 10px;">Hi,</p>
    <p style="font-size:14px;color:#1e293b;line-height:1.7;margin:0 0 16px;">Hope you are doing well,</p>
    <p style="font-size:14px;color:#1e293b;line-height:1.7;margin:0 0 16px;">Kindly find attached resume and below details:</p>

    <table cellpadding="0" cellspacing="0" style="font-size:14px;color:#1e293b;line-height:2.0;margin:0 0 8px;">
      ${candidate.name ? `<tr><td style="padding-right:14px;font-weight:600;">Full Name:</td><td>${candidate.name}</td></tr>` : ""}
      ${emailHtml ? `<tr><td style="padding-right:14px;font-weight:600;">Email Address :</td><td>${emailHtml}</td></tr>` : ""}
      ${candidate.phone ? `<tr><td style="padding-right:14px;font-weight:600;">Phone:</td><td>${candidate.phone}</td></tr>` : ""}
      ${linkedInHtml ? `<tr><td style="padding-right:14px;font-weight:600;">LinkedIn:</td><td>${linkedInHtml}</td></tr>` : ""}
      ${candidate.location ? `<tr><td style="padding-right:14px;font-weight:600;">Current Location:</td><td>${candidate.location}</td></tr>` : ""}
      ${candidate.openToRelocate ? `<tr><td style="padding-right:14px;font-weight:600;">Open to Relocate:</td><td>${candidate.openToRelocate}</td></tr>` : ""}
      ${candidate.workAuthorization ? `<tr><td style="padding-right:14px;font-weight:600;">Work Authorization:</td><td>${candidate.workAuthorization}</td></tr>` : ""}
      ${candidate.availability ? `<tr><td style="padding-right:14px;font-weight:600;">Availability:</td><td>${candidate.availability}</td></tr>` : ""}
      ${candidate.totalExperience ? `<tr><td style="padding-right:14px;font-weight:600;">Total Experience:</td><td>${candidate.totalExperience}</td></tr>` : ""}
      ${candidate.salary ? `<tr><td style="padding-right:14px;font-weight:600;">Salary:</td><td>${candidate.salary}</td></tr>` : ""}
    </table>

    <p style="font-size:14px;color:#1e293b;line-height:1.7;margin:20px 0 4px;">Regards</p>
    <p style="font-size:14px;color:#1e293b;margin:0;">${candidate.name || ""}</p>
    ${teamLeadEmail ? `<p style="font-size:14px;color:#1e293b;margin:4px 0 0;">${teamLeadEmail}</p>` : ""}
    ${postUrlHtml ? `<p style="font-size:14px;color:#1e293b;margin:16px 0 0;">Job description  link as per linkedin post: ${postUrlHtml}</p>` : ""}

  </div>
</body>
</html>`;
}

// ── Plain Text Fallback ────────────────────────────────────────
function buildPlainTextFallback(candidate, jobDescription, postUrl, teamLeadEmail, tailoredPitch, tailoredSkills, tailoredProjects) {
  const postUrlText = postUrl ? `\nJob description  link as per linkedin post: ${postUrl}` : "";

  return `Hi,
Hope you are doing well,
Kindly find attached resume and below details:
${candidate.name ? `Full Name:   ${candidate.name}\n` : ""}${candidate.email ? `Email Address :  ${candidate.email}\n` : ""}${candidate.phone ? `Phone:  ${candidate.phone}\n` : ""}${candidate.linkedIn ? `LinkedIn:    ${candidate.linkedIn}\n` : ""}${candidate.location ? `Current Location: ${candidate.location}\n` : ""}${candidate.openToRelocate ? `Open to Relocate: ${candidate.openToRelocate}\n` : ""}${candidate.workAuthorization ? `Work Authorization:  ${candidate.workAuthorization}\n` : ""}${candidate.availability ? `Availability: ${candidate.availability}\n` : ""}${candidate.totalExperience ? `Total Experience:  ${candidate.totalExperience}\n` : ""}${candidate.salary ? `Salary: ${candidate.salary}\n` : ""}
Regards
${candidate.name || ""}
${teamLeadEmail || ""}${postUrlText}`;
}

module.exports = { loginGmail, sendApplicationEmail, sendBulkEmails, buildEmailBody, buildPlainTextFallback };
