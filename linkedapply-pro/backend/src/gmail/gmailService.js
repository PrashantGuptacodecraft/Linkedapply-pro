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
      text: buildPlainTextFallback(recruiterName, jobTitle, candidate),
      html: emailBody,
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

// ── Email Template (Professional HTML) ────────────────────────
function buildEmailBody(recruiterName, jobTitle, candidate) {
  const accentColor = "#0ea5e9";
  const skillsList = (candidate.skills || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => `<span style="display:inline-block;background:#f0f9ff;color:#0369a1;padding:3px 10px;border-radius:4px;font-size:12px;margin:2px 3px 2px 0;border:1px solid #bae6fd;">${s}</span>`)
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

        <!-- Accent Top Bar -->
        <tr><td style="height:4px;background:linear-gradient(90deg,${accentColor},#6366f1);"></td></tr>

        <!-- Body -->
        <tr><td style="padding:32px 36px;">

          <p style="font-size:15px;color:#1e293b;line-height:1.7;margin:0 0 18px;">Dear ${recruiterName},</p>

          <p style="font-size:14px;color:#334155;line-height:1.7;margin:0 0 14px;">I came across your recent LinkedIn post regarding <strong style="color:#0f172a;">&ldquo;${jobTitle}&rdquo;</strong> and would like to express my interest. Please find my resume attached for your consideration.</p>

          <!-- Candidate Card -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin:20px 0;">
            <tr><td style="padding:20px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-bottom:14px;border-bottom:1px solid #e2e8f0;">
                    <span style="font-size:17px;font-weight:700;color:#0f172a;">${candidate.name}</span>
                    <span style="font-size:13px;color:#64748b;margin-left:8px;">${candidate.title}</span>
                  </td>
                </tr>
                <tr><td style="padding-top:14px;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#475569;line-height:2;">
                    <tr><td width="110" style="color:#94a3b8;font-weight:600;vertical-align:top;">Location</td><td>${candidate.location}</td></tr>
                    <tr><td style="color:#94a3b8;font-weight:600;vertical-align:top;">Visa Status</td><td>${candidate.visa}</td></tr>
                    <tr><td style="color:#94a3b8;font-weight:600;vertical-align:top;">Availability</td><td>${candidate.availability}</td></tr>
                    <tr><td style="color:#94a3b8;font-weight:600;vertical-align:top;">Phone</td><td><a href="tel:${candidate.phone}" style="color:${accentColor};text-decoration:none;">${candidate.phone}</a></td></tr>
                    <tr><td style="color:#94a3b8;font-weight:600;vertical-align:top;">Email</td><td><a href="mailto:${candidate.email}" style="color:${accentColor};text-decoration:none;">${candidate.email}</a></td></tr>
                  </table>
                </td></tr>
                ${skillsList ? `<tr><td style="padding-top:14px;border-top:1px solid #e2e8f0;margin-top:10px;">
                  <div style="color:#94a3b8;font-weight:600;font-size:13px;margin-bottom:8px;">Core Skills</div>
                  <div>${skillsList}</div>
                </td></tr>` : ""}
              </table>
            </td></tr>
          </table>

          <p style="font-size:14px;color:#334155;line-height:1.7;margin:0 0 10px;">I am actively seeking <strong>Contract / C2C</strong> opportunities and am available to start immediately. I would welcome the chance to discuss how my background aligns with your requirements.</p>

          <p style="font-size:14px;color:#334155;line-height:1.7;margin:0 0 24px;">Thank you for your time and consideration.</p>

          <!-- Signature -->
          <table cellpadding="0" cellspacing="0" style="border-top:1px solid #e2e8f0;padding-top:18px;margin-top:8px;">
            <tr><td>
              <p style="font-size:14px;color:#334155;margin:0 0 2px;">Best regards,</p>
              <p style="font-size:15px;font-weight:700;color:#0f172a;margin:4px 0 2px;">${candidate.name}</p>
              <p style="font-size:12px;color:#64748b;margin:0;"><a href="mailto:${candidate.email}" style="color:${accentColor};text-decoration:none;">${candidate.email}</a>&nbsp;&nbsp;|&nbsp;&nbsp;${candidate.phone}</p>
            </td></tr>
          </table>

        </td></tr>
      </table>

      <!-- Footer -->
      <table width="600" cellpadding="0" cellspacing="0">
        <tr><td style="padding:16px 0;text-align:center;font-size:11px;color:#94a3b8;">Sent via LinkedApply Pro</td></tr>
      </table>

    </td></tr>
  </table>
</body>
</html>`;
}

// ── Plain Text Fallback ────────────────────────────────────────
function buildPlainTextFallback(recruiterName, jobTitle, candidate) {
  return `Dear ${recruiterName},

I came across your recent LinkedIn post regarding "${jobTitle}" and would like to express my interest. Please find my resume attached.

${candidate.name} | ${candidate.title}
Skills: ${candidate.skills}
Location: ${candidate.location} | Visa: ${candidate.visa}
Availability: ${candidate.availability}
Phone: ${candidate.phone} | Email: ${candidate.email}

I am actively seeking Contract / C2C opportunities and am available immediately.

Best regards,
${candidate.name}
${candidate.email} | ${candidate.phone}`;
}

module.exports = { loginGmail, sendApplicationEmail, sendBulkEmails, buildEmailBody, buildPlainTextFallback };
