/**
 * jobSearchService.js — LinkedApply Pro
 *
 * CLEAN REWRITE — v4 (2026-05-28)
 *
 * What this does (mirrors manual flow exactly):
 *  1. Go to LinkedIn Jobs search URL directly (no warmup that caused redirect loops)
 *  2. Wait for job cards to appear
 *  3. Click each card, wait for right pane to show content
 *  4. Look for the "Apply" button that opens company portal (NOT "Easy Apply")
 *  5. Click it → capture new tab → open company portal
 *
 * Key fixes vs previous versions:
 *  - Removed duplicate `waitForRightPane` wrapper (was calling waitForRightPaneUpdate twice)
 *  - Removed unused `clickReliably` and `waitForVisible` helpers
 *  - Removed conflicting skeleton wait strategies (was waiting in 3 places)
 *  - Removed the SPA warmup that caused LinkedIn to reset to Jobs home
 *  - Removed f_TPR date filter (was causing "problem loading your filters")
 *  - Apply button detection: simple, direct, robust — checks button text only
 *  - Overlay dismiss: single clean function, no duplicated close logic
 */

"use strict";

const logger = require("../utils/logger");
const { getPage, getBrowser } = require("./linkedinService");
const { autofillPortalForm } = require("./portalApplyService");
const { callGemini } = require("../utils/geminiService");
const {
  waitForNetworkIdle,
  waitForDOMStable,
  waitForElementReady,
  adaptivePause,
  waitForJobCards,
} = require("../utils/humanTiming");

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * BUG FIX: DO NOT use a combined OR selector for job cards.
 * A combined selector like ".job-card-container, li a[href*='/jobs/view/']" matches
 * MULTIPLE elements per job (the container AND the link inside it), causing
 * double/triple counting. cards.nth(5) would then point to wrong elements.
 *
 * Instead: try selectors ONE AT A TIME in priority order, use the first that works.
 * Each selector in this list matches EXACTLY ONE element per job card.
 */
const JOB_CARD_SELECTORS_PRIORITY = [
  ".job-card-container",                    // Most reliable — one div per job
  ".jobs-search-results__list-item",        // List item — one li per job
  "li.scaffold-layout__list-item",          // Scaffold list item
  "li[data-job-id]",                        // Has job ID attribute
  ".base-card",                             // Base card component
  "a[href*='/jobs/view/']",                 // Direct job link (last resort)
];

/**
 * Picks the SINGLE best selector that finds job cards without duplication.
 * Returns { selector, count } where count is the number of unique job cards.
 */
async function resolveJobCardSelector(page) {
  for (const sel of JOB_CARD_SELECTORS_PRIORITY) {
    try {
      const count = await page.locator(sel).count();
      if (count > 0) {
        logger.info(`[JobSearch] ✔ Using job card selector: "${sel}" (${count} cards)`);
        return { selector: sel, count };
      }
    } catch (_) {}
  }
  return { selector: JOB_CARD_SELECTORS_PRIORITY[0], count: 0 };
}

/** GeoId map for major countries */
const GEO_IDS = {
  "united states": "103644278",
  "usa":           "103644278",
  "us":            "103644278",
  "india":         "102713980",
  "canada":        "101174742",
  "uk":            "101165590",
  "united kingdom":"101165590",
  "australia":     "101452733",
  "germany":       "101282230",
  "singapore":     "102454443",
};

