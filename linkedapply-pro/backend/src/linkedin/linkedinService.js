// ============================================================
//  LinkedApply Pro — LinkedIn Automation Service
//  File: backend/src/linkedin/linkedinService.js
//  Uses: Playwright (headless browser)
// ============================================================

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const logger = require("../utils/logger");

let browser = null;
let page = null;
const LINKEDIN_LOGIN_URL = "https://www.linkedin.com/login";
const LINKEDIN_HOME_URL = "https://www.linkedin.com/";
const LINKEDIN_LOGIN_ENTRY_URLS = [LINKEDIN_LOGIN_URL, LINKEDIN_HOME_URL];
const LINKEDIN_EMAIL_SELECTORS = [
  "#username",
  "input[name='session_key']",
  "input[name='username']",
  "input[type='email']",
];
const LINKEDIN_PASSWORD_SELECTORS = [
  "#password",
  "input[name='session_password']",
  "input[name='password']",
  "input[type='password']",
];
const LINKEDIN_SIGN_IN_BUTTON_SELECTORS = [
  "button[type='submit']",
  "button[type='button']",
  "[role='button']",
];
const PROXY_ENV_KEYS = [
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "NO_PROXY",
  "http_proxy",
  "https_proxy",
  "all_proxy",
  "no_proxy",
  "GIT_HTTP_PROXY",
  "GIT_HTTPS_PROXY",
];
const SEARCH_RESULT_CONTAINER_SELECTORS = [
  "div[role='listitem'][componentkey*='FeedType_FLAGSHIP_SEARCH']",
  "div[componentkey*='FeedType_FLAGSHIP_SEARCH'][role='listitem']",
  ".search-content__result",
  "li.reusable-search__result-container",
  ".reusable-search__result-container",
  "div[data-chameleon-result-urn]",
  ".feed-shared-update-v2",
];
const SEARCH_READY_SELECTORS = [
  ...SEARCH_RESULT_CONTAINER_SELECTORS,
  ".artdeco-empty-state",
  ".search-no-results__image-container",
  ".search-results-container",
];

function isPostLoginUrl(url) {
  return url.includes("/feed") || url.includes("/mynetwork");
}

function isChallengeUrl(url) {
  return url.includes("/checkpoint") || url.includes("/challenge");
}

function normalizeLinkedInBrowserError(message) {
  if (message.includes("Executable doesn't exist")) {
    return "Playwright Chromium is not installed. Run `npx playwright install chromium` in the backend folder, then try LinkedIn login again.";
  }

  if (message.includes("ERR_NAME_NOT_RESOLVED") || message.includes("ERR_CONNECTION_RESET") || message.includes("ERR_CONNECTION_CLOSED")) {
    return "LinkedIn could not be reached. This may be due to network issues, VPN/proxy interference, or LinkedIn blocking automated access. Try: 1) Disable VPN/proxy, 2) Use a different network, 3) Wait a few minutes and retry, 4) Check if LinkedIn is accessible in a regular browser.";
  }

  return message;
}

function isWithinHours(postedTime = "", hoursBack = 24) {
  const value = postedTime.trim().toLowerCase();
  const match = value.match(/(\d+)\s*([smhdw])/);

  if (!match) {
    return true;
  }

  const amount = Number(match[1]);
  const unit = match[2];

  if (unit === "s" || unit === "m") {
    return true;
  }

  if (unit === "h") {
    return amount <= hoursBack;
  }

  if (unit === "d") {
    return amount * 24 <= hoursBack;
  }

  if (unit === "w") {
    return amount * 24 * 7 <= hoursBack;
  }

  return true;
}

function isConnectionResetError(message = "") {
  return message.includes("ERR_CONNECTION_RESET") || message.includes("ERR_CONNECTION_CLOSED");
}

function getPlaywrightLaunchEnv() {
  const env = { ...process.env };

  if (process.env.LINKEDIN_IGNORE_PROXY === "false") {
    return env;
  }

  const removed = [];
  for (const key of PROXY_ENV_KEYS) {
    if (env[key]) {
      removed.push(`${key}=${env[key]}`);
      delete env[key];
    }
  }

  if (removed.length > 0) {
    logger.warn(`Ignoring proxy env vars for LinkedIn browser: ${removed.join(", ")}`);
  }

  return env;
}

