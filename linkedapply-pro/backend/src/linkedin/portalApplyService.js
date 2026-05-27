const logger = require("../utils/logger");
const path = require("path");
const fs = require("fs");

/**
 * Attempts to automatically fill an external company portal application form.
 * Uses multiple heuristic selectors to handle Workday, Greenhouse, Lever, iCIMS, Taleo, etc.
 *
 * @param {import('playwright').Page} portalPage - Playwright page for the new tab.
 * @param {Object} userData - User information to fill the form.
 */
async function autofillPortalForm(portalPage, userData) {
  try {
    const url = portalPage.url();
    logger.info(`[PortalApply] Starting autofill: ${url}`);

    // ── Wait for page to fully render ────────────────────────
    await portalPage.waitForLoadState("domcontentloaded", { timeout: 20000 });
    try {
      await portalPage.waitForLoadState("networkidle", { timeout: 10000 });
    } catch (_) {}
    await portalPage.waitForTimeout(3000); // Allow React/SPA rendering

    // ── Click any initial "Apply" / "Apply Now" buttons ──────
    const applyClickSelectors = [
      "button:has-text('Apply for this job')",
      "button:has-text('Apply Now')",
      "button:has-text('Apply now')",
      "a:has-text('Apply Now')",
      "a:has-text('Apply for this job')",
      "a[data-mapped='true']:has-text('Apply')",
      ".postings-btn:has-text('Apply')",          // Lever
      "button[data-automation-id='applyNow']",   // Workday
      "#apply-button",
    ];

    for (const sel of applyClickSelectors) {
      try {
        const btn = portalPage.locator(sel).first();
        if (await btn.isVisible({ timeout: 1000 })) {
          logger.info(`[PortalApply] Clicking initial apply button: ${sel}`);
          await btn.click();
          await portalPage.waitForTimeout(2500);
          break;
        }
      } catch (_) {}
    }

    // ── Helper: try to fill a field with multiple selectors ──
    const tryFill = async (selectors, value) => {
      if (!value) return false;
      for (const sel of selectors) {
        try {
          const el = portalPage.locator(sel).first();
          if (await el.isVisible({ timeout: 800 })) {
            await el.fill(String(value));
            logger.info(`[PortalApply] Filled: ${sel}`);
            return true;
          }
        } catch (_) {}
      }
      return false;
    };

    // ── Helper: select from a <select> dropdown ───────────────
    const trySelect = async (selectors, value) => {
      if (!value) return false;
      for (const sel of selectors) {
        try {
          const el = portalPage.locator(sel).first();
          if (await el.isVisible({ timeout: 800 })) {
            await el.selectOption({ label: value }).catch(() =>
              el.selectOption({ value })
            );
            logger.info(`[PortalApply] Selected: ${sel} = ${value}`);
            return true;
          }
        } catch (_) {}
      }
      return false;
    };

    // ── 1. First Name ─────────────────────────────────────────
    await tryFill(
      [
        "input[name*='first' i]",
        "input[id*='first' i]",
        "input[placeholder*='first' i]",
        "input[autocomplete='given-name']",
        "input[data-automation-id='legalNameSection_firstName']",  // Workday
        "[name='firstName']",
        "[id='firstName']",
      ],
      userData.firstName || (userData.name || "").split(" ")[0]
    );

    // ── 2. Last Name ──────────────────────────────────────────
    await tryFill(
      [
        "input[name*='last' i]",
        "input[id*='last' i]",
        "input[placeholder*='last' i]",
        "input[autocomplete='family-name']",
        "input[data-automation-id='legalNameSection_lastName']",   // Workday
        "[name='lastName']",
        "[id='lastName']",
      ],
      userData.lastName ||
        (userData.name || "").split(" ").slice(1).join(" ")
    );

    // ── 3. Full Name (fallback if no first/last fields) ───────
    await tryFill(
      [
        "input[name='name' i]",
        "input[placeholder*='full name' i]",
        "input[autocomplete='name']",
      ],
      userData.name || `${userData.firstName || ""} ${userData.lastName || ""}`.trim()
    );

    // ── 4. Email ──────────────────────────────────────────────
    await tryFill(
      [
        "input[type='email']",
        "input[name*='email' i]",
        "input[id*='email' i]",
        "input[placeholder*='email' i]",
        "input[autocomplete='email']",
        "input[data-automation-id='email']",
      ],
      userData.email || ""
    );

    // ── 5. Phone ──────────────────────────────────────────────
    await tryFill(
      [
        "input[type='tel']",
        "input[name*='phone' i]",
        "input[id*='phone' i]",
        "input[placeholder*='phone' i]",
        "input[autocomplete='tel']",
        "input[data-automation-id='phone']",
      ],
      userData.phone || ""
    );

    // ── 6. LinkedIn URL ───────────────────────────────────────
    await tryFill(
      [
        "input[name*='linkedin' i]",
        "input[id*='linkedin' i]",
        "input[placeholder*='linkedin' i]",
        "input[data-automation-id='linkedinUrl']",
      ],
      userData.linkedinUrl || ""
    );

    // ── 7. Location / City ────────────────────────────────────
    await tryFill(
      [
        "input[name*='location' i]",
        "input[id*='location' i]",
        "input[placeholder*='location' i]",
        "input[name*='city' i]",
        "input[autocomplete='address-level2']",
      ],
      userData.location || ""
    );

    // ── 8. Resume Upload ──────────────────────────────────────
    // Resolve resume path
    let resumePath = userData.resumePath || null;
    if (!resumePath) {
      const uploadsDir = path.resolve(__dirname, "../../../../uploads");
      if (fs.existsSync(uploadsDir)) {
        const files = fs
          .readdirSync(uploadsDir)
          .filter((f) => f.endsWith(".pdf"))
          .sort()
          .reverse(); // most recent first
        if (files.length > 0) {
          resumePath = path.join(uploadsDir, files[0]);
        }
      }
    }

    if (resumePath && fs.existsSync(resumePath)) {
      const fileInputSelectors = [
        "input[type='file'][name*='resume' i]",
        "input[type='file'][name*='cv' i]",
        "input[type='file'][id*='resume' i]",
        "input[type='file'][accept*='pdf']",
        "input[type='file']",                           // generic fallback
        "[data-automation-id='file-upload-input-ref']", // Workday
      ];
      for (const sel of fileInputSelectors) {
        try {
          const el = portalPage.locator(sel).first();
          // Use isAttached (not isVisible) because file inputs are often hidden
          if (await el.evaluate((e) => !!e).catch(() => false)) {
            logger.info(`[PortalApply] Uploading resume via: ${sel}`);
            await el.setInputFiles(resumePath);
            await portalPage.waitForTimeout(2000);
            break;
          }
        } catch (_) {}
      }
    } else {
      logger.warn(`[PortalApply] No resume file found at: ${resumePath}`);
    }

    // ── 9. Work Authorization dropdowns ──────────────────────
    if (userData.workAuth) {
      await trySelect(
        [
          "select[name*='authorization' i]",
          "select[name*='visa' i]",
          "select[id*='authorization' i]",
        ],
        userData.workAuth
      );
    }

    // ── 10. Scroll down to reveal more fields ─────────────────
    await portalPage.evaluate(() => window.scrollBy(0, 600));
    await portalPage.waitForTimeout(1000);

    logger.info("[PortalApply] ✅ Autofill complete. Tab left open for review/submit.");
    return { success: true, message: "Form filled. Please review and submit." };
  } catch (error) {
    logger.error(`[PortalApply] Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

module.exports = { autofillPortalForm };
