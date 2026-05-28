# LinkedIn Auto-Apply Debugging Guide

## Quick Reference

### ✅ Everything Works

- Job cards loading
- Forms auto-filling
- Portal applies opening
- No error messages

### ⚠️ Warning Signs & Fixes

---

## Problem 1: "Problem Loading Your Filters" Error

### What It Means

LinkedIn UI is showing an error banner but jobs might still be loading in the background.

### How to Fix It

The system now has **4-level fallback recovery**:

1. **Level 1**: Direct navigation to filtered search
   - Waits 8 seconds max
   - If this fails → goes to Level 2

2. **Level 2**: Reset to LinkedIn jobs homepage, then retry
   - Clears any stale state
   - Full 15-second wait
   - If this fails → goes to Level 3

3. **Level 3**: Try without date filter (24-hour jobs only)
   - Removes `&f_TPR=r86400` parameter
   - Sometimes LinkedIn blocks this specific filter
   - If this fails → goes to Level 4

4. **Level 4**: Try keywords only
   - No location, no date filters
   - Most permissive search
   - Falls back if all else fails

### Debug Output

Look for these logs:

```
[JobSearch] 🔍 Navigating to LinkedIn jobs search...
[JobSearch] ✔ Page loaded. Waiting for network...
[JobSearch] ✅ Jobs loaded successfully (X cards found)
```

Or if failing:

```
[JobSearch] ⚠️ Error banner detected. Attempting recovery...
[JobSearch] 🔄 Recovery Step 2: Navigating to filtered search...
[Diagnostics] Job cards found: 0
```

---

## Problem 2: No Job Cards Loading

### What It Means

The search returned 0 job cards even though results should exist.

### Root Causes

1. **LinkedIn is blocking you** (rate limiting / bot detection)
   - Solution: Wait 5 mins, try again
2. **Search parameters are wrong** (typo in keyword/location)
   - Solution: Check search logs for exact keywords

3. **Selector mismatch** (LinkedIn updated their HTML)
   - Solution: LinkedIn changes UI every few months - might need selector updates

4. **Network timeout** (slow internet or LinkedIn servers)
   - Solution: Increase timeout in code or retry

### How to Diagnose

Look for **diagnostics output** in logs:

```
[Diagnostics] ========== after navigateToFilteredJobs ==========
[Diagnostics] Current URL: https://www.linkedin.com/jobs/search/?keywords=...
[Diagnostics] Page size: 450.5 KB
[Diagnostics] Job cards found: 0
[Diagnostics] ⚠️ Error detected: problem loading your filters
```

### How to Fix

#### Option A: Wait and Retry

LinkedIn sometimes throttles rapid searches.

```bash
# Wait 5 minutes, then try again
```

#### Option B: Check Network Connection

```
[Timing] Network idle timeout after 8000ms - continuing anyway
```

This means network is slow. Check your internet speed.

#### Option C: Verify Search Parameters

Look in logs for:

```
[JobSearch] Keywords: java%20developer, Location: United States, GeoId: 103644278
```

Make sure keywords and location are correct.

#### Option D: LinkedIn May Have Updated UI

If none of the above work, the job card selectors might be outdated.

**To check:**

1. Open LinkedIn jobs search in browser
2. Right-click a job card
3. Click "Inspect"
4. Look for HTML classes/selectors
5. Compare with selectors in `backend/src/linkedin/jobSearchService.js` (lines 20-34)

If classes changed, report the new ones.

---

## Problem 3: Job Cards Found But Can't Click Them

### What It Means

System detects cards (count > 0) but clicking them fails or times out.

### Debug Output

```
[JobSearch] 📋 Total job cards loaded: 25
[JobSearch] ✗ Card click failed: Target page not found
```

### How to Fix

1. **Scroll might not be working**
   - Try increasing scroll passes: `scrollJobsPane(page, 8)` instead of 6

2. **Card might be out of viewport**
   - System tries to scroll into view, but might need more time
   - Add delay: Change `await adaptivePause(page, 400, 0.3)` to `800`

3. **LinkedIn is blocking rapid clicks**
   - Add more delay between clicks
   - System already has jitter, but you can increase base wait time

---

## Problem 4: Portal Form Not Filling

### What It Means

Auto-fill opened the form but fields aren't getting filled.

### Common Reasons

