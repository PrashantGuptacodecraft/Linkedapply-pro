// ============================================================
//  humanTiming.js
//  LinkedApply Pro — Smart Human-Like Timing Utility
//
//  Philosophy: Never sleep blindly. Wait until LinkedIn actually
//  finishes loading before acting. This mimics how a real human
//  waits for the page to feel "ready" before clicking.
//
//  Functions:
//    waitForNetworkIdle    — waits until no XHR/fetch for N ms
//    waitForDOMStable      — waits until element count stops changing
//    waitForElementReady   — waits for element to be visible + stable
//    smartWait             — combines network + DOM + human jitter
//    adaptivePause         — randomized pause with ±jitter
// ============================================================

const logger = require("./logger");

// ─────────────────────────────────────────────────────────────
// waitForNetworkIdle
//
// Waits until LinkedIn has made no network requests for `quietMs`
// milliseconds in a row. This tells us the page has finished
// fetching data (jobs, filters, user info, etc.)
//
// @param {Page}   page        Playwright page object
// @param {object} options
//   quietMs    {number}  How long silence before "idle" (default 1500)
//   maxWaitMs  {number}  Hard timeout — give up after this (default 20000)
//   label      {string}  Log label for debugging
// ─────────────────────────────────────────────────────────────
async function waitForNetworkIdle(page, options = {}) {
  const {
    quietMs = 1500,
    maxWaitMs = 20000,
    label = "page",
  } = options;

  const startedAt = Date.now();
  let lastRequestAt = Date.now();
  let requestCount = 0;

  // Track ongoing requests
  const onRequest = () => {
    requestCount++;
    lastRequestAt = Date.now();
  };
  const onResponse = () => {
    requestCount = Math.max(0, requestCount - 1);
    lastRequestAt = Date.now();
  };
  const onRequestFailed = () => {
    requestCount = Math.max(0, requestCount - 1);
    lastRequestAt = Date.now();
  };

  page.on("request", onRequest);
  page.on("response", onResponse);
  page.on("requestfailed", onRequestFailed);

  try {
    // Poll until quiet for quietMs, or until maxWaitMs
    while (Date.now() - startedAt < maxWaitMs) {
      await page.waitForTimeout(200);

      const silentFor = Date.now() - lastRequestAt;
      const elapsed = Date.now() - startedAt;

      if (silentFor >= quietMs && requestCount === 0) {
        logger.info(`[Timing] 🌐 Network idle (${label}) — settled after ${elapsed}ms`);
        return true;
      }
    }

    logger.warn(`[Timing] ⚠️ Network idle timeout after ${maxWaitMs}ms for "${label}" — continuing anyway`);
    return false;
  } finally {
    // Always clean up listeners
    page.removeListener("request", onRequest);
    page.removeListener("response", onResponse);
    page.removeListener("requestfailed", onRequestFailed);
  }
}

// ─────────────────────────────────────────────────────────────
// waitForDOMStable
//
// Polls the count of elements matching `selector` every `pollMs`.
// When the count stays the same for `stableChecks` consecutive
// polls, we declare the DOM stable (LinkedIn stopped adding cards).
//
// @param {Page}   page
// @param {string|string[]} selectors   CSS selector(s) to watch
// @param {object} options
//   pollMs       {number}  Poll interval (default 400)
//   stableChecks {number}  How many same-count polls = stable (default 3)
//   maxWaitMs    {number}  Hard timeout (default 15000)
//   minCount     {number}  Don't declare stable until at least N elements (default 0)
//   label        {string}  Log label
// ─────────────────────────────────────────────────────────────
async function waitForDOMStable(page, selectors, options = {}) {
  const {
    pollMs = 400,
    stableChecks = 3,
    maxWaitMs = 15000,
    minCount = 0,
    label = selectors,
  } = options;

  const combined = Array.isArray(selectors) ? selectors.join(", ") : selectors;
  const startedAt = Date.now();
  let lastCount = -1;
  let sameCount = 0;

  while (Date.now() - startedAt < maxWaitMs) {
    await page.waitForTimeout(pollMs);

    let currentCount = 0;
    try {
      currentCount = await page.locator(combined).count();
    } catch (_) {
      currentCount = 0;
    }

    if (currentCount === lastCount && currentCount >= minCount) {
      sameCount++;
      if (sameCount >= stableChecks) {
        const elapsed = Date.now() - startedAt;
        logger.info(`[Timing] 📄 DOM stable (${label}) — ${currentCount} element(s) after ${elapsed}ms`);
        return currentCount;
      }
    } else {
      sameCount = 0;
      lastCount = currentCount;
    }
  }

  logger.warn(`[Timing] ⚠️ DOM stability timeout for "${label}" after ${maxWaitMs}ms — count=${lastCount}`);
  return lastCount;
}

