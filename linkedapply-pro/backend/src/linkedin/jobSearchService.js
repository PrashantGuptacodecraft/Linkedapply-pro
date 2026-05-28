const logger = require("../utils/logger");
const { getPage, getBrowser } = require("./linkedinService");
const { autofillPortalForm } = require("./portalApplyService");
const { callGemini } = require("../utils/geminiService");
const {
  waitForNetworkIdle,
  waitForDOMStable,
  waitForElementReady,
  smartWait,
  adaptivePause,
  waitForJobCards,
  waitForRightPaneUpdate,
  waitForModalReady,
} = require("../utils/humanTiming");

// ─────────────────────────────────────────────────────────────────────────────
// Hardcoded geoIds — avoids LinkedIn's location resolution race condition
// ─────────────────────────────────────────────────────────────────────────────
const JOB_CARD_SELECTORS = [
  // Primary selectors
  ".job-card-container",
  ".jobs-search-results__list-item",
  ".jobs-search-results__list-item--occluded",
  "li.scaffold-layout__list-item",
  
  // Link-based selectors (works when card is just a link wrapper)
  "li a[href*='/jobs/view/']",
  "a[href*='/jobs/view/']",
  "a[data-tracking-control-name='public_jobs_jserp-result_job-search-card']",
  
  // New LinkedIn UI variations
  "li[data-job-id]",
  ".base-card",
  ".jobs-search-results__list-item-wrapper",
  "[data-job-search-result]",
  ".jobs-search-result-card",
  
  // Fallback: any clickable job link
  "li a[href*='/jobs/']",
  ".reusable-search__result-container",
].join(", ");

const GEO_ID_MAP = {
  "usa":            "103644278",
  "united states":  "103644278",
  "us":             "103644278",
  "india":          "102713980",
  "canada":         "101174742",
  "uk":             "101165590",
  "united kingdom": "101165590",
  "australia":      "101452733",
  "germany":        "101282230",
  "singapore":      "102454443",
};