async function waitForVisibleSelector(selectors, timeout = 15000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    for (const selector of selectors) {
      const locator = page.locator(selector);
      const count = await locator.count().catch(() => 0);

      for (let i = 0; i < count; i++) {
        const candidate = locator.nth(i);
        if (await candidate.isVisible().catch(() => false)) {
          return { selector, index: i };
        }
      }
    }

    await page.waitForTimeout(250);
  }

  return null;
}

async function clickVisibleLinkedInSignInButton() {
  for (const selector of LINKEDIN_SIGN_IN_BUTTON_SELECTORS) {
    const locator = page.locator(selector);
    const count = await locator.count().catch(() => 0);

    for (let i = 0; i < count; i++) {
      const candidate = locator.nth(i);
      const isVisible = await candidate.isVisible().catch(() => false);
      const text = ((await candidate.textContent().catch(() => "")) || "").trim().toLowerCase();

      if (isVisible && text === "sign in") {
        await candidate.click();
        return true;
      }
    }
  }

  return false;
}

async function saveLinkedInSnapshot(prefix) {
  const snapshotPath = path.resolve(__dirname, `../../../logs/${prefix}-${Date.now()}.html`);
  fs.writeFileSync(snapshotPath, await page.content(), "utf8");
  return snapshotPath;
}

function buildSearchTerms(keywords) {
  const terms = keywords
    .split(/[\n,|]+/)
    .map((term) => term.trim())
    .filter(Boolean);

  return [...new Set(terms)].slice(0, 5);
}

function buildLinkedInSearchUrl(term) {
  const query = encodeURIComponent(term);
  return `https://www.linkedin.com/search/results/content/?keywords=${query}&origin=GLOBAL_SEARCH_HEADER`;
}

function dedupePosts(posts) {
  const seen = new Set();
  const unique = [];

  for (const post of posts) {
    const key = [
      post.profileUrl || "",
      post.recruiterEmail || "",
      (post.postText || "").slice(0, 120),
    ].join("::");

    if (!seen.has(key)) {
      seen.add(key);
      unique.push(post);
    }
  }

  return unique;
}

// ── Launch Browser ───────────────────────────────────────────
async function launchBrowser(forceVisible = false) {
  const headless = false; // User requested to see the browser process
  browser = await chromium.launch({
    headless,
    env: getPlaywrightLaunchEnv(),
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--no-proxy-server",
      "--disable-blink-features=AutomationControlled",
      "--disable-features=TranslateUI",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-backgrounding-occluded-windows",
      "--disable-popup-blocking",
      "--disable-extensions",
      "--disable-default-apps",
      "--disable-sync",
      "--disable-translate",
      "--hide-scrollbars",
      "--mute-audio",
      "--no-first-run",
      "--safebrowsing-disable-auto-update",
      "--no-default-browser-check",
      "--disable-dev-shm-usage",
    ],
  });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
    locale: "en-US",
    timezoneId: "America/New_York",
    geolocation: { latitude: 40.7128, longitude: -74.0060 }, // New York coordinates
    extraHTTPHeaders: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "Accept-Encoding": "gzip, deflate, br",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "max-age=0",
      "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": '"Windows"',
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
    },
    ignoreHTTPSErrors: true,
    javaScriptEnabled: true,
  });
  page = await context.newPage();
  page.setDefaultNavigationTimeout(45000);
  page.setDefaultTimeout(30000);

  // Add some realistic browser properties
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });

    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });

    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });

    const originalQuery = window.navigator.permissions.query.bind(window.navigator.permissions);
    window.navigator.permissions.query = (parameters) => {
      if (parameters?.name === 'notifications') {
        return Promise.resolve({ state: Notification.permission });
      }
      return originalQuery(parameters);
    };

    if (!window.chrome) {
      window.chrome = {
        runtime: {},
        loadTimes: () => ({}),
        csi: () => ({}),
        app: {},
      };
    }

    Object.defineProperty(navigator, 'hardwareConcurrency', {
      get: () => 8,
    });

    Object.defineProperty(navigator, 'deviceMemory', {
      get: () => 8,
    });

    Object.defineProperty(navigator, 'platform', {
      get: () => 'Win32',
    });
  });

  logger.info(`Browser launched ${headless ? '(headless)' : '(visible — complete 2FA in this window)'} with stealth options`);
  return { browser, page };
}