function getGeoId(location) {
  if (!location) return null;
  return GEO_IDS[location.trim().toLowerCase()] || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// OVERLAY DISMISS — single, clean function
// Kills LinkedIn chat bubbles, message compose window, toast notifications
// ─────────────────────────────────────────────────────────────────────────────
async function dismissOverlays(page) {
  // 1. CSS injection — instantly hide all chat/notification overlays
  await page.addStyleTag({
    content: `
      .msg-overlay-container, .msg-overlay-list-bubble,
      .msg-overlay-bubble-header, #msg-overlay,
      .artdeco-toast-item, .msg-convo-wrapper,
      .msg-overlay-conversation-bubble { 
        display: none !important; 
      }
    `,
  }).catch(() => {});

  // 2. Escape key closes focused dialogs (compose, preferences, etc.)
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(400);

  // 3. Click X buttons on any visible modal/overlay
  const xButtons = [
    "button[aria-label='Dismiss']",
    "button.artdeco-modal__dismiss",
    "button[aria-label='Close your compose window']",
    "button[aria-label='Close compose']",
    "button[aria-label='Close']",
    "button.msg-overlay-bubble-header__control",
    ".artdeco-modal--layer-default button.artdeco-modal__dismiss",
  ];
  for (const sel of xButtons) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 400 }).catch(() => false)) {
        await el.evaluate((b) => b.click()).catch(() => {});
        await page.waitForTimeout(250);
      }
    } catch (_) {}
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — Navigate to LinkedIn Jobs search
//
// Root cause of "filter not working":
//   The f_TPR=r86400 date filter causes "problem loading your filters" for
//   most accounts. We don't use it. We navigate DIRECTLY to the search URL.
//   No warmup navigation — that caused the SPA to land on Jobs home instead.
// ─────────────────────────────────────────────────────────────────────────────
async function navigateToLinkedInSearch(page, keywordsStr, location) {
  const geoId  = getGeoId(location);
  const locStr = encodeURIComponent(location || "");

  // Build search URLs — no date filter (f_TPR), that breaks filters
  const withLocationUrl = geoId
    ? `https://www.linkedin.com/jobs/search/?keywords=${keywordsStr}&location=${locStr}&geoId=${geoId}&sortBy=DD`
    : location
    ? `https://www.linkedin.com/jobs/search/?keywords=${keywordsStr}&location=${locStr}&sortBy=DD`
    : `https://www.linkedin.com/jobs/search/?keywords=${keywordsStr}&sortBy=DD`;

  const keywordsOnlyUrl = `https://www.linkedin.com/jobs/search/?keywords=${keywordsStr}`;

  const attempts = [
    { url: withLocationUrl, label: "location search" },
    { url: keywordsOnlyUrl, label: "keywords-only fallback" },
  ];

  for (let i = 0; i < attempts.length; i++) {
    const { url, label } = attempts[i];
    logger.info(`[JobSearch] 🔍 Attempt ${i + 1}/2 [${label}]: ${url}`);

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

      // Wait for LinkedIn SPA to finish loading job data via XHR
      await waitForNetworkIdle(page, { quietMs: 2000, maxWaitMs: 15000, label: `nav attempt ${i + 1}` });

      // Dismiss overlays that appear right after navigation
      await dismissOverlays(page);

      // Short settle for SPA rendering
      await page.waitForTimeout(1000);

      // Verify we're on the search results page, not the Jobs home
      const currentUrl = page.url();
      logger.info(`[JobSearch] ✔ Final URL: ${currentUrl}`);

      if (!currentUrl.includes("/jobs/search")) {
        logger.warn(`[JobSearch] ⚠️ Not on search page (on: ${currentUrl}). Navigating directly...`);
        // Direct force-navigate to the correct URL
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
        await waitForNetworkIdle(page, { quietMs: 2000, maxWaitMs: 10000, label: "direct retry" });
        await dismissOverlays(page);
        await page.waitForTimeout(500);
      }

      // Count job cards
      const cardCount = await page.locator(JOB_CARD_SELECTOR).count().catch(() => 0);
      logger.info(`[JobSearch] Job cards visible: ${cardCount}`);

      if (cardCount > 0) {
        logger.info(`[JobSearch] ✅ Search loaded with ${cardCount} cards`);
        return true;
      }

      // Check for filter-problem banner — if it appeared but cards loaded anyway, ignore it
      const filterError = await page.locator("text=problem loading your filters").isVisible({ timeout: 1000 }).catch(() => false);
      if (filterError) {
        logger.warn(`[JobSearch] ⚠️ LinkedIn filter error banner appeared (cosmetic — ignoring)`);
        // Wait a bit more for cards after the filter error
        await page.waitForTimeout(2000);
        const cardCount2 = await page.locator(JOB_CARD_SELECTOR).count().catch(() => 0);
        if (cardCount2 > 0) {
          logger.info(`[JobSearch] ✅ Cards loaded despite filter error: ${cardCount2}`);
          return true;
        }
      }

      logger.warn(`[JobSearch] ⚠️ No job cards on attempt ${i + 1}`);

    } catch (err) {
      logger.error(`[JobSearch] Navigation attempt ${i + 1} error: ${err.message}`);
    }
  }

  logger.error(`[JobSearch] ❌ All navigation attempts failed`);
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — Scroll left pane to load all job cards
// ─────────────────────────────────────────────────────────────────────────────
async function scrollJobsPane(page, passes = 5) {
  const containerSelectors = [
    ".jobs-search-results-list",
    ".scaffold-layout__list",
    ".jobs-search-results__list",
    ".artdeco-list",
    "[role='main']",
  ];

  let container = null;
  for (const sel of containerSelectors) {
    if (await page.locator(sel).first().isVisible({ timeout: 1000 }).catch(() => false)) {
      container = sel;
      break;
    }
  }

  logger.info(`[JobSearch] 📜 Scrolling (${passes} passes, container: ${container || "window"})...`);

  for (let i = 0; i < passes; i++) {
    try {
      if (container) {
        await page.locator(container).first().evaluate((el) => el.scrollBy(0, 700));
      } else {
        await page.evaluate(() => window.scrollBy(0, 700));
      }
      await page.waitForTimeout(600);
    } catch (_) {}
  }

  const total = await page.locator(JOB_CARD_SELECTOR).count();
  logger.info(`[JobSearch] ✅ Scroll done — ${total} cards total`);
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3 — Click a job card and wait for right pane to load
// ─────────────────────────────────────────────────────────────────────────────
async function clickJobCard(page, cardLocator, index) {
  try {
    await cardLocator.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(300);
    await cardLocator.click({ force: true, timeout: 15000 });
  } catch (_) {
    // JS click fallback
    await cardLocator.evaluate((el) => {
      try { el.click(); } catch (e) {
        const link = el.closest("a") || el.querySelector("a");
        if (link) link.click();
      }
    }).catch(() => {});
  }

  // Wait for XHR to fetch job details
  await waitForNetworkIdle(page, { quietMs: 800, maxWaitMs: 6000, label: `card ${index}` });
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4 — Wait for right pane job content to fully render
//
// KEY INSIGHT (from screenshots): The title appears first, THEN the skeleton
// loaders clear and the Apply button becomes visible. We wait for BOTH.
// ─────────────────────────────────────────────────────────────────────────────
async function waitForRightPane(page) {
  // Wait for job title to appear (fast — renders first)
  const titleSelectors = [
    ".jobs-details__main-content h1",
    ".job-details-jobs-unified-top-card__job-title h1",
    ".jobs-unified-top-card__job-title h1",
    ".job-details-jobs-unified-top-card__job-title",
    ".jobs-unified-top-card__job-title",
    ".job-view-layout h1",
    "h1.t-24",
    ".t-24.t-bold",
  ];

  const titleAppeared = await waitForElementReady(page, titleSelectors, {
    label: "job title",
    timeoutMs: 8000,
    stabilizeMs: 200,
  });

  if (!titleAppeared) {
    // Fallback: maybe the page navigated fully (not a SPA update) — check for apply CTA
    const ctaVisible = await waitForElementReady(page, [
      ".jobs-s-apply button",
      ".jobs-apply-button",
      ".artdeco-button--primary",
    ], { label: "apply CTA fallback", timeoutMs: 4000, stabilizeMs: 0 });
    return ctaVisible;
  }

  // Now wait for the skeleton loaders to clear
  // These classes are what LinkedIn uses for skeleton loading states
  const skeletonSelectors = [
    ".ghost-animate",
    ".jobs-ghost-fadein",
    ".artdeco-skeleton",
    "[data-placeholder-type]",
    ".scaffold-finite-scroll__placeholder",
  ];

  // Give skeleton up to 15 seconds to clear (this is why manual works — you wait)
  for (const sel of skeletonSelectors) {
    try {
      const hasSkeletons = await page.locator(sel).count().catch(() => 0) > 0;
      if (hasSkeletons) {
        logger.info(`[JobSearch] ⏳ Waiting for skeleton (${sel}) to clear...`);
        await page.waitForSelector(sel, { state: "hidden", timeout: 15000 }).catch(() => {
          logger.warn(`[JobSearch] ⚠️ Skeleton ${sel} didn't clear after 15s — continuing`);
        });
        break; // Only need to wait for one class — they all clear together
      }
    } catch (_) {}
  }

  // Also wait for the apply button area to appear (ensures it's rendered, not skeleton)
  await waitForElementReady(page, [
    ".jobs-s-apply",
    ".jobs-apply-button",
    ".jobs-unified-top-card__content--two-pane .artdeco-button",
  ], { label: "apply area", timeoutMs: 8000, stabilizeMs: 0 });

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 5 — Read job title from the right pane
// ─────────────────────────────────────────────────────────────────────────────
async function readJobTitle(page) {
  const selectors = [
    ".jobs-details__main-content h1",
    ".job-details-jobs-unified-top-card__job-title h1",
    ".jobs-unified-top-card__job-title h1",
    ".job-details-jobs-unified-top-card__job-title",
    ".jobs-unified-top-card__job-title",
    "h1.t-24",
    ".t-24.t-bold",
    "h1",
  ];
  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 1000 })) {
        const text = (await el.innerText()).trim();
        if (text) return text;
      }
    } catch (_) {}
  }
  return "";
}

