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
async function sendApplicationEmail({ fromEmail, recruiterEmail, recruiterName, jobTitle, candidate, resumePath }) {
  try {
    if (!transporter) {
      return { success: false, message: "Gmail not authenticated. Call /login first." };
    }

    const emailBody = buildEmailBody(recruiterName, jobTitle, candidate);
    const subject = `Application for ${jobTitle} – ${candidate.name} | ${candidate.visa}`;

    const mailOptions = {
      from: `"${candidate.name}" <${fromEmail}>`,
      to: recruiterEmail,
      subject,
      text: emailBody,
      attachments: resumePath && fs.existsSync(resumePath)
        ? [{ filename: path.basename(resumePath), path: resumePath }]
        : [],
    };

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
async function sendBulkEmails({ fromEmail, recruiters, candidate, resumePath }) {
  const results = [];
  for (const recruiter of recruiters) {
    const result = await sendApplicationEmail({
      fromEmail,
      recruiterEmail: recruiter.email,
      recruiterName: recruiter.name,
      jobTitle: recruiter.jobTitle,
      candidate,
      resumePath,
    });
    results.push({ ...result, recruiter: recruiter.name });

    // Small delay between sends to avoid spam detection
    await new Promise((r) => setTimeout(r, 1500));
  }
  return results;
}

// ── Email Template ────────────────────────────────────────────
function buildEmailBody(recruiterName, jobTitle, candidate) {
  return `Dear ${recruiterName},

I hope this message finds you well. I came across your recent LinkedIn post regarding the "${jobTitle}" opportunity and I am very interested in this position.

Please find my resume attached for your consideration. Below are my submission details:

Candidate Name   : ${candidate.name}
Current Title    : ${candidate.title}
Core Skills      : ${candidate.skills}
Location         : ${candidate.location}
Visa Status      : ${candidate.visa}
Availability     : ${candidate.availability}
Phone            : ${candidate.phone}
Email            : ${candidate.email}

I am actively looking for Contract / C2C roles and am available to start immediately. I would love the opportunity to discuss how my background aligns with your requirements.

Thank you for your time and consideration. I look forward to hearing from you.

Best regards,
${candidate.name}
${candidate.email}
${candidate.phone}`;
}

module.exports = { loginGmail, sendApplicationEmail, sendBulkEmails, buildEmailBody };