// ── Wait for user to manually complete 2FA/CAPTCHA ───────────
const TWO_FA_TIMEOUT_MS = 120000; // 2 minutes
const TWO_FA_POLL_INTERVAL_MS = 3000;

async function waitForManual2FA() {
  logger.info(`⏳ 2FA/CAPTCHA detected — a browser window is open. Complete the challenge there within 2 minutes...`);

  const startedAt = Date.now();

  while (Date.now() - startedAt < TWO_FA_TIMEOUT_MS) {
    await page.waitForTimeout(TWO_FA_POLL_INTERVAL_MS);

    try {
      const currentUrl = page.url();

      if (isPostLoginUrl(currentUrl)) {
        logger.info("✅ 2FA completed — LinkedIn feed reached");
        return { success: true, message: "Login successful (2FA completed)" };
      }

      // Check if the page now shows the feed content (sometimes URL doesn't change immediately)
      const feedVisible = await page.locator(".feed-shared-update-v2, .scaffold-layout__main, .global-nav__me").first().isVisible().catch(() => false);
      if (feedVisible) {
        logger.info("✅ 2FA completed — LinkedIn feed content detected");
        return { success: true, message: "Login successful (2FA completed)" };
      }

      // Still on challenge page — keep waiting
      const elapsed = Math.round((Date.now() - startedAt) / 1000);
      logger.info(`⏳ Waiting for 2FA completion... (${elapsed}s / ${TWO_FA_TIMEOUT_MS / 1000}s)`);
    } catch (err) {
      logger.warn(`2FA poll error: ${err.message}`);
    }
  }

  return {
    success: false,
    message: "2FA/CAPTCHA was not completed within 2 minutes. Please try again.",
  };
}

async function navigateToLinkedInLogin() {
  let lastError = null;
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    for (const url of LINKEDIN_LOGIN_ENTRY_URLS) {
      try {
        logger.info(`Opening LinkedIn entry page: ${url} (attempt ${attempt + 1}/${maxRetries})`);

        // Add random delay before navigation (increase with retries)
        const baseDelay = Math.random() * 2000 + 1000;
        const retryDelay = attempt * 3000;
        await page.waitForTimeout(baseDelay + retryDelay);

        await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: 45000,
          referer: "https://www.google.com/",
        });

        // Wait a bit after navigation
        await page.waitForTimeout(Math.random() * 3000 + 2000);

        if (isPostLoginUrl(page.url()) || isChallengeUrl(page.url())) {
          return;
        }

        const emailField = await waitForVisibleSelector(LINKEDIN_EMAIL_SELECTORS, 8000);
        if (emailField) {
          return;
        }
      } catch (err) {
        lastError = err;
        logger.warn(`LinkedIn entry navigation failed for ${url}: ${err.message}`);
        if (isConnectionResetError(err.message)) {
          await closeBrowser().catch(() => {});
          await launchBrowser();
          break; // Try next attempt with fresh browser
        }
      }
    }

    // If we get here, all URLs failed for this attempt
    if (!isConnectionResetError(lastError?.message || '')) {
      break; // Don't retry for non-connection errors
    }
  }

  const signInLinkSelectors = [
    "a[href*='/login']",
    "a.nav__button-secondary",
    "a.main__sign-in-link",
  ];

  for (const selector of signInLinkSelectors) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      await locator.click().catch(() => {});
      const emailField = await waitForVisibleSelector(LINKEDIN_EMAIL_SELECTORS, 8000);
      if (emailField) {
        return;
      }
    }
  }

  const snapshotPath = await saveLinkedInSnapshot("linkedin-login");
  const title = await page.title().catch(() => "Unknown title");

  throw new Error(
    lastError?.message ||
    `LinkedIn login form did not load. Page title="${title}". Snapshot saved to ${snapshotPath}`
  );
}

async function waitForLinkedInLoginResult() {
  try {
    await page.waitForURL(
      (url) => {
        const href = url.toString();
        return isPostLoginUrl(href) || isChallengeUrl(href) || href.includes("/login");
      },
      { timeout: 20000 }
    );
  } catch (err) {
    const currentUrl = page.url();
    if (isPostLoginUrl(currentUrl) || isChallengeUrl(currentUrl)) {
      return currentUrl;
    }
    throw err;
  }

  await page.waitForLoadState("domcontentloaded").catch(() => {});
  return page.url();
}

