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
    await portalPage.waitForLoadState("domcontentloaded", { timeout: 30000 });
    try {
      await portalPage.waitForLoadState("networkidle", { timeout: 15000 });
    } catch (_) {}
    await portalPage.waitForTimeout(4000); // Allow React/SPA rendering

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
        const isVis = await btn.isVisible({ timeout: 2000 }).catch(() => false);
        if (isVis) {
          logger.info(`[PortalApply] Clicking initial apply button: ${sel}`);
          // Use scroll + evaluate for reliability on slow connections
          try {
            await btn.scrollIntoViewIfNeeded();
            await portalPage.waitForTimeout(100);
          } catch (_) {}
          
          // Try direct click first
          try {
            await btn.click({ timeout: 1500 }).catch(() => {});
          } catch (_) {
            // Fallback to evaluate
            await btn.evaluate((el) => el.click()).catch(() => {});
          }
          
          await portalPage.waitForTimeout(3500);
          break;
        }
      } catch (e) {
        logger.debug(`[PortalApply] Failed to click ${sel}: ${e.message}`);
      }
    }

    // ── Helper: try to fill a field with retry logic ──
    const tryFill = async (selectors, value, fieldName = "") => {
      if (!value) return false;
      for (const sel of selectors) {
        try {
          const el = portalPage.locator(sel).first();
          const isVisible = await el.isVisible({ timeout: 1200 }).catch(() => false);
          if (isVisible) {
            // Clear before filling
            await el.fill("").catch(() => {});
            await portalPage.waitForTimeout(200);
            await el.fill(String(value));
            
            // Verify fill succeeded
            const filledValue = await el.inputValue().catch(() => "");
            if (filledValue === String(value) || filledValue.includes(value)) {
              logger.info(`[PortalApply] ✔ Filled ${fieldName || "field"}: ${sel}`);
              return true;
            } else {
              // Fallback: use paste method
              await el.triple_click().catch(() => {});
              await portalPage.keyboard.press("Delete");
              await el.type(String(value), { delay: 10 });
              logger.info(`[PortalApply] ✔ Filled (paste method) ${fieldName || "field"}: ${sel}`);
              return true;
            }
          }
        } catch (e) {
          logger.debug(`[PortalApply] tryFill failed ${fieldName || sel}: ${e.message}`);
        }
      }
      return false;
    };

    // ── Helper: select from dropdown (with retry) ───────────────
    const trySelect = async (selectors, value, fieldName = "") => {
      if (!value) return false;
      for (const sel of selectors) {
        try {
          const el = portalPage.locator(sel).first();
          const isVisible = await el.isVisible({ timeout: 1200 }).catch(() => false);
          if (isVisible) {
            // Try label first, then value, then click-based selection
            await el.selectOption({ label: value }).catch(() =>
              el.selectOption({ value }).catch(async () => {
                // Fallback: click and find option
                await el.click();
                await portalPage.waitForTimeout(300);
                const option = portalPage.locator(`option, [role="option"]`).locator(`:text-is("${value}")`).first();
                await option.click().catch(() => {});
              })
            );
            logger.info(`[PortalApply] ✔ Selected ${fieldName || "field"}: ${value}`);
            return true;
          }
        } catch (e) {
          logger.debug(`[PortalApply] trySelect failed ${fieldName || sel}: ${e.message}`);
        }
      }
      return false;
    };

    // ── Helper: fill date fields (yyyy-mm-dd format) ──
    const tryFillDate = async (selectors, value, fieldName = "") => {
      if (!value) return false;
      for (const sel of selectors) {
        try {
          const el = portalPage.locator(sel).first();
          if (await el.isVisible({ timeout: 800 }).catch(() => false)) {
            await el.click();
            await el.fill(value);
            logger.info(`[PortalApply] ✔ Set date ${fieldName}: ${value}`);
            return true;
          }
        } catch (e) {
          logger.debug(`[PortalApply] tryFillDate failed ${fieldName}: ${e.message}`);
        }
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
      userData.firstName || (userData.name || "").split(" ")[0],
      "First Name"
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
        (userData.name || "").split(" ").slice(1).join(" "),
      "Last Name"
    );

    // ── 3. Full Name (fallback if no first/last fields) ───────
    await tryFill(
      [
        "input[name='name' i]",
        "input[placeholder*='full name' i]",
        "input[autocomplete='name']",
      ],
      userData.name || `${userData.firstName || ""} ${userData.lastName || ""}`.trim(),
      "Full Name"
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
      userData.email || "",
      "Email"
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
      userData.phone || "",
      "Phone"
    );

    // ── 6. LinkedIn URL ───────────────────────────────────────
    await tryFill(
      [
        "input[name*='linkedin' i]",
        "input[id*='linkedin' i]",
        "input[placeholder*='linkedin' i]",
        "input[data-automation-id='linkedinUrl']",
      ],
      userData.linkedinUrl || "",
      "LinkedIn URL"
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
      userData.location || "",
      "Location"
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
      
      let resumeUploaded = false;
      for (const sel of fileInputSelectors) {
        try {
          const el = portalPage.locator(sel).first();
          // Use evaluate to check if element exists and can receive input
          if (await el.evaluate((e) => !!e).catch(() => false)) {
            logger.info(`[PortalApply] ⬆️ Uploading resume via: ${sel}`);
            await el.setInputFiles(resumePath);
            
            // Verify upload by checking if filename appears on page
            await portalPage.waitForTimeout(2500);
            const pageContent = await portalPage.content();
            const filename = path.basename(resumePath);
            if (pageContent.includes(filename) || pageContent.includes(".pdf")) {
              logger.info(`[PortalApply] ✔ Resume uploaded successfully`);
              resumeUploaded = true;
            }
            break;
          }
        } catch (e) {
          logger.debug(`[PortalApply] Resume upload failed for ${sel}: ${e.message}`);
        }
      }
      
      if (!resumeUploaded) {
        logger.warn(`[PortalApply] Resume upload may have failed - continuing anyway`);
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
          "select[name*='work' i]",
        ],
        userData.workAuth,
        "Work Auth"
      );
    }

    // ── 10. Years of Experience ──────────────────────────────
    if (userData.yearsOfExperience) {
      await trySelect(
        [
          "select[name*='experience' i]",
          "select[name*='years' i]",
          "select[id*='experience' i]",
        ],
        userData.yearsOfExperience,
        "Years of Experience"
      );
    }

    // ── 11. Scrolling to reveal additional fields ────────────
    logger.info(`[PortalApply] 📜 Scrolling to reveal hidden form fields...`);
    for (let i = 0; i < 6; i++) {
      await portalPage.evaluate(() => window.scrollBy(0, 500));
      await portalPage.waitForTimeout(600);
    }

    // ── 12. Additional Text Fields (company, skills, etc) ─────
    await tryFill(
      [
        "input[name*='company' i]",
        "input[id*='company' i]",
        "input[placeholder*='company' i]",
      ],
      userData.company || "",
      "Company"
    );

    await tryFill(
      [
        "input[name*='skills' i]",
        "input[id*='skills' i]",
        "textarea[name*='skills' i]",
      ],
      userData.skills || "",
      "Skills"
    );

    await tryFill(
      [
        "textarea[name*='cover' i]",
        "textarea[id*='cover' i]",
        "textarea[placeholder*='cover' i]",
      ],
      userData.coverLetter || "",
      "Cover Letter"
    );

    // ── 13. Text areas (summary, objective, etc) ─────────────
    await tryFill(
      [
        "textarea[name*='summary' i]",
        "textarea[id*='summary' i]",
        "textarea[placeholder*='summary' i]",
        "textarea[placeholder*='objective' i]",
      ],
      userData.summary || "",
      "Summary"
    );

    // ── 14. Scroll to top to verify form ─────────────────────
    await portalPage.evaluate(() => window.scrollTo(0, 0));
    await portalPage.waitForTimeout(500);

    logger.info("[PortalApply] ✅ Autofill complete. Tab left open for review/submit.");
    return { success: true, message: "Form filled. Please review and submit." };
  } catch (error) {
    logger.error(`[PortalApply] Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

module.exports = { autofillPortalForm };