// ─────────────────────────────────────────────────────────────
// waitForElementReady
//
// Waits for an element to:
//   1. Appear in the DOM
//   2. Be visible (not hidden/display:none)
//   3. Have a stable bounding box (not still animating in)
//
// @param {Page}   page
// @param {string|string[]} selectors
// @param {object} options
//   label      {string}   Log label
//   timeoutMs  {number}   How long to wait total (default 15000)
//   stabilizeMs {number}  Extra pause after visible for animation settle (default 300)
// ─────────────────────────────────────────────────────────────
async function waitForElementReady(page, selectors, options = {}) {
  const {
    label = "element",
    timeoutMs = 15000,
    stabilizeMs = 300,
  } = options;

  const combined = Array.isArray(selectors) ? selectors.join(", ") : selectors;

  try {
    // Step 1: Wait for visibility
    await page.waitForSelector(combined, { state: "visible", timeout: timeoutMs });

    // Step 2: Small pause for CSS animations / transitions to settle
    if (stabilizeMs > 0) {
      await page.waitForTimeout(stabilizeMs);
    }

    logger.info(`[Timing] ✅ Element ready: "${label}"`);
    return true;
  } catch (_) {
    logger.warn(`[Timing] ⚠️ Element not ready: "${label}" within ${timeoutMs}ms`);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// smartWait
//
// The main workhorse. Combines:
//   1. waitForNetworkIdle — LinkedIn stops fetching
//   2. waitForDOMStable   — elements stop changing (optional)
//   3. adaptivePause      — human breathing room jitter
//
// Use this at all major transition points:
//   - After navigating to a new URL
//   - After applying a filter
//   - After clicking a job card
//   - After opening a modal
//
// @param {Page}   page
// @param {string} label        What we're waiting for (for logs)
// @param {number} minMs        Minimum total wait (ms) — human feels "immediate" if < 800ms
// @param {number} maxMs        Maximum total wait (ms)
// @param {object} domOptions   Optional: pass selector + options for DOM stability check
// ─────────────────────────────────────────────────────────────
async function smartWait(page, label, minMs = 1200, maxMs = 5000, domOptions = null) {
  const startedAt = Date.now();
  logger.info(`[Timing] ⏳ smartWait: "${label}"...`);

  // Step 1: Network idle (LinkedIn finishes its API calls)
  await waitForNetworkIdle(page, {
    quietMs: 1500,
    maxWaitMs: Math.min(maxMs - 500, 18000),
    label,
  });

  // Step 2: DOM stability (if a selector is provided)
  if (domOptions && domOptions.selector) {
    await waitForDOMStable(page, domOptions.selector, {
      pollMs: 400,
      stableChecks: 2,
      maxWaitMs: Math.min(maxMs - 300, 12000),
      minCount: domOptions.minCount || 0,
      label,
    });
  }

  // Step 3: Ensure we always wait at least minMs total
  const elapsed = Date.now() - startedAt;
  if (elapsed < minMs) {
    const remaining = minMs - elapsed;
    // Add ±20% jitter to the remaining time for human-like feel
    const jittered = remaining + Math.floor((Math.random() - 0.5) * remaining * 0.4);
    if (jittered > 0) {
      await page.waitForTimeout(Math.max(jittered, 200));
    }
  }

  const total = Date.now() - startedAt;
  logger.info(`[Timing] ✅ smartWait done: "${label}" — total ${total}ms`);
}

// ─────────────────────────────────────────────────────────────
// adaptivePause
//
// A simple human-like random pause. Shorter than smartWait —
// use for micro-pauses between small actions (scroll steps,
// form field fills, hover states).
//
// @param {Page}   page
// @param {number} baseMs      Center of the pause window
// @param {number} jitter      Fraction ±variation (default 0.35 = ±35%)
// @param {string} label       Log label
// ─────────────────────────────────────────────────────────────
async function adaptivePause(page, baseMs, jitter = 0.35, label = "") {
  const variation = Math.floor(baseMs * jitter * (Math.random() * 2 - 1));
  const actualMs = Math.max(200, baseMs + variation);
  if (label) {
    logger.info(`[Timing] ⏸  adaptivePause (${label}): ${actualMs}ms`);
  }
  await page.waitForTimeout(actualMs);
}

// ─────────────────────────────────────────────────────────────
// waitForJobCards
//
// Specialized helper: waits until job cards appear AND stop
// changing (LinkedIn lazy-loads them). Returns the final count.
//
// @param {Page}   page
// @param {number} minRequired   Warn if fewer than this many loaded
// ─────────────────────────────────────────────────────────────
async function waitForJobCards(page, minRequired = 1) {
  logger.info(`[Timing] 🃏 Waiting for job cards to load and stabilize...`);

  // First wait for at least one card to appear
  const appeared = await waitForElementReady(page, [
    ".job-card-container",
    ".jobs-search-results__list-item",
    ".jobs-search-results__list-item--occluded",
    "li.scaffold-layout__list-item",
    "li a[href*='/jobs/view/']",
    "a[href*='/jobs/view/']",
  ], { label: "job cards", timeoutMs: 12000, stabilizeMs: 0 });

  if (!appeared) {
    logger.warn(`[Timing] ⚠️ No job cards appeared within 12s`);
    return 0;
  }

  // Then wait for the count to stabilize (LinkedIn adds cards as you wait)
  const finalCount = await waitForDOMStable(page, [
    ".job-card-container",
    ".jobs-search-results__list-item",
    ".jobs-search-results__list-item--occluded",
    "li.scaffold-layout__list-item",
    "li a[href*='/jobs/view/']",
    "a[href*='/jobs/view/']",
  ], {
    pollMs: 300,
    stableChecks: 2,
    maxWaitMs: 5000,
    minCount: minRequired,
    label: "job cards",
  });

  if (finalCount < minRequired) {
    logger.warn(`[Timing] ⚠️ Only ${finalCount} job cards loaded (expected ≥${minRequired})`);
  } else {
    logger.info(`[Timing] ✅ ${finalCount} job cards loaded and stable`);
  }

  return finalCount;
}

// ─────────────────────────────────────────────────────────────
// waitForRightPaneUpdate
//
// After clicking a job card, LinkedIn's right pane updates via
// XHR — NOT a full page navigation. This waits for it to finish.
//
// @param {Page}   page
// @param {string} previousTitle  Title of the previously selected job (to detect change)
// ─────────────────────────────────────────────────────────────
async function waitForRightPaneUpdate(page, previousTitle = "") {
  logger.info(`[Timing] 🗂️ Waiting for right pane to update...`);

  // Wait for network to go quiet (LinkedIn fetches the new job details via XHR)
  await waitForNetworkIdle(page, {
    quietMs: 700,
    maxWaitMs: 5000,
    label: "right pane XHR",
  });

  // Wait for the job title to appear — covers 2024/2025 LinkedIn UI redesign
  const titleSelectors = [
    ".jobs-details__main-content h1",
    ".job-details-jobs-unified-top-card__job-title h1",
    ".jobs-unified-top-card__job-title h1",
    ".jobs-unified-top-card__job-title",
    ".job-details-jobs-unified-top-card__job-title",
    ".job-view-layout h1",
    "h1.t-24",
    ".t-24.t-bold",
    "[data-test-job-title]",
    ".topcard__title",
  ];

  const appeared = await waitForElementReady(page, titleSelectors, {
    label: "job title h1",
    timeoutMs: 6000,
    stabilizeMs: 200,
  });

  if (appeared) {
    // SOFT skeleton check: skeleton loaders sometimes persist on certain LinkedIn
    // themes even when the job detail is fully rendered. Do NOT hard-fail here.
    try {
      const skeletonStillVisible = await page
        .locator(".ghost-animate, .jobs-ghost-fadein, .artdeco-skeleton")
        .first()
        .isVisible({ timeout: 800 })
        .catch(() => false);

      if (skeletonStillVisible) {
        // Give it up to 3s to clear; if it doesn't, proceed anyway
        await page
          .waitForSelector(".ghost-animate, .jobs-ghost-fadein, .artdeco-skeleton", {
            state: "hidden",
            timeout: 3000,
          })
          .catch(() => {
            logger.warn(`[Timing] ⚠️ Skeleton still showing but title visible — proceeding`);
          });
      }
    } catch (_) {}
    return true;
  }

  // LinkedIn sometimes opens the full job detail page instead of a right-pane update.
  // In that case, an apply CTA is still a valid signal that the card has loaded.
  const applyFallback = await waitForElementReady(page, [
    ".jobs-s-apply",
    ".jobs-apply-button",
    ".jobs-details__main-content .artdeco-button",
    ".jobs-unified-top-card__content--two-pane .artdeco-button",
    "a[href*='apply']",
    "button[aria-label*='apply']",
  ], {
    label: "apply CTA fallback",
    timeoutMs: 4000,
    stabilizeMs: 100,
  });

  return applyFallback;
}

// ─────────────────────────────────────────────────────────────
// waitForModalReady
//
// After clicking Easy Apply, the modal slides in via animation.
// Wait for it to be fully open and all form fields rendered.
//
// @param {Page}   page
// ─────────────────────────────────────────────────────────────
async function waitForModalReady(page) {
  logger.info(`[Timing] 💬 Waiting for Easy Apply modal to fully open...`);

  const modalSelectors = [
    ".jobs-easy-apply-modal",
    "[data-test-modal]",
    ".artdeco-modal--layer-default",
    ".jobs-easy-apply-content",
  ];

  // Wait for modal container to appear
  const appeared = await waitForElementReady(page, modalSelectors, {
    label: "Easy Apply modal",
    timeoutMs: 12000,
    stabilizeMs: 500,
  });

  if (!appeared) return false;

  // Wait for network to settle (modal may lazy-load form fields via XHR)
  await waitForNetworkIdle(page, {
    quietMs: 1200,
    maxWaitMs: 8000,
    label: "Easy Apply modal XHR",
  });

  // Final DOM stability check on form fields
  await waitForDOMStable(page, [
    ".jobs-easy-apply-modal input",
    ".jobs-easy-apply-modal select",
    ".jobs-easy-apply-modal textarea",
    "[data-test-modal] input",
    "[data-test-modal] select",
  ], {
    pollMs: 300,
    stableChecks: 2,
    maxWaitMs: 5000,
    label: "modal form fields",
  });

  logger.info(`[Timing] ✅ Easy Apply modal ready — all fields rendered`);
  return true;
}

module.exports = {
  waitForNetworkIdle,
  waitForDOMStable,
  waitForElementReady,
  smartWait,
  adaptivePause,
  waitForJobCards,
  waitForRightPaneUpdate,
  waitForModalReady,
};
