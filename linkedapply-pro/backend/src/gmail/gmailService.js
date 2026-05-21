// ============================================================
//  LinkedApply Pro — Gmail Service
//  File: backend/src/gmail/gmailService.js
//  Uses: Nodemailer with Gmail App Password (SMTP)
// ============================================================

const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger");

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
async function sendApplicationEmail({ fromEmail, recruiterEmail, recruiterName, jobTitle, candidate, resumePath, ccEmails, bccEmails, skillLabel, teamLeadName, teamLeadEmail, jobDescription, postUrl }) {
  try {
    if (!transporter) {
      return { success: false, message: "Gmail not authenticated. Call /login first." };
    }

    const emailBody = buildEmailBody(candidate, jobDescription, postUrl, teamLeadEmail);
    const location = candidate.location || "Location";
    const skill = skillLabel || jobTitle || "Candidate";
    const subject = `Submission "${skill}" Local to "${location}"`;

    const mailOptions = {
      from: `"${candidate.name}" <${fromEmail}>`,
      to: recruiterEmail,
      subject,
      text: buildPlainTextFallback(candidate, jobDescription, postUrl, teamLeadEmail),
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
async function sendBulkEmails({ fromEmail, recruiters, candidate, resumePath, ccEmails, bccEmails, skillLabel, teamLeadName, teamLeadEmail }) {
  const results = [];
  for (const recruiter of recruiters) {
    const result = await sendApplicationEmail({
      fromEmail,
      recruiterEmail: recruiter.email,
      recruiterName: recruiter.name,
      jobTitle: recruiter.jobTitle,
      candidate,
      resumePath,
      ccEmails,
      bccEmails,
      skillLabel,
      teamLeadName,
      teamLeadEmail,
      jobDescription: recruiter.jobDescription || "",
      postUrl: recruiter.postUrl || "",
    });
    results.push({ ...result, recruiter: recruiter.name });

    // Small delay between sends to avoid spam detection
    await new Promise((r) => setTimeout(r, 1500));
  }
  return results;
}

// ── Email Template (Simple Clean Format) ──────────────────────
function buildEmailBody(candidate, jobDescription, postUrl, teamLeadEmail) {
  const linkedInHtml = candidate.linkedIn
    ? `<a href="${candidate.linkedIn}" style="color:#0ea5e9;text-decoration:none;">${candidate.linkedIn}</a>`
    : "";
  const emailHtml = candidate.email
    ? `<a href="mailto:${candidate.email}" style="color:#0ea5e9;text-decoration:none;">${candidate.email}</a>`
    : "";

  // Post Link shown before Regards
  const postUrlHtml = postUrl
    ? `<p style="font-size:14px;color:#1e293b;line-height:1.7;margin:16px 0 10px;"><strong>Post Link:</strong> <a href="${postUrl}" style="color:#0ea5e9;text-decoration:none;">${postUrl}</a></p>`
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px 0;">

    <p style="font-size:14px;color:#1e293b;line-height:1.7;margin:0 0 10px;">Hi,</p>
    <p style="font-size:14px;color:#1e293b;line-height:1.7;margin:0 0 16px;">Hope you are doing well.</p>
    <p style="font-size:14px;color:#1e293b;line-height:1.7;margin:0 0 16px;">Kindly find attached resume and below details:</p>

    <table cellpadding="0" cellspacing="0" style="font-size:14px;color:#1e293b;line-height:2.0;margin:0 0 8px;">
      <tr><td style="padding-right:14px;font-weight:600;">Full Name:</td><td>${candidate.name || ""}</td></tr>
      <tr><td style="padding-right:14px;font-weight:600;">Email Address:</td><td>${emailHtml}</td></tr>
      <tr><td style="padding-right:14px;font-weight:600;">Phone:</td><td>${candidate.phone || ""}</td></tr>
      <tr><td style="padding-right:14px;font-weight:600;">LinkedIn:</td><td>${linkedInHtml}</td></tr>
      <tr><td style="padding-right:14px;font-weight:600;">Current Location:</td><td>${candidate.location || ""}</td></tr>
      <tr><td style="padding-right:14px;font-weight:600;">Open to Relocate:</td><td>${candidate.openToRelocate || "Yes"}</td></tr>
      <tr><td style="padding-right:14px;font-weight:600;">Work Authorization:</td><td>${candidate.workAuthorization || ""}</td></tr>
      <tr><td style="padding-right:14px;font-weight:600;">Availability:</td><td>${candidate.availability || "Immediate"}</td></tr>
      <tr><td style="padding-right:14px;font-weight:600;">Total Experience:</td><td>${candidate.totalExperience || ""}</td></tr>
      <tr><td style="padding-right:14px;font-weight:600;">Salary:</td><td>${candidate.salary || ""}</td></tr>
    </table>

    <p style="font-size:14px;color:#1e293b;line-height:1.7;margin:22px 0 10px;">I am actively looking for Contract / C2C roles and am available to start immediately. I would love the opportunity to discuss how my background aligns with your requirements.</p>
    <p style="font-size:14px;color:#1e293b;line-height:1.7;margin:0 0 6px;">Thank you for your time and consideration. I look forward to hearing from you.</p>

    ${postUrlHtml}

    <p style="font-size:14px;color:#1e293b;line-height:1.7;margin:20px 0 4px;">Regards,</p>
    <p style="font-size:14px;color:#1e293b;font-weight:600;margin:0;">${candidate.name || ""}</p>

  </div>
</body>
</html>`;
}

// ── Plain Text Fallback ────────────────────────────────────────
function buildPlainTextFallback(candidate, jobDescription, postUrl, teamLeadEmail) {
  const postUrlText = postUrl ? `\nPost Link: ${postUrl}\n` : "";
  return `Hi,

Hope you are doing well.

Kindly find attached resume and below details:

Full Name: ${candidate.name || ""}
Email Address: ${candidate.email || ""}
Phone: ${candidate.phone || ""}
LinkedIn: ${candidate.linkedIn || ""}
Current Location: ${candidate.location || ""}
Open to Relocate: ${candidate.openToRelocate || "Yes"}
Work Authorization: ${candidate.workAuthorization || ""}
Availability: ${candidate.availability || "Immediate"}
Total Experience: ${candidate.totalExperience || ""}
Salary: ${candidate.salary || ""}

I am actively looking for Contract / C2C roles and am available to start immediately. I would love the opportunity to discuss how my background aligns with your requirements.

Thank you for your time and consideration. I look forward to hearing from you.
${postUrlText}
Regards,

${candidate.name || ""}`;
}

module.exports = { loginGmail, sendApplicationEmail, sendBulkEmails, buildEmailBody, buildPlainTextFallback };