async function readLinkedInLoginError() {
  const errorSelectors = [
    "#error-for-password",
    "#error-for-username",
    ".alert-content",
    "[role='alert']",
  ];

  for (const selector of errorSelectors) {
    const errorNode = page.locator(selector).first();
    if (await errorNode.count()) {
      const text = (await errorNode.textContent())?.trim();
      if (text) {
        return text;
      }
    }
  }

  return null;
}

async function waitForSearchResultsPage() {
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForTimeout(2500);

  await page.waitForFunction(
    (selectors) => selectors.some((selector) => document.querySelector(selector)),
    SEARCH_READY_SELECTORS,
    { timeout: 15000 }
  ).catch(() => {});
}

async function scrollSearchResults() {
  let lastHeight = 0;

  for (let i = 0; i < 6; i++) {
    const currentHeight = await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight * 0.9);
      return document.body.scrollHeight;
    });

    await page.waitForTimeout(1200);

    if (currentHeight === lastHeight) {
      break;
    }

    lastHeight = currentHeight;
  }
}

async function collectVisiblePosts() {
  return page.evaluate((containerSelectors) => {
    const textSelectors = [
      ".feed-shared-update-v2__description",
      ".update-components-text",
      ".update-components-text-view",
      "[data-test-id='main-feed-activity-card__commentary']",
      "div[dir='ltr']",
      "article",
      ".break-words",
    ];
    const authorSelectors = [
      ".update-components-actor__name",
      ".update-components-actor__title",
      ".feed-shared-actor__name",
      "a[href*='/in/'] p",
      "a[href*='/company/'] p",
    ];
    const timeSelectors = [
      ".update-components-actor__sub-description",
      ".update-components-actor__description",
      "p[componentkey]",
      "time",
    ];
    const profileSelectors = [
      ".update-components-actor__meta a",
      ".update-components-actor__container-link",
      "a[href*='/in/']",
      "a[href*='/company/']",
      "a.app-aware-link",
    ];
    const postUrlSelectors = [
      "a[href*='/update/urn:li:']",
      "a[href*='/posts/']",
    ];
    const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
    const timeRegex = /\b\d+\s*[smhdw]\b/i;
    const nodes = [];
    const seenNodes = new Set();

    const pickText = (root, selectors, fallbackToRoot = false) => {
      for (const selector of selectors) {
        const node = root.querySelector(selector);
        const text = node?.innerText?.trim();
        if (text) {
          return text;
        }
      }

      return fallbackToRoot ? root.innerText?.trim() || "" : "";
    };

    const pickHref = (root, selectors) => {
      for (const selector of selectors) {
        const node = root.querySelector(selector);
        const href = node?.href;
        if (href) {
          return href;
        }
      }

      return "";
    };

    const pickAuthorName = (root) => {
      const explicitAuthor = pickText(root, authorSelectors);
      if (explicitAuthor) {
        return explicitAuthor;
      }

      const profileLink = root.querySelector("a[aria-label*='profile']");
      const ariaLabel = profileLink?.getAttribute("aria-label") || "";
      if (ariaLabel) {
        return ariaLabel.split(",")[0].trim();
      }

      return "";
    };

    const pickPostedTime = (root) => {
      const explicitTime = pickText(root, timeSelectors);
      if (explicitTime && timeRegex.test(explicitTime)) {
        return explicitTime;
      }

      const lines = (root.innerText || "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      return lines.find((line) => timeRegex.test(line)) || "";
    };

    containerSelectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((node) => {
        if (!seenNodes.has(node)) {
          seenNodes.add(node);
          nodes.push(node);
        }
      });
    });

    const posts = nodes.map((el) => {
      const postText = pickText(el, textSelectors, true).slice(0, 500);
      const authorName = pickAuthorName(el);
      const postedTime = pickPostedTime(el);
      const profileUrl = pickHref(el, profileSelectors);
      const postUrl = pickHref(el, postUrlSelectors);
      const fullText = el.innerText || "";
      const emails = fullText.match(emailRegex) || [];

      return {
        authorName,
        postedTime,
        profileUrl,
        postUrl,
        postText,
        recruiterEmail: emails[0] || null,
        fullEmails: emails,
      };
    }).filter((post) => post.postText || post.authorName || post.profileUrl);

    const selectorCounts = Object.fromEntries(
      containerSelectors.map((selector) => [selector, document.querySelectorAll(selector).length])
    );

    return {
      posts,
      selectorCounts,
      title: document.title,
      url: window.location.href,
      textSample: document.body.innerText.slice(0, 500),
    };
  }, SEARCH_RESULT_CONTAINER_SELECTORS);
}