1. **Fields have different names** (company uses custom selectors)
2. **JavaScript validation blocks fill** (form has JS watching for input)
3. **File upload fails** (resume didn't actually upload)
4. **Form is still loading** (skeleton loaders not done)

### How to Fix

#### Check Log Output

```
[PortalApply] ✔ Filled First Name: input[name*='first' i]
[PortalApply] ✔ Filled Email: input[type='email']
[PortalApply] ⚠️ Resume upload may have failed - continuing anyway
```

#### If Resume Didn't Upload

Look for:

```
[PortalApply] No resume file found at: /path/to/resume.pdf
```

Make sure resume exists in `uploads/` folder.

#### If Fields Aren't Filling

The form might use custom HTML. System will try:

1. Simple fill
2. Clear then fill
3. Triple-click + paste method

If all fail, you'll see:

```
[PortalApply] DEBUG tryFill failed Company: no visible field
```

In this case, the field selector needs updating. Check the form HTML.

---

## Problem 5: Browser Crashes or Hangs

### What It Means

The Playwright browser process exited or is unresponsive.

### Check Logs For

```
Error: Browser closed
Error: Execution context was destroyed
Error: Target page not found
```

### How to Fix

1. **Restart the backend**

   ```bash
   npm start  # in backend/ folder
   ```

2. **Clear browser data**

   ```bash
   rm -rf ~/.cache/ms-playwright  # Linux/Mac
   rmdir /S %USERPROFILE%\.cache\ms-playwright  # Windows
   ```

3. **Reinstall Playwright**
   ```bash
   cd backend
   npm install
   npx playwright install chromium
   ```

---

## Enabling Verbose Logging

### To See More Details

Edit `backend/src/utils/logger.js` and set:

```javascript
const DEBUG_MODE = true; // Change to true
```

Or set environment variable:

```bash
DEBUG=linkedapply* npm start
```

### To Debug Specific Issue

Add this to `jobSearchService.js` after navigation:

```javascript
// Capture screenshot
await page.screenshot({ path: "debug-screenshot.png" });

// Get page HTML
const html = await page.content();
fs.writeFileSync("debug-page.html", html);
```

Then open `debug-page.html` in a browser to inspect the actual HTML.

---

## LinkedIn Account Issues

### Common Errors

#### "2FA/Security Check Required"

```
Error: Checkpoint required
```

LinkedIn is asking for 2-factor auth.
**Fix**: Login manually first, then try auto-apply.

#### "Rate Limit Exceeded"

```
429 Too Many Requests
```

You're searching too fast.
**Fix**: Wait 15-30 minutes between searches.

#### "Session Expired"

```
Error: You are not logged in
```

LinkedIn logged you out.
**Fix**: Login again via `/api/linkedin/login` endpoint.

---

## Performance Tips

### To Speed Up Job Search

1. **Reduce scroll passes**

   ```javascript
   await scrollJobsPane(page, 3); // Instead of 6
   ```

2. **Reduce wait timeouts**

   ```javascript
   await waitForNetworkIdle(page, { quietMs: 400, maxWaitMs: 5000 });
   ```

3. **Search with fewer keywords**
   Instead of: `java developer backend engineer`
   Try: `java developer`

### To Make It More Reliable

1. **Increase scroll passes**

   ```javascript
   await scrollJobsPane(page, 8); // Load more cards
   ```

2. **Increase waits**

   ```javascript
   await waitForNetworkIdle(page, { quietMs: 1000, maxWaitMs: 15000 });
   ```

3. **Add error recovery**
   - System already has 4 levels, but you can add more

---

## Getting Help

### When Asking for Help, Include:

1. **Full error message**

   ```
   Copy the entire error from logs
   ```

2. **Search parameters**

   ```
   Keywords: ?
   Location: ?
   ```

3. **LinkedIn error screenshot**

   ```
   What does LinkedIn show?
   ```

4. **Logs from auto-apply start to failure**

   ```
   [JobSearch] Starting...
   [JobSearch] ❌ Error at: ?
   ```

5. **LinkedIn URL you're trying to search**

### Testing a Fix

After making changes:

```bash
cd backend
npm run test:portal-apply
npm run test:gemini
```

Or run the full pipeline:

```bash
npm start  # Start server
```

Then hit the API endpoints to test.

---

## Reference: Timeout Values

Current optimized timeouts:

| Operation              | Time | Why                          |
| ---------------------- | ---- | ---------------------------- |
| DOM Load               | 30s  | LinkedIn's CDN can be slow   |
| Network Idle (initial) | 8s   | Quick initial check          |
| Network Idle (retry)   | 15s  | More time for recovery       |
| Job Card Wait          | 12s  | Cards load slowly sometimes  |
| Modal Open             | 12s  | Easy Apply modal can be slow |
| Scroll Stabilize       | 3s   | Cards load during scroll     |

If you see timeouts:

- Try increasing (slower connection / slower LinkedIn)
- Try decreasing (faster machine, good connection)

---

## Last Resort: Manual Testing

If auto-apply keeps failing:

1. **Open LinkedIn in browser**
2. **Search for jobs manually**
3. **Click on a job**
4. **Click Apply**
5. **Check browser developer tools (F12)**
6. **Look at Network tab**
7. **Check for failed requests or errors**
8. **Report what you see**

This helps identify if it's a LinkedIn issue, network issue, or code issue.
