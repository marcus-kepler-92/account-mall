/**
 * 本地/开发用：爬取 account.apple.com 登录流程，记录 URL、iframe、input/button 选择器。
 * 不填写、不提交账号密码，仅打开页面并点击首页「登录」后抓取 DOM。
 * 运行: npx tsx scripts/crawl-apple-login.ts
 * 截图: npx tsx scripts/crawl-apple-login.ts --screenshot
 */
import { chromium } from "playwright";
import { writeFileSync } from "fs";
import { join } from "path";

const ENTRY_URL =
  process.env.AUTOMATION_APPLE_LOGIN_URL ?? "https://account.apple.com";
const RESULT_PATH = join(process.cwd(), "scripts", "crawl-apple-login-result.json");
const SCREENSHOT_PATH = join(process.cwd(), "scripts", "apple-login-form.png");

async function main() {
  const doScreenshot = process.argv.includes("--screenshot");
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const result: {
    entryUrl: string;
    afterGotoUrl: string;
    afterClickLoginUrl: string;
    iframes: { src: string }[];
    inputs: { id: string; name: string; type: string; placeholder?: string; canField?: string }[];
    buttons: { id: string; tagName: string; text: string; className?: string }[];
    alertInfoText: string | null;
    idmsErrorText: string | null;
    screenshotPath?: string;
    recordedAt: string;
  } = {
    entryUrl: ENTRY_URL,
    afterGotoUrl: "",
    afterClickLoginUrl: "",
    iframes: [],
    inputs: [],
    buttons: [],
    alertInfoText: null,
    idmsErrorText: null,
    recordedAt: new Date().toISOString(),
  };

  try {
    await page.goto(ENTRY_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 3000));
    result.afterGotoUrl = page.url();

    const homeLoginBtn = page.getByRole("button", { name: "登录" }).or(
      page.locator("button.button.button-elevated").filter({ hasText: "登录" })
    );
    await homeLoginBtn.first().click({ timeout: 15000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 5000));

    result.afterClickLoginUrl = page.url();

    const iframes = await page.frames();
    for (const frame of iframes) {
      const src = frame.url();
      if (src && src !== "about:blank") result.iframes.push({ src });
    }

    const inputs = await page.evaluate(() =>
      Array.from(document.querySelectorAll("input")).map((el) => ({
        id: el.id || "",
        name: el.name || "",
        type: el.type || "",
        placeholder: el.placeholder || undefined,
        canField: el.getAttribute("can-field") || undefined,
      }))
    );
    result.inputs = inputs;

    const buttons = await page.evaluate(() =>
      Array.from(document.querySelectorAll("button, [role='button']")).map((el) => ({
        id: el.id || "",
        tagName: el.tagName,
        text: (el.textContent || "").trim().slice(0, 80),
        className: el.className && typeof el.className === "string" ? el.className.slice(0, 120) : undefined,
      }))
    );
    result.buttons = buttons;

    const alertEl = await page.locator("#alertInfo").first().elementHandle();
    if (alertEl) {
      result.alertInfoText = (await alertEl.textContent())?.trim() ?? null;
    }

    const idmsErrorEl = await page.locator("div.idms-error .form-message").first().elementHandle();
    if (idmsErrorEl) {
      result.idmsErrorText = (await idmsErrorEl.textContent())?.trim() ?? null;
    }

    if (doScreenshot) {
      await page.screenshot({ path: SCREENSHOT_PATH, fullPage: false });
      result.screenshotPath = SCREENSHOT_PATH;
    }

    writeFileSync(RESULT_PATH, JSON.stringify(result, null, 2), "utf-8");
    console.log("Result written to", RESULT_PATH);
    if (result.screenshotPath) console.log("Screenshot:", result.screenshotPath);
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
