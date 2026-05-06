const path = require("path");
const { chromium } = require("playwright");
const { createApp } = require("../server");

const PORT = 3100;
const baseUrl = `http://127.0.0.1:${PORT}`;

(async () => {
  const server = createApp().listen(PORT);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const out = path.join(__dirname, "..", "public", "screens");

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(out, "home-desktop.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(out, "home-mobile.png"), fullPage: true });

  await page.setViewportSize({ width: 820, height: 1100 });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(out, "home-tablet.png"), fullPage: true });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.fill("input[name='user']", "admin");
  await page.fill("input[name='password']", "admin123");
  await page.click("#login-form button");
  await page.waitForSelector("#admin-area:not(.hidden)");
  await page.screenshot({ path: path.join(out, "admin-desktop.png"), fullPage: true });

  await page.goto(`${baseUrl}/docs.html`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(out, "docs-desktop.png"), fullPage: true });

  await browser.close();
  server.close();
})();