async function saveSearchSnapshot(term) {
  const safeTerm = term.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase() || "search";
  const snapshotPath = path.resolve(__dirname, `../../../logs/linkedin-search-${safeTerm}-${Date.now()}.html`);

  fs.writeFileSync(snapshotPath, await page.content(), "utf8");
  return snapshotPath;
}

async function searchPostsForTerm(term, hoursBack) {
  const searchUrl = buildLinkedInSearchUrl(term);

  logger.info(`Searching LinkedIn content for term: "${term}"`);
  await page.goto(searchUrl, {
    waitUntil: "domcontentloaded",
    timeout: 45000,
    referer: "https://www.google.com/",
  });
  await waitForSearchResultsPage();
  await scrollSearchResults();

  const scraped = await collectVisiblePosts();
  const filteredPosts = scraped.posts.filter((post) => isWithinHours(post.postedTime, hoursBack));

  logger.info(
    `Search term "${term}" yielded ${filteredPosts.length} posts; selectors=${JSON.stringify(scraped.selectorCounts)}`
  );

  if (scraped.posts.length === 0) {
    const snapshotPath = await saveSearchSnapshot(term);
    logger.warn(
      `No post containers were scraped for "${term}". Snapshot saved to ${snapshotPath}. Page title="${scraped.title}". URL=${scraped.url}`
    );
  }

  return filteredPosts.map((post) => ({ ...post, matchedKeyword: term }));
}

// ── Step 1: Login to LinkedIn ────────────────────────────────
async function loginLinkedIn(email, password) {
  try {
    // First check if we can reach LinkedIn
    try {
      const axios = require('axios');
      await axios.get('https://www.linkedin.com', { timeout: 10000 });
      logger.info("LinkedIn is reachable via HTTP");
    } catch (networkErr) {
      logger.warn(`LinkedIn network check failed: ${networkErr.message}`);
      return {
        success: false,
        message: "Cannot reach LinkedIn. Check your internet connection and try again."
      };
    }

    if (!browser || page?.isClosed()) {
      await launchBrowser();
    }

    logger.info(`Navigating to LinkedIn login...`);
    await navigateToLinkedInLogin();

    if (isPostLoginUrl(page.url())) {
      logger.info("LinkedIn session already active");
      return { success: true, message: "Login successful" };
    }

    // ── 2FA/CAPTCHA before login form ─────────────────────────
    if (isChallengeUrl(page.url())) {
      logger.warn("2FA / CAPTCHA challenge detected before login form — reopening browser in visible mode");
      await closeBrowser().catch(() => {});
      await launchBrowser(true); // force visible
      await navigateToLinkedInLogin();

      if (isPostLoginUrl(page.url())) {
        return { success: true, message: "Login successful" };
      }

      if (isChallengeUrl(page.url())) {
        return await waitForManual2FA();
      }
    }

    const emailField = await waitForVisibleSelector(LINKEDIN_EMAIL_SELECTORS, 10000);
    const passwordField = await waitForVisibleSelector(LINKEDIN_PASSWORD_SELECTORS, 5000);

    if (!emailField || !passwordField) {
      const snapshotPath = await saveLinkedInSnapshot("linkedin-login-form-missing");
      throw new Error(`LinkedIn login form fields were not found. Snapshot saved to ${snapshotPath}`);
    }

    await page.locator(emailField.selector).nth(emailField.index).fill(email);

    // Add human-like delay before typing password
    await page.waitForTimeout(Math.random() * 1000 + 500);

    await page.locator(passwordField.selector).nth(passwordField.index).fill(password);

    // Add mouse movement to make it more human-like
    await page.mouse.move(Math.random() * 800 + 200, Math.random() * 600 + 200);

    // Small delay before clicking
    await page.waitForTimeout(Math.random() * 1500 + 500);

    const clicked = await clickVisibleLinkedInSignInButton();
    if (!clicked) {
      throw new Error("LinkedIn sign-in button was not found.");
    }

    const url = await waitForLinkedInLoginResult();

    if (isPostLoginUrl(url)) {
      logger.info("LinkedIn login successful");
      return { success: true, message: "Login successful" };
    } else if (isChallengeUrl(url)) {
      // ── 2FA/CAPTCHA after submitting credentials ─────────────
      logger.warn("2FA / CAPTCHA challenge detected after login — opening visible browser for manual completion");

      // If we're currently headless, relaunch in visible mode
      if (process.env.LINKEDIN_HEADLESS !== "false") {
        await closeBrowser().catch(() => {});
        await launchBrowser(true); // force visible
        await navigateToLinkedInLogin();

        // Re-enter credentials in the visible browser
        const emailField2 = await waitForVisibleSelector(LINKEDIN_EMAIL_SELECTORS, 10000);
        const passwordField2 = await waitForVisibleSelector(LINKEDIN_PASSWORD_SELECTORS, 5000);
        if (emailField2 && passwordField2) {
          await page.locator(emailField2.selector).nth(emailField2.index).fill(email);
          await page.waitForTimeout(Math.random() * 1000 + 500);
          await page.locator(passwordField2.selector).nth(passwordField2.index).fill(password);
          await page.waitForTimeout(Math.random() * 1500 + 500);
          await clickVisibleLinkedInSignInButton();
          await waitForLinkedInLoginResult().catch(() => {});
        }
      }

      // Now wait for the user to complete 2FA in the visible window
      return await waitForManual2FA();
    } else {
      const inlineError = await readLinkedInLoginError();
      return {
        success: false,
        message: inlineError || "Login failed. Check your LinkedIn email/password.",
      };
    }
  } catch (err) {
    const message = normalizeLinkedInBrowserError(err.message);
    await closeBrowser().catch(() => {});
    logger.error(`LinkedIn login error: ${message}`);
    return { success: false, message };
  }
}