function getGeoId(location) {
  if (!location) return null;
  return GEO_ID_MAP[location.trim().toLowerCase()] || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Reliable element interaction with visibility checks
// ─────────────────────────────────────────────────────────────────────────────
async function waitForElementReady(page, selector, timeoutMs = 5000) {
  try {
    const element = page.locator(selector);
    // Wait for element to be in DOM
    await element.first().waitFor({ state: 'attached', timeout: timeoutMs });
    // Wait for element to be visible
    await element.first().waitFor({ state: 'visible', timeout: timeoutMs });
    // Wait for element to be in viewport or clickable
    return true;
  } catch (e) {
    return false;
  }
}

async function clickReliably(page, selector, timeoutMs = 3000) {
  try {
    const element = page.locator(selector).first();
    
    // Method 1: Wait for ready and use evaluate click
    const isReady = await waitForElementReady(page, selector, timeoutMs);
    if (isReady) {
      await element.evaluate((el) => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      await page.waitForTimeout(200);
      
      // Try direct click first
      try {
        await element.click({ timeout: 1000 });
        return true;
      } catch (_) {
        // Fallback: use evaluate
        await element.evaluate((el) => el.click());
        return true;
      }
    }
  } catch (e) {
    logger.debug(`[JobSearch] clickReliably failed: ${e.message}`);
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Wait for an element to appear AND be stable (not just attached to DOM)
// Returns true if found, false if not found within timeout
// ─────────────────────────────────────────────────────────────────────────────
async function waitForVisible(page, selectors, timeoutMs = 15000) {
  const combined = Array.isArray(selectors) ? selectors.join(", ") : selectors;
  try {
    await page.waitForSelector(combined, { state: "visible", timeout: timeoutMs });
    return true;
  } catch (_) {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DIAGNOSTIC HELPER — Analyze page state for debugging
// ─────────────────────────────────────────────────────────────────────────────
async function diagnosePage(page, label = "diagnostics") {
  try {
    logger.info(`\n[Diagnostics] ========== ${label} ==========`);
    
    // URL
    logger.info(`[Diagnostics] Current URL: ${page.url()}`);

    // Page content size
    const content = await page.content();
    logger.info(`[Diagnostics] Page size: ${(content.length / 1024).toFixed(1)} KB`);

    // Check for error messages
    const errorMessages = [
      { text: 'problem loading your filters', sel: 'text=problem loading your filters' },
      { text: 'Something went wrong', sel: 'text=Something went wrong' },
      { text: 'No matching jobs', sel: 'text=No matching jobs' },
    ];
    for (const err of errorMessages) {
      const visible = await page.locator(err.sel).first().isVisible({ timeout: 1000 }).catch(() => false);
      if (visible) {
        logger.warn(`[Diagnostics] ⚠️ Error detected: ${err.text}`);
      }
    }

    // Job card count
    const cardCount = await page.locator(JOB_CARD_SELECTORS).count();
    logger.info(`[Diagnostics] Job cards found: ${cardCount}`);

    // Check for empty states
    const emptyStates = [
      '.artdeco-empty-state',
      '.search-no-results__image-container',
      'text=Your search didn\'t return',
    ];
    for (const empty of emptyStates) {
      const visible = await page.locator(empty).first().isVisible({ timeout: 1000 }).catch(() => false);
      if (visible) {
        logger.info(`[Diagnostics] ✔ Empty state detected`);
      }
    }

    // Check for loading spinners
    const loadingSpinners = await page.locator('.artdeco-spinner, .artdeco-skeleton, [role="progressbar"]').count();
    if (loadingSpinners > 0) {
      logger.warn(`[Diagnostics] ⚠️ ${loadingSpinners} loading spinners still active`);
    }

    // Results count text
    try {
      const resultsText = await page.locator('.jobs-search-results__title-heading, h1').first().innerText().catch(() => "");
      if (resultsText) {
        logger.info(`[Diagnostics] Results text: ${resultsText}`);
      }
    } catch (_) {}

    logger.info(`[Diagnostics] ========== END ${label} ==========\n`);
  } catch (e) {
    logger.error(`[Diagnostics] Error during diagnostics: ${e.message}`);
  }
}
// Always uses .evaluate() click to bypass viewport restrictions
// ─────────────────────────────────────────────────────────────────────────────
async function dismissOverlays(page) {
  // Nuke chat popups and toasts via CSS so they never block clicks
  await page.evaluate(() => {
    try {
      const overlays = document.querySelectorAll('.msg-overlay-container, .msg-overlay-list-bubble, #msg-overlay, .artdeco-toast-item');
      overlays.forEach(c => {
        if (c.style.display !== 'none') c.style.display = 'none';
        if (c.style.visibility !== 'hidden') c.style.visibility = 'hidden';
      });
    } catch(e){}
  }).catch(()=>{});

  const selectors = [
    // LinkedIn "New message" / chat bubble overlays
    "button.msg-overlay-bubble-header__control",
    ".msg-overlay-list-bubble .msg-overlay-bubble-header__control",
    "button.msg-overlay-bubble-header__control[aria-label*='Close']",
    "button.msg-overlay-bubble-header__control[aria-label*='close']",
    "button[aria-label^='Close']",
    "button[aria-label^='Dismiss']",
    "[data-control-name='overlay.close_conversation_window']",
    // Generic dismiss buttons
    "[data-test-modal-close-btn]",
    "button.contextual-sign-in-modal__modal-dismiss-icon",
    "button.artdeco-toast-item__dismiss",
    "button.artdeco-modal__dismiss",
  ];
  
  // Press Escape to dismiss any open focused modals (like New message)
  await page.keyboard.press("Escape").catch(() => {});
  
  for (const sel of selectors) {
    try {
      const els = await page.locator(sel).all().catch(() => []);
      for (const el of els) {
        try {
          const isVis = await el.isVisible({ timeout: 1000 }).catch(() => false);
          if (isVis) {
            logger.info(`[JobSearch] Closing overlay: ${sel}`);
            // Use evaluate for more reliable clicks on modal elements
            await el.evaluate((button) => button.click()).catch(() => {
              // Fallback to keyboard if evaluate fails
            });
            await adaptivePause(page, 400, 0.2, "after overlay dismiss");
          }
        } catch (_) {}
      }
    } catch (_) {}
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — Navigate to LinkedIn Jobs with aggressive error recovery
//
// Strategy:
//   A) Load the raw search page first (no filters) so LinkedIn resolves geoId
//   B) Wait for network to go IDLE (LinkedIn SPA finishes booting)
//   C) Wait for DOM to stabilize (job cards stop changing)
//   D) Navigate to the filtered URL (geoId + f_TPR=r86400)
//   E) Ignore cosmetic "problem loading filters" — it's often just a UI glitch
//   F) Verify actual jobs are loading (not empty result set)
//   G) Retry with clean URL if truly no jobs found
// ─────────────────────────────────────────────────────────────────────────────
async function navigateToFilteredJobs(page, keywordsStr, location) {
  const locStr = encodeURIComponent(location);
  const geoId = getGeoId(location);
  const locParam = geoId ? `&location=${locStr}&geoId=${geoId}` : `&location=${locStr}`;
  const finalUrl = `https://www.linkedin.com/jobs/search/?keywords=${keywordsStr}${locParam}&f_TPR=r86400&sortBy=DD`;
  const cleanFinalUrl = finalUrl.replace(/[?&]currentJobId=[^&]+/g, "");

  logger.info(`[JobSearch] 🔍 Navigating to LinkedIn jobs search...`);
  logger.info(`[JobSearch] Keywords: ${keywordsStr}, Location: ${location}, GeoId: ${geoId}`);

  // Simple approach: Just navigate and ignore errors, focus on whether jobs loaded
  const urls = [
    cleanFinalUrl,  // Full URL with all filters
    cleanFinalUrl.replace(/&f_TPR=r86400/, ""),  // Without date filter
    `https://www.linkedin.com/jobs/search/?keywords=${keywordsStr}`,  // Keywords only
  ];

  for (let attemptIndex = 0; attemptIndex < urls.length; attemptIndex++) {
    try {
      const url = urls[attemptIndex];
      const urlLabel = attemptIndex === 0 ? "filtered" : attemptIndex === 1 ? "no-date-filter" : "keywords-only";
      
      logger.info(`[JobSearch] 🔄 Attempt ${attemptIndex + 1}: ${urlLabel} search...`);
      
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 180000 });
      logger.info(`[JobSearch] ✔ Page loaded. Waiting for network...`);
      
      // Wait for network to settle
      const idleWait = attemptIndex === 0 ? 8000 : 12000;
      await waitForNetworkIdle(page, { quietMs: 800, maxWaitMs: idleWait, label: `attempt ${attemptIndex + 1}` });
      
      // Small pause for rendering
      await adaptivePause(page, 1000, 0.3, `after load attempt ${attemptIndex + 1}`);

      // Dismiss overlays (modals, chat, etc)
      await dismissOverlays(page);
      
      // Final wait for UI to settle
      await adaptivePause(page, 500, 0.2, "final UI settle");

      // Check if jobs actually loaded
      const jobCount = await page.locator(JOB_CARD_SELECTORS).count().catch(() => 0);
      
      if (jobCount > 0) {
        logger.info(`[JobSearch] ✅ Success! Found ${jobCount} job cards on attempt ${attemptIndex + 1}`);
        return true;
      }

      logger.warn(`[JobSearch] ⚠️ No jobs found on attempt ${attemptIndex + 1} (0 cards). Trying next approach...`);

    } catch (err) {
      logger.error(`[JobSearch] Attempt ${attemptIndex + 1} error: ${err.message}`);
      // Continue to next attempt
    }
  }

  logger.error(`[JobSearch] ❌ All navigation attempts failed. Final URL: ${page.url()}`);
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — Slowly scroll the left jobs pane to load all cards
// Each scroll waits for DOM to stabilize before scrolling again
// IMPROVED: Better detection of scroll container, retry on scroll fail
// ─────────────────────────────────────────────────────────────────────────────
async function scrollJobsPane(page, scrollCount = 6) {
  logger.info(`[JobSearch] 📜 Scrolling left pane to load all job cards (${scrollCount} passes)...`);

  // Find the actual scrollable container (LinkedIn moves it around)
  const scrollableSelectors = [
    ".jobs-search-results-list",
    ".scaffold-layout__list",
    ".jobs-search-results__list",
    ".artdeco-list",
    ".jobs-search-results__list-container",
    "[role='main']",
    ".jobs-search",
  ];

  let scrollableContainer = null;
  for (const sel of scrollableSelectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 1500 }).catch(() => false)) {
        scrollableContainer = sel;
        logger.info(`[JobSearch] ✔ Found scrollable container: ${sel}`);
        break;
      }
    } catch (_) {}
  }

  if (!scrollableContainer) {
    logger.warn(`[JobSearch] ⚠️ Could not find scrollable container. Using window scroll fallback.`);
    scrollableContainer = null;
  }

  for (let s = 0; s < scrollCount; s++) {
    try {
      // Scroll the container
      if (scrollableContainer) {
        await page.locator(scrollableContainer).first().evaluate(el => {
          el.scrollBy(0, 800);
        });
      } else {
        // Fallback: scroll window
        await page.evaluate(() => window.scrollBy(0, 800));
      }

      // Wait for LinkedIn to lazy-load new cards
      await adaptivePause(page, 400, 0.3, `scroll ${s + 1}/${scrollCount}`);

      // Wait for new cards to stop appearing
      const cardCount = await page.locator(JOB_CARD_SELECTORS).count();
      await waitForDOMStable(page, JOB_CARD_SELECTORS, {
        pollMs: 300,
        stableChecks: 2,
        maxWaitMs: 3000,
        label: `scroll ${s + 1}/${scrollCount} (${cardCount} cards)`,
      });

      logger.info(`[JobSearch] ✔ Scroll pass ${s + 1}/${scrollCount} complete (${cardCount} cards loaded)`);
    } catch (err) {
      logger.warn(`[JobSearch] ⚠️ Scroll pass ${s + 1} failed: ${err.message}. Continuing...`);
    }
  }

  const finalCardCount = await page.locator(JOB_CARD_SELECTORS).count();
  logger.info(`[JobSearch] ✅ Scrolling complete. Total cards loaded: ${finalCardCount}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3 — Wait for the right pane to fully update after clicking a job card
// ─────────────────────────────────────────────────────────────────────────────
async function waitForRightPane(page) {
  // ✅ Uses smart pane update detection (network idle + element ready)
  // Some LinkedIn result clicks open the full job detail page instead of
  // a pure right-pane update, so we also accept a visible apply CTA.
  return await waitForRightPaneUpdate(page);
}

async function clickJobCard(page, cardLocator, cardIndex) {
  const beforeUrl = page.url();

  try {
    await cardLocator.scrollIntoViewIfNeeded().catch(() => {});
    await cardLocator.hover().catch(() => {});
    await adaptivePause(page, 700, 0.4, `before card click ${cardIndex}`);
    await cardLocator.click({ force: true, timeout: 20000 });
  } catch (err) {
    try {
      await cardLocator.evaluate((el) => {
        try {
          el.click();
        } catch (_) {
          if (el.closest('a')) el.closest('a').click();
        }
      });
    } catch (_) {}
  }

  try {
    await page.waitForLoadState("domcontentloaded", { timeout: 7000 }).catch(() => {});
    await waitForNetworkIdle(page, { quietMs: 700, maxWaitMs: 5000, label: `card ${cardIndex} settle` });
  } catch (_) {}

  return page.url() !== beforeUrl;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4 — Read job details from the right pane
// ─────────────────────────────────────────────────────────────────────────────
async function readJobDetails(page) {
  let title = "";
  let company = "";
  let location = "";
  let description = "";

  const titleSelectors = [
    ".jobs-details__main-content h1",
    ".job-details-jobs-unified-top-card__job-title h1",
    ".jobs-unified-top-card__job-title h1",
    ".t-24.t-bold.inline",
    "h1.t-24",
    ".job-details-jobs-unified-top-card__job-title",
    ".jobs-unified-top-card__job-title",
  ];
  for (const sel of titleSelectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 1000 })) {
        title = (await el.innerText()).trim();
        break;
      }
    } catch (_) {}
  }

  const companySelectors = [
    ".job-details-jobs-unified-top-card__company-name a",
    ".job-details-jobs-unified-top-card__company-name",
    ".jobs-unified-top-card__company-name",
    ".jobs-details-top-card__company-url",
  ];
  for (const sel of companySelectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 1000 })) {
        company = (await el.innerText()).trim();
        break;
      }
    } catch (_) {}
  }

  const locationSelectors = [
    ".job-details-jobs-unified-top-card__primary-description span:first-child",
    ".job-details-jobs-unified-top-card__bullet",
    ".jobs-unified-top-card__bullet",
    ".jobs-details-top-card__exact-location",
  ];
  for (const sel of locationSelectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 1000 })) {
        location = (await el.innerText()).trim();
        break;
      }
    } catch (_) {}
  }

  const descriptionSelectors = [
    "#job-details",
    ".jobs-description__content",
    ".jobs-description",
    ".job-details-module",
  ];
  for (const sel of descriptionSelectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 1000 })) {
        description = (await el.innerText()).trim();
        break;
      }
    } catch (_) {}
  }

  return { title, company, location, description };
}


// ─────────────────────────────────────────────────────────────────────────────
// STEP 5 — Find the Apply button and determine type
// ─────────────────────────────────────────────────────────────────────────────
async function findApplyButton(page) {
  // Wait for apply section to fully render after right pane loaded
  await waitForElementReady(page, [
    ".jobs-apply-button",
    ".jobs-s-apply",
    ".jobs-details__main-content .artdeco-button",
  ], { label: "apply button section", timeoutMs: 5000, stabilizeMs: 200 });

  const portalSelectors = [
    "a[href^='http']:not([href*='linkedin.com'])",
    "button[aria-label*='company website']",
    "button:has-text('Apply')",
    "a:has-text('Apply')",
    "[role='button']:has-text('Apply')",
    "a[aria-label*='company website']",
    "button[aria-label*='apply on company website']",
    "a[aria-label*='apply on company website']",
    "button:has-text('Apply on company website')",
    "a:has-text('Apply on company website')",
    "button:has-text('Continue')",
    "a:has-text('Continue')",
    "button[aria-label*='apply']",
    "a[aria-label*='apply']",
    ".jobs-s-apply button",
    ".jobs-s-apply a",
    ".jobs-apply-button",
    ".jobs-details__main-content .artdeco-button--primary",
  ];

  let applyBtn = null;

  for (const sel of portalSelectors) {
    try {
      const els = await page.$$(sel);
      for (const el of els) {
        if (!(await el.isVisible().catch(() => false))) continue;
        const txt = ((await el.innerText().catch(() => "")) || "").toLowerCase();
        const aria = ((await el.getAttribute("aria-label").catch(() => "")) || "").toLowerCase();
        const href = ((await el.getAttribute("href").catch(() => "")) || "").trim();

        const combinedText = `${txt} ${aria}`;
        const isEasyApply = /easy apply/.test(combinedText);
        const isExternalLink = /^https?:\/\//.test(href) && !href.includes("linkedin.com");
        const isPortalText = /(company website|apply on company website|visit company website|external application|continue)/.test(combinedText);
        const isApplyText = /\bapply\b/.test(combinedText);

        if (isEasyApply) continue;

        if (isExternalLink || isPortalText || (isApplyText && !isEasyApply)) {
          applyBtn = el;
          break;
        }
      }
    } catch (_) {}
    if (applyBtn) break;
  }

  // --- GEMINI FALLBACK (AGENTIC SELECTION) ---
  if (!applyBtn) {
    logger.info(`[JobSearch] Standard selectors failed. Invoking Gemini AI to find Apply button...`);
    try {
      // Extract visible buttons and links from the right pane
      const elements = await page.$$eval(".job-view-layout button, .job-view-layout a, .jobs-search__job-details--container button, .jobs-search__job-details--container a, .jobs-details__main-content button, .jobs-details__main-content a", els => {
        return els.filter(el => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetWidth > 0;
        }).map((el, index) => {
          return {
            id: index,
            tag: el.tagName,
            text: (el.innerText || "").trim(),
            ariaLabel: (el.getAttribute('aria-label') || "").trim(),
            href: (el.getAttribute('href') || "").trim()
          };
        }).filter(e => (e.text.length > 0 || e.ariaLabel.length > 0) && (e.text.length < 100 && e.ariaLabel.length < 100));
      });

      if (elements.length > 0) {
        const prompt = `You are an expert at analyzing web page elements. Below is a JSON list of visible buttons and links from a job posting page.
Which one represents the button to apply externally on the company website (usually just "Apply" or "Apply on company website")?
STRICT RULE: DO NOT select any button that says "Easy Apply". The user ONLY wants to apply on the original company portal page.

Respond ONLY with the exact JSON object of the matched element from the list. If none match or if only "Easy Apply" is available, respond with {}.

Elements:
${JSON.stringify(elements, null, 2)}`;
        
        const responseText = await callGemini([{role: 'user', content: prompt}], 150);
        const match = responseText.match(/\{[\s\S]*\}/);
        
        if (match) {
          const selected = JSON.parse(match[0]);
          if (selected.id !== undefined) {
            logger.info(`[JobSearch] Gemini identified button: "${selected.text || selected.ariaLabel}" (Tag: ${selected.tag})`);
            
            // Re-find the element in Playwright
            const matchedEls = await page.$$(`.job-view-layout ${selected.tag.toLowerCase()}, .jobs-search__job-details--container ${selected.tag.toLowerCase()}, .jobs-details__main-content ${selected.tag.toLowerCase()}`);
            for (let el of matchedEls) {
              const text = (await el.innerText().catch(() => "")).trim();
              const aria = (await el.getAttribute('aria-label').catch(() => "")).trim();
              
              if ((text && text === selected.text) || (aria && aria === selected.ariaLabel)) {
                applyBtn = el;
                break;
              }
            }
          }
        }
      }
    } catch (e) {
      logger.warn(`[JobSearch] Gemini fallback failed: ${e.message}`);
    }
  }

  return { applyBtn, isEasyApply: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 6A — Handle Easy Apply (LinkedIn built-in modal)
// ─────────────────────────────────────────────────────────────────────────────
async function handleEasyApply(page, jobTitle, userData) {
  logger.info(`[JobSearch] 🟡 Easy Apply detected for '${jobTitle}'. Opening modal...`);

  const { applyBtn } = await findApplyButton(page);
  if (!applyBtn) {
    logger.warn(`[JobSearch] Easy Apply button disappeared for '${jobTitle}'.`);
    return false;
  }

  // Click the Easy Apply button
  try {
    await applyBtn.click({ force: true, timeout: 10000 });
  } catch (_) {
    await applyBtn.evaluate((el) => el.click());
  }

  // ✅ Smart: wait for modal to fully open + network idle + all form fields rendered
  const modalReady = await waitForModalReady(page);

  if (!modalReady) {
    logger.warn(`[JobSearch] Easy Apply modal did not fully open for '${jobTitle}'.`);
    return false;
  }

  logger.info(`[JobSearch] ✅ Easy Apply modal open. Filling fields...`);

  const modal = page.locator(".jobs-easy-apply-modal, [data-test-modal], .artdeco-modal--layer-default").first();

  // Fill phone
  if (userData.phone) {
    try {
      const phoneInput = modal.locator(
        "input[id*='phoneNumber'], input[name*='phone'], input[autocomplete*='tel']"
      ).first();
      if (await phoneInput.isVisible({ timeout: 2000 })) {
        await phoneInput.triple_click().catch(() => {});
        await phoneInput.fill(userData.phone);
        logger.info(`[JobSearch]   ✔ Filled phone: ${userData.phone}`);
        await adaptivePause(page, 400, 0.3, "after phone fill");
      }
    } catch (_) {}
  }

  // Fill city / location
  if (userData.location) {
    try {
      const cityInput = modal.locator(
        "input[id*='city'], input[id*='location'], input[placeholder*='City']"
      ).first();
      if (await cityInput.isVisible({ timeout: 2000 })) {
        await cityInput.fill(userData.location);
        logger.info(`[JobSearch]   ✔ Filled location: ${userData.location}`);
        await adaptivePause(page, 400, 0.3, "after location fill");
      }
    } catch (_) {}
  }

  // Fill email if shown
  if (userData.email) {
    try {
      const emailInput = modal.locator("input[type='email'], input[id*='email']").first();
      if (await emailInput.isVisible({ timeout: 2000 })) {
        await emailInput.fill(userData.email);
        logger.info(`[JobSearch]   ✔ Filled email: ${userData.email}`);
        await adaptivePause(page, 400, 0.3, "after email fill");
      }
    } catch (_) {}
  }

  logger.info(`[JobSearch] ✅ Easy Apply modal filled for '${jobTitle}'. Left open for your review before submitting.`);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 6B — Handle External Portal Apply (opens new tab)
// ─────────────────────────────────────────────────────────────────────────────
async function handlePortalApply(page, jobTitle, applyBtn, userData) {
  logger.info(`[JobSearch] 🔵 External Portal Apply for '${jobTitle}'. Clicking...`);
  const context = page.context();
  let newPage = null;

  try {
    await applyBtn.scrollIntoViewIfNeeded().catch(() => {});
    await applyBtn.hover().catch(() => {});
    await adaptivePause(page, 700, 0.3, "before portal click");

    const currentUrl = page.url();

    const clickTask = (async () => {
      try {
        await applyBtn.click({ force: true, timeout: 15000 });
      } catch (_) {
        try {
          await applyBtn.evaluate((el) => {
            try { el.click(); } catch (e) { window.open(el.href || '', '_blank', 'noopener'); }
          });
        } catch (_) {}
      }
    })();

    const newPagePromise = context.waitForEvent("page", { timeout: 12000 }).catch(() => null);
    const navigationPromise = page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 12000 }).catch(() => null);

    await clickTask;
    const [tab, navResult] = await Promise.all([newPagePromise, navigationPromise]);

    if (tab) {
      newPage = tab;
    } else if (navResult && page.url() !== currentUrl) {
      logger.info(`[JobSearch] Company portal opened in the same tab.`);
      newPage = page;
    }

    if (!newPage) {
      logger.info(`[JobSearch] No immediate page open — checking for Continue modal or href fallback...`);
      await waitForNetworkIdle(page, { quietMs: 1200, maxWaitMs: 5000, label: "portal modal" });

      const modalBtns = [
        "button:has-text('Continue')",
        "button:has-text('Apply on company website')",
        "a:has-text('Apply on company website')",
        ".artdeco-modal button.artdeco-button--primary",
        "[role='button']:has-text('Apply')",
      ];
      for (const sel of modalBtns) {
        try {
          const btn = page.locator(sel).first();
          if (await btn.isVisible({ timeout: 2000 })) {
            logger.info(`[JobSearch] Clicking modal fallback button: ${sel}`);
            await btn.click({ force: true, timeout: 10000 });
            const [tab2, nav2] = await Promise.all([
              context.waitForEvent("page", { timeout: 15000 }).catch(() => null),
              page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => null),
            ]);
            if (tab2) {
              newPage = tab2;
            } else if (nav2 && page.url() !== currentUrl) {
              newPage = page;
            }
            break;
          }
        } catch (_) {}
      }
    }

    if (!newPage) {
      const href = ((await applyBtn.getAttribute("href").catch(() => "")) || "").trim();
      if (href && href.startsWith("http") && !href.includes("linkedin.com")) {
        logger.info(`[JobSearch] Using href fallback to open portal: ${href}`);
        newPage = await context.newPage();
        await newPage.goto(href, { waitUntil: "domcontentloaded", timeout: 30000 });
      } else if (href && href.startsWith("/")) {
        const absoluteHref = new URL(href, page.url()).toString();
        if (!absoluteHref.includes("linkedin.com")) {
          logger.info(`[JobSearch] Using relative href fallback: ${absoluteHref}`);
          newPage = await context.newPage();
          await newPage.goto(absoluteHref, { waitUntil: "domcontentloaded", timeout: 30000 });
        }
      }
    }
  } catch (err) {
    logger.warn(`[JobSearch] Portal apply click error: ${err.message}`);
  }

  if (!newPage) {
    logger.warn(`[JobSearch] No new tab captured for '${jobTitle}'.`);
    return { success: false, url: "" };
  }

  logger.info(`[JobSearch] ✅ Company portal opened: ${newPage.url()}`);

  // ✅ Smart: wait for portal page to fully load (network idle + form elements stable)
  logger.info(`[JobSearch] ⏳ Waiting for portal page to fully load...`);
  await newPage.waitForLoadState("domcontentloaded").catch(() => {});

  // Network idle on the new portal page
  await waitForNetworkIdle(newPage, {
    quietMs: 2000,
    maxWaitMs: 15000,
    label: "company portal page",
  });

  // Wait for form inputs to appear and stabilize
  await waitForDOMStable(newPage, [
    "input[type='text']",
    "input[type='email']",
    "input[name]",
    "form",
    "textarea",
  ], {
    pollMs: 400,
    stableChecks: 2,
    maxWaitMs: 8000,
    label: "portal form fields",
  });

  // Small human read-pause before filling
  await adaptivePause(newPage, 1200, 0.3, "human reading portal page");

  const portalUrl = newPage.url();
  try {
    const result = await autofillPortalForm(newPage, userData);
    if (result.success) {
      logger.info(`[JobSearch] ✅ Portal form filled for '${jobTitle}'. Tab left open for review.`);
      return { success: true, url: portalUrl };
    } else {
      logger.warn(`[JobSearch] Portal form fill failed: ${result.error}`);
      return { success: false, url: portalUrl };
    }
  } catch (e) {
    logger.warn(`[JobSearch] autofillPortalForm error: ${e.message}`);
    return { success: false, url: portalUrl };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────
async function autoApplyJobs(userData, jobKeywords, location, allowedTitles) {
  const page = getPage();
  const browser = getBrowser();

  if (!page || !browser) {
    throw new Error("Browser is not initialized. Please login first.");
  }

  const keywordsStr = encodeURIComponent(jobKeywords.join(" "));

  // ── Navigate to filtered jobs with full smart pauses ──────────────────
  const navSuccess = await navigateToFilteredJobs(page, keywordsStr, location);
  
  if (!navSuccess) {
    logger.error(`[JobSearch] ❌ Failed to navigate to job search. Aborting.`);
    return { success: false, message: "Failed to navigate to job search. LinkedIn may be blocking or region unavailable." };
  }

  // ── Wait for job cards (smart — not a fixed timeout) ──────────────────
  logger.info(`[JobSearch] ── Final check: job cards on screen...`);
  const cardsVisible = await waitForJobCards(page, 1);

  if (cardsVisible === 0) {
    logger.warn(`[JobSearch] ⚠️ No job cards on first check. Running full diagnostics...`);
    await diagnosePage(page, "after failed waitForJobCards");
    return { success: false, message: "No jobs found. LinkedIn may have no matching results or region restrictions apply." };
  }

  // ── Slowly scroll to load all cards ────────────────────────────────────
  await scrollJobsPane(page, 6);

  // Collect all visible job cards as locators (avoids stale element handles
  // when LinkedIn navigates during a click)
  const jobCards = page.locator(JOB_CARD_SELECTORS);
  const jobCardCount = await jobCards.count();
  logger.info(`[JobSearch] 📋 Total job cards loaded: ${jobCardCount}`);

  let fallbackMode = false;
  if (jobCardCount === 0) {
    const { applyBtn } = await findApplyButton(page);
    if (applyBtn) {
      logger.info(`[JobSearch] ⚠️ Job list empty, but Apply button visible in right pane. Using fallback mode.`);
      fallbackMode = true;
    } else {
      return { success: false, message: "No job cards found." };
    }
  }

  let appliedCount = 0;
  let skippedCount = 0;
  let easyApplyCount = 0;
  let portalCount = 0;
  let processedJobs = [];

  // ── Process each job card ──────────────────────────────────────────────
  const totalIterations = fallbackMode ? 1 : jobCardCount;
  for (let i = 0; i < totalIterations; i++) {
    logger.info(`\n[JobSearch] ════ Job ${i + 1} / ${totalIterations} ════`);

    // ── Dismiss overlays BEFORE clicking (prevents clicking the chat by mistake) ──
    await dismissOverlays(page);

    let jobHref = "";
    // ── Click the card (skip in fallback mode) ─────────────────────────
    if (!fallbackMode) {
      try {
        const card = jobCards.nth(i);
        // Extract href for deep-fix fallback
        jobHref = await card.getAttribute('href').catch(() => "");
        if (!jobHref) {
           jobHref = await card.locator('a').first().getAttribute('href').catch(() => "");
        }

        const navigated = await clickJobCard(page, card, i + 1);
        if (!navigated) {
          logger.info(`[JobSearch] Card ${i + 1} clicked without leaving the results page.`);
        }
      } catch (err) {
        logger.warn(`[JobSearch] Card ${i + 1} click failed: ${err.message}`);
        skippedCount++;
        continue;
      }
    }

    // ── Dismiss overlays again just in case new ones appeared ─────────
    await dismissOverlays(page);

    // ── Wait for right pane to fully load (SMART — not a fixed sleep) ─
    let rightPaneReady = await waitForRightPane(page);
    
    // IN-DEPTH FIX: If the SPA hangs on the skeleton loader, force navigate to the job URL
    if (!rightPaneReady && jobHref && !fallbackMode) {
      logger.warn(`[JobSearch] Right pane hung. IN-DEPTH FIX: Force-navigating to job URL...`);
      const fullUrl = jobHref.startsWith('http') ? jobHref : `https://www.linkedin.com${jobHref}`;
      
      try {
        await page.goto(fullUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
        await waitForNetworkIdle(page, { quietMs: 1500, maxWaitMs: 12000, label: "force-loaded job page" });
        await dismissOverlays(page);
        rightPaneReady = await waitForRightPane(page);
      } catch (navErr) {
        logger.warn(`[JobSearch] Force navigation failed: ${navErr.message}`);
      }
    }

    if (!rightPaneReady) {
      logger.warn(`[JobSearch] Right pane did not load for card ${i + 1}. Skipping.`);
      skippedCount++;
      continue;
    }

    // ── Read job details ───────────────────────────────────────────────
    const jobDetails = await readJobDetails(page);
    const jobTitle = jobDetails.title;
    if (!jobTitle) {
      logger.warn(`[JobSearch] Could not read title for card ${i + 1}. Skipping.`);
      skippedCount++;
      processedJobs.push({ title: "Unknown", company: "", location: "", applyLink: "", description: "", status: "Skipped - Missing title" });
      continue;
    }
    logger.info(`[JobSearch] 📌 Job: "${jobTitle}" at "${jobDetails.company}"`);

    // ── Check allowed titles ───────────────────────────────────────────
    const isAllowed = allowedTitles.some((t) =>
      jobTitle.toLowerCase().includes(t.toLowerCase())
    );
    if (!isAllowed) {
      logger.info(`[JobSearch] ⏭  Skipping — title not in allowed list`);
      skippedCount++;
      processedJobs.push({ ...jobDetails, applyLink: "", status: "Skipped - Title not allowed" });
      // Short pause before next card (human-like browsing rhythm)
      await adaptivePause(page, 600, 0.3, "skip pause");
      continue;
    }

    // ── Find Apply button ──────────────────────────────────────────────
    const { applyBtn } = await findApplyButton(page);

    if (!applyBtn) {
      logger.info(`[JobSearch] ⏭  Skipping '${jobTitle}' — no external portal Apply button found (Easy Apply only or premium).`);
      skippedCount++;
      processedJobs.push({ ...jobDetails, applyLink: "", status: "Skipped - Portal apply only" });
      continue;
    }

    // ── Apply via external portal only ───────────────────────────────────
    const portalRes = await handlePortalApply(page, jobTitle, applyBtn, userData);
    if (portalRes.success) {
      appliedCount++;
      portalCount++;
      logger.info(`[JobSearch] ✅ Portal applied: ${portalCount} so far`);
      processedJobs.push({ ...jobDetails, applyLink: portalRes.url, status: "External Portal Opened" });
    } else {
      skippedCount++;
      processedJobs.push({ ...jobDetails, applyLink: portalRes.url, status: "Skipped - Portal Apply Failed" });
    }

    // ── Smart pause between jobs ────────────────────────────────────────
    // Wait for any background LinkedIn XHR triggered by the apply action to settle,
    // then add a human-like reading/thinking pause before the next card.
    logger.info(`[JobSearch] ⏳ Settling before next job...`);
    await smartWait(page, "between jobs", 500, 1500);
  }

  const summary = `Applied: ${appliedCount} (EasyApply: ${easyApplyCount}, Portal: ${portalCount}), Skipped: ${skippedCount} out of ${jobCardCount} jobs`;
  logger.info(`[JobSearch] ════ DONE ════ ${summary}`);

  return { success: true, message: summary, processedJobs };
}

module.exports = { autoApplyJobs };