async function readJobDetails(page) {
  const title = await readJobTitle(page);
  let company = "";
  let location = "";

  const companySelectors = [
    ".job-details-jobs-unified-top-card__company-name a",
    ".job-details-jobs-unified-top-card__company-name",
    ".jobs-unified-top-card__company-name",
  ];
  for (const sel of companySelectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 800 })) {
        company = (await el.innerText()).trim();
        if (company) break;
      }
    } catch (_) {}
  }

  const locationSelectors = [
    ".job-details-jobs-unified-top-card__bullet",
    ".jobs-unified-top-card__bullet",
    ".job-details-jobs-unified-top-card__primary-description span",
  ];
  for (const sel of locationSelectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 800 })) {
        location = (await el.innerText()).trim();
        if (location) break;
      }
    } catch (_) {}
  }

  return { title, company, location, description: "" };
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 6 — Find the EXTERNAL "Apply" button (NOT Easy Apply)
//
// LinkedIn shows:
//   "Easy Apply" → stays on LinkedIn (blue button, modal) — SKIP
//   "Apply"      → opens company website in new tab — THIS IS WHAT WE WANT
//
// How to tell them apart:
//   Easy Apply: button text = "Easy Apply" OR aria-label contains "Easy Apply"
//   External:   button text = "Apply" only, OR opens external URL
// ─────────────────────────────────────────────────────────────────────────────
async function findExternalApplyButton(page) {
  // Quick check — scan all buttons in the job detail area
  const containers = [
    ".jobs-s-apply",
    ".jobs-apply-button--top-card",
    ".jobs-unified-top-card__content--two-pane",
    ".jobs-details__main-content",
    ".job-view-layout",
  ];

  for (const containerSel of containers) {
    try {
      const containerEl = page.locator(containerSel).first();
      if (!(await containerEl.isVisible({ timeout: 500 }).catch(() => false))) continue;

      const buttons = await containerEl.locator("button, a[href]").all().catch(() => []);
      for (const btn of buttons) {
        try {
          if (!(await btn.isVisible({ timeout: 300 }).catch(() => false))) continue;

          const text = ((await btn.innerText().catch(() => "")) || "").trim().toLowerCase();
          const aria = ((await btn.getAttribute("aria-label").catch(() => "")) || "").trim().toLowerCase();
          const href = ((await btn.getAttribute("href").catch(() => "")) || "").trim();

          // SKIP Easy Apply (both text-based and aria-based checks)
          const isEasyApply =
            text === "easy apply" ||
            aria.includes("easy apply") ||
            /easy\s+apply/i.test(text) ||
            /easy\s+apply/i.test(aria);

          if (isEasyApply) {
            logger.info(`[JobSearch] ⏭  Easy Apply found — skipping: "${text || aria}"`);
            continue;
          }

          // ACCEPT if button says "Apply" (not easy apply)
          const isApplyBtn = text === "apply" || text.startsWith("apply") || aria === "apply" || /\bapply\b/.test(aria);
          // OR if it's an external link
          const isExternalLink = href.startsWith("http") && !href.includes("linkedin.com");

          if (isApplyBtn || isExternalLink) {
            logger.info(`[JobSearch] ✅ External Apply button: "${text || aria}" href="${href}" in ${containerSel}`);
            return await btn.elementHandle();
          }
        } catch (_) {}
      }
    } catch (_) {}
  }

  // Fallback: try direct CSS selectors for common LinkedIn external apply patterns
  const fallbackSelectors = [
    "button:has-text('Apply on company website')",
    "a:has-text('Apply on company website')",
    "button[aria-label*='company website']",
    "a[href^='http']:not([href*='linkedin.com'])",
    ".jobs-s-apply button:not([aria-label*='Easy'])",
    ".jobs-apply-button:not([aria-label*='Easy'])",
  ];

  for (const sel of fallbackSelectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 500 }).catch(() => false)) {
        const text = ((await el.innerText().catch(() => "")) || "").trim();
        const aria = ((await el.getAttribute("aria-label").catch(() => "")) || "").trim();
        if (!/easy\s*apply/i.test(`${text} ${aria}`)) {
          logger.info(`[JobSearch] ✅ Apply button (fallback): "${text || aria}" via ${sel}`);
          return await el.elementHandle();
        }
      }
    } catch (_) {}
  }

  // AI fallback — ask Gemini to identify the button
  try {
    logger.info(`[JobSearch] 🤖 AI scan for Apply button...`);
    const elements = await page.$$eval(
      ".jobs-s-apply button, .jobs-s-apply a, .jobs-apply-button, " +
      ".jobs-details__main-content button, .jobs-details__main-content a[href]",
      (els) => els
        .filter((el) => el.offsetWidth > 0 && window.getComputedStyle(el).display !== "none")
        .slice(0, 20)
        .map((el, i) => ({
          id: i,
          tag: el.tagName,
          text: (el.innerText || "").trim(),
          aria: (el.getAttribute("aria-label") || "").trim(),
          href: (el.getAttribute("href") || "").trim(),
        }))
        .filter((e) => e.text.length < 80 || e.aria.length < 80)
    );

    if (elements.length > 0) {
      const resp = await callGemini([{
        role: "user",
        content: `From these LinkedIn job page elements, find the "Apply" button that opens the COMPANY portal (external website). SKIP any "Easy Apply" button. Return only the JSON of the matching element, or {} if only Easy Apply exists.\n\n${JSON.stringify(elements)}`,
      }], 150);

      const found = resp.match(/\{[^}]+\}/);
      if (found) {
        const sel = JSON.parse(found[0]);
        if (sel.id !== undefined && !/easy\s*apply/i.test(`${sel.text} ${sel.aria}`)) {
          const all = await page.$$(`.jobs-s-apply ${sel.tag.toLowerCase()}, .jobs-details__main-content ${sel.tag.toLowerCase()}`);
          for (const el of all) {
            const t = (await el.innerText().catch(() => "")).trim();
            const a = (await el.getAttribute("aria-label").catch(() => "")).trim();
            if ((sel.text && t === sel.text) || (sel.aria && a === sel.aria)) {
              if (!/easy\s*apply/i.test(`${t} ${a}`)) return el;
            }
          }
        }
      }
    }
  } catch (e) {
    logger.warn(`[JobSearch] AI fallback error: ${e.message}`);
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 7 — Click Apply and capture company portal tab
// ─────────────────────────────────────────────────────────────────────────────
async function openCompanyPortal(page, jobTitle, applyBtn, userData) {
  logger.info(`[JobSearch] 🔵 Opening company portal for "${jobTitle}"...`);
  const context = page.context();
  let portalPage = null;

  try {
    await applyBtn.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(400);

    const currentUrl = page.url();
    const href = ((await applyBtn.getAttribute("href").catch(() => "")) || "").trim();

    // Listen for new tab BEFORE clicking
    const newTabPromise = context.waitForEvent("page", { timeout: 15000 }).catch(() => null);

    // Click the apply button
    try {
      await applyBtn.click({ force: true, timeout: 10000 });
    } catch (_) {
      await applyBtn.evaluate((el) => {
        try { el.click(); } catch (e) { if (el.href) window.open(el.href, "_blank"); }
      }).catch(() => {});
    }

    await page.waitForTimeout(2500);
    portalPage = await newTabPromise;

    // If no new tab: check if same-tab navigation happened
    if (!portalPage && page.url() !== currentUrl && !page.url().includes("linkedin.com/jobs")) {
      logger.info(`[JobSearch] Portal opened in same tab`);
      portalPage = page;
    }

    // LinkedIn sometimes shows a "Continue" confirmation modal before opening the portal
    if (!portalPage) {
      await waitForNetworkIdle(page, { quietMs: 800, maxWaitMs: 4000, label: "modal wait" });
      const confirmBtns = [
        "button:has-text('Continue')",
        "button:has-text('Apply on company website')",
        "a:has-text('Apply on company website')",
        ".artdeco-modal button.artdeco-button--primary",
      ];
      for (const sel of confirmBtns) {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
          logger.info(`[JobSearch] Clicking confirm modal: ${sel}`);
          const newTab2 = context.waitForEvent("page", { timeout: 12000 }).catch(() => null);
          await btn.click({ force: true }).catch(() => {});
          await page.waitForTimeout(2000);
          portalPage = await newTab2;
          if (!portalPage && page.url() !== currentUrl) portalPage = page;
          break;
        }
      }
    }

    // Last resort: open href directly
    if (!portalPage && href && href.startsWith("http") && !href.includes("linkedin.com")) {
      logger.info(`[JobSearch] Direct href fallback: ${href}`);
      portalPage = await context.newPage();
      await portalPage.goto(href, { waitUntil: "domcontentloaded", timeout: 30000 });
    }

  } catch (err) {
    logger.warn(`[JobSearch] Portal click error: ${err.message}`);
  }

  if (!portalPage) {
    logger.warn(`[JobSearch] ❌ Could not open portal for "${jobTitle}"`);
    return { success: false, url: "" };
  }

  const portalUrl = portalPage.url();
  logger.info(`[JobSearch] ✅ Portal opened: ${portalUrl}`);

  // Wait for portal to load (use portalPage — NOT page — to avoid wrong tab wait)
  await portalPage.waitForLoadState("domcontentloaded").catch(() => {});
  await waitForNetworkIdle(portalPage, { quietMs: 2000, maxWaitMs: 12000, label: "portal load" });
  await portalPage.waitForTimeout(1500);

  try {
    const result = await autofillPortalForm(portalPage, userData);
    if (result.success) {
      logger.info(`[JobSearch] ✅ Portal form filled for "${jobTitle}"`);
      return { success: true, url: portalUrl };
    }
    logger.warn(`[JobSearch] Form fill result: ${result.error}`);
    return { success: false, url: portalUrl };
  } catch (e) {
    logger.warn(`[JobSearch] autofillPortalForm error: ${e.message}`);
    return { success: false, url: portalUrl };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN — autoApplyJobs
// ─────────────────────────────────────────────────────────────────────────────
async function autoApplyJobs(userData, jobKeywords, location, allowedTitles) {
  const page    = getPage();
  const browser = getBrowser();

  if (!page || !browser) {
    throw new Error("Browser not initialized. Please login to LinkedIn first.");
  }

  const keywordsStr = encodeURIComponent(jobKeywords.join(" "));

  // ── 1. Navigate to search ────────────────────────────────────────────────
  const navOk = await navigateToLinkedInSearch(page, keywordsStr, location);
  if (!navOk) {
    return { success: false, message: "Failed to load LinkedIn job search. Check your internet connection or try different keywords." };
  }

  // ── 2. Wait for job cards ────────────────────────────────────────────────
  logger.info(`[JobSearch] ⏳ Waiting for job cards...`);
  const cardCount = await waitForJobCards(page, 1);

  if (cardCount === 0) {
    logger.warn(`[JobSearch] No job cards found. URL: ${page.url()}`);
    return { success: false, message: "No job listings found. Try different keywords or location." };
  }

  // ── 3. Dismiss overlays and scroll to load all cards ─────────────────────
  await dismissOverlays(page);
  await scrollJobsPane(page, 4);

  // Pick ONE non-duplicating selector (fixes the double-counting bug)
  const { selector: cardSel, count: totalCards } = await resolveJobCardSelector(page);
  logger.info(`[JobSearch] 📋 Total cards: ${totalCards} via "${cardSel}"`);

  if (totalCards === 0) {
    return { success: false, message: "Job cards disappeared after scrolling." };
  }

  // Use a SINGLE locator with the resolved selector — ensures nth(i) is always accurate
  const cards = page.locator(cardSel);

  // ── 4. Process each job card ─────────────────────────────────────────────
  let applied = 0;
  let skipped = 0;
  const results = [];

  for (let i = 0; i < totalCards; i++) {
    logger.info(`\n[JobSearch] ════ Job ${i + 1}/${totalCards} ════`);

    await dismissOverlays(page);

    // Get href for force-navigation fallback
    const card = cards.nth(i);
    let jobHref = "";
    try {
      jobHref = await card.getAttribute("href").catch(() => "");
      if (!jobHref) jobHref = await card.locator("a").first().getAttribute("href").catch(() => "");
    } catch (_) {}

    // Click the card
    await clickJobCard(page, card, i + 1);
    await dismissOverlays(page);

    // Wait for right pane to fully render (title + skeleton clear + apply area)
    let paneReady = await waitForRightPane(page);

    // If pane still not ready and we have a direct URL, force navigate
    if (!paneReady && jobHref) {
      const fullUrl = jobHref.startsWith("http") ? jobHref : `https://www.linkedin.com${jobHref}`;
      logger.warn(`[JobSearch] Pane hung — navigating directly to: ${fullUrl}`);
      try {
        await page.goto(fullUrl, { waitUntil: "domcontentloaded", timeout: 40000 });
        await waitForNetworkIdle(page, { quietMs: 1500, maxWaitMs: 10000, label: "direct job nav" });
        await dismissOverlays(page);
        paneReady = await waitForRightPane(page);
      } catch (e) {
        logger.warn(`[JobSearch] Direct navigation failed: ${e.message}`);
      }
    }

    if (!paneReady) {
      logger.warn(`[JobSearch] Pane not ready for card ${i + 1}. Skipping.`);
      skipped++;
      results.push({ title: "Unknown", status: "Skipped - Pane not ready" });
      continue;
    }

    // Read job details
    const jobDetails = await readJobDetails(page);
    const title = jobDetails.title;

    if (!title) {
      logger.warn(`[JobSearch] No title for card ${i + 1}. Skipping.`);
      skipped++;
      results.push({ title: "Unknown", status: "Skipped - No title" });
      continue;
    }

    logger.info(`[JobSearch] 📌 "${title}" at "${jobDetails.company}"`);

    // Check allowed titles
    if (allowedTitles && allowedTitles.length > 0) {
      const allowed = allowedTitles.some((t) => title.toLowerCase().includes(t.toLowerCase()));
      if (!allowed) {
        logger.info(`[JobSearch] ⏭  Title "${title}" not in allowed list. Skipping.`);
        skipped++;
        results.push({ ...jobDetails, status: "Skipped - Title not allowed" });
        await page.waitForTimeout(400);
        continue;
      }
    }

    // Find external Apply button
    const applyBtn = await findExternalApplyButton(page);

    if (!applyBtn) {
      logger.info(`[JobSearch] ⏭  No external Apply button for "${title}" (Easy Apply only or no apply). Skipping.`);
      skipped++;
      results.push({ ...jobDetails, status: "Skipped - Easy Apply only" });
      continue;
    }

    // Open company portal and fill form
    const portalResult = await openCompanyPortal(page, title, applyBtn, userData);
    if (portalResult.success) {
      applied++;
      logger.info(`[JobSearch] ✅ Applied: ${applied} total`);
      results.push({ ...jobDetails, applyLink: portalResult.url, status: "Applied - Portal Opened" });
    } else {
      skipped++;
      results.push({ ...jobDetails, applyLink: portalResult.url, status: "Skipped - Portal Failed" });
    }

    // Pause between jobs (human-like)
    await page.waitForTimeout(800 + Math.random() * 1000);
  }

  const summary = `Applied: ${applied}, Skipped: ${skipped} out of ${totalCards} jobs`;
  logger.info(`[JobSearch] ════ DONE ════ ${summary}`);
  return { success: true, message: summary, processedJobs: results };
}

module.exports = { autoApplyJobs };
