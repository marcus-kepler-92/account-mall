/**
 * 用 Playwright 跑当前 Apple 登录流程（步骤 1–3）：打开页 → 等就绪 → 点登录 → 找账号框。
 * 不填真实账号密码，仅验证流程能否执行到「找到账号输入框」。
 *
 * 运行: npx tsx scripts/playwright-flow-check.ts
 *       npx tsx scripts/playwright-flow-check.ts --headless
 */

import { chromium } from "playwright";
import {
  APPLE_HOME_LOGIN_BUTTON,
  APPLE_ACCOUNT_INPUT,
  APPLE_ACCOUNT_INPUT_FALLBACK,
} from "../lib/automation/apple-selectors";
import { APPLE_ID_SIGN_IN_URL } from "../lib/automation/constants";

const AFTER_GOTO_MS = 200;
const PAGE_READY_MS = 8000;
const NAV_TIMEOUT_MS = 15000;
const STEP_TIMEOUT_MS = 8000;
const FALLBACK_IFRAME_MS = 3000;

async function main() {
  const headless = process.argv.includes("--headless");
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext();
  const page = await context.newPage();

  const log = (step: string, detail?: Record<string, unknown>) => {
    const msg = `[${new Date().toISOString()}] ${step}`;
    console.log(detail ? `${msg} ${JSON.stringify(detail)}` : msg);
  };

  try {
    // 步骤1: 打开登录页
    log("步骤1: 打开登录页", { url: APPLE_ID_SIGN_IN_URL });
    await page.goto(APPLE_ID_SIGN_IN_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await new Promise((r) => setTimeout(r, AFTER_GOTO_MS));

    const homeLoginBtn = page
      .getByRole("button", { name: /登录|Sign In/i })
      .or(page.locator(APPLE_HOME_LOGIN_BUTTON).filter({ hasText: /登录|Sign In/i }))
      .or(page.getByRole("link", { name: /登录|Sign In/i }));
    const mainAccountLocator = page
      .locator(APPLE_ACCOUNT_INPUT)
      .or(page.locator(APPLE_ACCOUNT_INPUT_FALLBACK))
      .first();

    // 步骤2: 等页面就绪
    log("步骤2: 等待页面就绪（登录入口或账号框）");
    await Promise.race([
      homeLoginBtn.first().waitFor({ state: "visible", timeout: PAGE_READY_MS }),
      mainAccountLocator.waitFor({ state: "visible", timeout: PAGE_READY_MS }),
    ]).catch(() => log("步骤2: 就绪等待超时或异常"));

    // 步骤2b: race 点击 vs 账号框已出现
    log("步骤2b: race 点击首页登录 / 账号框");
    type NavOutcome = "clicked_home" | "account_visible" | "timeout";
    const navResult: NavOutcome = await Promise.race([
      homeLoginBtn.first().click({ timeout: NAV_TIMEOUT_MS }).then(() => "clicked_home" as const),
      mainAccountLocator.waitFor({ state: "visible", timeout: NAV_TIMEOUT_MS }).then(() => "account_visible" as const),
    ]).catch(() => "timeout" as const);

    log("步骤2b 结果", { navResult, url: page.url() });

    if (navResult === "clicked_home") {
      log("步骤2a: 已点击首页登录，等账号框");
      let foundAccount = false;
      try {
        await mainAccountLocator.waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
        log("步骤3a: 在主页面找到账号框");
        foundAccount = true;
      } catch {
        const accountInFrame = (f: import("playwright").Frame) =>
          f.locator(APPLE_ACCOUNT_INPUT).or(f.locator(APPLE_ACCOUNT_INPUT_FALLBACK)).first();
        for (const frame of page.frames()) {
          if (frame === page.mainFrame()) continue;
          try {
            await accountInFrame(frame).waitFor({ state: "visible", timeout: FALLBACK_IFRAME_MS });
            log("步骤3b: 在 iframe 中找到账号框", { frameUrl: frame.url() });
            foundAccount = true;
            break;
          } catch {
            continue;
          }
        }
      }
      if (!foundAccount) {
        log("步骤3c: 未找到账号框");
        process.exitCode = 1;
      }
    } else if (navResult === "account_visible") {
      log("步骤3: 账号框已出现（无需点击）");
    } else {
      log("步骤3: race 超时，未点击到登录且未见到账号框");
      process.exitCode = 1;
    }

    log("流程检查结束", { url: page.url() });
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
