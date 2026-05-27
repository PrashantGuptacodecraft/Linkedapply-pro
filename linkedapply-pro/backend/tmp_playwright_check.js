const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: false, args:[
    '--no-sandbox','--disable-setuid-sandbox','--no-proxy-server','--disable-blink-features=AutomationControlled','--disable-features=TranslateUI','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows','--disable-popup-blocking','--disable-extensions','--disable-default-apps','--disable-sync','--disable-translate','--hide-scrollbars','--mute-audio','--no-first-run','--safebrowsing-disable-auto-update','--no-default-browser-check','--disable-dev-shm-usage']
  });
  const context = await browser.newContext({
    userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport:{ width:1280, height:800 }, locale:'en-US', timezoneId:'America/New_York',
    geolocation:{ latitude:40.7128, longitude:-74.0060 },
    extraHTTPHeaders:{ Accept:'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7','Accept-Encoding':'gzip, deflate, br','Accept-Language':'en-US,en;q=0.9','Cache-Control':'max-age=0','Sec-Ch-Ua':'"Not A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"','Sec-Ch-Ua-Mobile':'?0','Sec-Ch-Ua-Platform':'"Windows"','Sec-Fetch-Dest':'document','Sec-Fetch-Mode':'navigate','Sec-Fetch-Site':'none','Sec-Fetch-User':'?1','Upgrade-Insecure-Requests':'1'},
    ignoreHTTPSErrors:true, javaScriptEnabled:true,
  });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(45000); page.setDefaultTimeout(30000);
  try {
    console.log('goto start');
    await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
    console.log('goto ok', page.url());
    console.log('title', await page.title());
    console.log('body contains login?', (await page.textContent('body')).includes('login'));
  } catch (e) {
    console.error('goto failed', e);
  } finally {
    await page.waitForTimeout(5000);
    await browser.close();
  }
})();