// ── Step 2: Search LinkedIn Posts ────────────────────────────
async function searchJobPosts(keywords, hoursBack = 24) {
  try {
    if (!page) {
      return {
        success: false,
        posts: [],
        message: "LinkedIn session is not active. Login first and then run search.",
      };
    }

    const searchTerms = buildSearchTerms(keywords);
    const collectedPosts = [];

    logger.info(`Searching posts: "${keywords}" (last ${hoursBack}h)`);

    for (const term of searchTerms) {
      const termPosts = await searchPostsForTerm(term, hoursBack);
      collectedPosts.push(...termPosts);
    }

    const filteredPosts = dedupePosts(collectedPosts);

    logger.info(`Found ${filteredPosts.length} unique posts within ${hoursBack}h across ${searchTerms.length} term(s)`);

    // For posts without email, try to visit their profile
    const enriched = [];
    for (const post of filteredPosts.slice(0, 20)) {
      if (!post.recruiterEmail && post.profileUrl) {
        const profileEmail = await extractEmailFromProfile(post.profileUrl);
        post.recruiterEmail = profileEmail;
      }
      enriched.push(post);
    }

    return { success: true, posts: enriched };
  } catch (err) {
    const message = normalizeLinkedInBrowserError(err.message);
    logger.error(`Search error: ${message}`);
    return { success: false, posts: [], message };
  }
}

// ── Helper: Extract Email from Profile Page ───────────────────
async function extractEmailFromProfile(profileUrl) {
  try {
    const profilePage = await browser.newPage();
    await profilePage.goto(profileUrl + "overlay/contact-info/", {
      waitUntil: "domcontentloaded",
      timeout: 45000,
      referer: "https://www.linkedin.com/",
    });
    await profilePage.waitForTimeout(2000);

    const email = await profilePage.evaluate(() => {
      const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
      const text = document.body.innerText;
      const matches = text.match(emailRegex);
      return matches ? matches[0] : null;
    });

    await profilePage.close();
    return email;
  } catch {
    return null;
  }
}

// ── Close Browser ────────────────────────────────────────────
async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
    page = null;
    logger.info("Browser closed");
  }
}

module.exports = { loginLinkedIn, searchJobPosts, closeBrowser };
