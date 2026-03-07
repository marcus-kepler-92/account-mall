/**
 * 实地分析 account.apple.com 登录流程（用 Chromium 打开真实页面，抓取 DOM/选择器）。
 * 用于在修改自动化前确认：首页按钮、重定向后表单、iframe、输入框/按钮的当前结构。
 *
 * 运行:
 *   npx tsx scripts/analyze-apple-login.ts        # 有头，便于观察
 *   npx tsx scripts/analyze-apple-login.ts --headless   # 无头，适合 CI/接管
 *
 * 输出: scripts/analyze-apple-login-result.json
 *
 * 若已配置 Playwright MCP，也可在 Cursor 里用 MCP 打开 account.apple.com 后
 * 使用 snapshot 等工具实地查看页面结构，再据此调整 lib/automation/apple-selectors.ts 与 apple-login-flow.ts。
 */

import { chromium } from "playwright";
import { writeFileSync } from "fs";
import { join } from "path";

const ENTRY_URL = process.env.AUTOMATION_APPLE_LOGIN_URL ?? "https://account.apple.com";
const RESULT_PATH = join(process.cwd(), "scripts", "analyze-apple-login-result.json");

const WAIT_AFTER_GOTO_MS = 2000;
const WAIT_AFTER_CLICK_MS = 3000;
const CLICK_LOGIN_TIMEOUT_MS = 8000;
const GOTO_TIMEOUT_MS = 15000;
const TOTAL_SCRIPT_TIMEOUT_MS = 35000;

type StageSnapshot = {
  url: string;
  title: string;
  at: string;
  iframes: { url: string; name?: string }[];
  buttons: { tagName: string; text: string; id?: string; className?: string; selectorHint: string }[];
  inputs: { id?: string; name?: string; type: string; placeholder?: string; selectorHint: string }[];
  alertInfo: string | null;
  idmsError: string | null;
  hasAccountInput: boolean;
  hasPasswordInput: boolean;
  hasSignInButton: boolean;
};

async function snapshot(page: import("playwright").Page, stageName: string): Promise<StageSnapshot> {
  const url = page.url();
  const title = await page.title().catch(() => "");

  const iframes = await page.evaluate(() =>
    Array.from(document.querySelectorAll("iframe")).map((f) => ({
      url: (f as HTMLIFrameElement).src || "",
      name: (f as HTMLIFrameElement).name || undefined,
    }))
  );

  const buttons = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button, [role='button']")).map((el) => {
      const id = (el as HTMLElement).id || undefined;
      const className = typeof (el as HTMLElement).className === "string" ? (el as HTMLElement).className : undefined;
      const text = (el.textContent || "").trim().slice(0, 100);
      let selectorHint = id ? `#${id}` : "";
      if (!selectorHint && className) selectorHint = `button.${className.split(/\s+/).slice(0, 2).join(".")}`;
      if (!selectorHint) selectorHint = `[role="button"] or button`;
      return { tagName: el.tagName, text, id, className: className?.slice(0, 80), selectorHint };
    })
  );

  const inputs = await page.evaluate(() =>
    Array.from(document.querySelectorAll("input")).map((el) => {
      const id = (el as HTMLInputElement).id || undefined;
      const name = (el as HTMLInputElement).name || undefined;
      const type = (el as HTMLInputElement).type || "text";
      const placeholder = (el as HTMLInputElement).placeholder || undefined;
      const selectorHint = id ? `#${id}` : name ? `input[name="${name}"]` : `input[type="${type}"]`;
      return { id, name, type, placeholder, selectorHint };
    })
  );

  let alertInfo: string | null = null;
  let idmsError: string | null = null;
  try {
    alertInfo = await page.locator("#alertInfo").first().textContent().catch(() => null);
    if (alertInfo) alertInfo = alertInfo.trim();
  } catch {}
  try {
    idmsError = await page.locator("div.idms-error .form-message").first().textContent().catch(() => null);
    if (idmsError) idmsError = idmsError.trim();
  } catch {}

  const hasAccountInput = inputs.some((i) => i.id === "account_name_text_field" || i.name?.toLowerCase().includes("account"));
  const hasPasswordInput = inputs.some((i) => i.id === "password_text_field" || i.type === "password");
  const hasSignInButton = buttons.some((b) => b.id === "sign-in" || /登录|sign\s*in/i.test(b.text));

  return {
    url,
    title,
    at: stageName,
    iframes,
    buttons,
    inputs,
    alertInfo,
    idmsError,
    hasAccountInput,
    hasPasswordInput,
    hasSignInButton,
  };
}

function writeResult(
  result: {
    entryUrl: string;
    recordedAt: string;
    stages: StageSnapshot[];
    recommendedSelectors: Record<string, string>;
    notes: string[];
  },
  error?: string
) {
  if (error) result.notes.push(`error: ${error}`);
  writeFileSync(RESULT_PATH, JSON.stringify(result, null, 2), "utf-8");
  console.log("Result written to", RESULT_PATH);
}

async function runAnalysis(
  page: import("playwright").Page,
  result: {
    entryUrl: string;
    recordedAt: string;
    stages: StageSnapshot[];
    recommendedSelectors: Record<string, string>;
    notes: string[];
  }
) {
  await page.goto(ENTRY_URL, { waitUntil: "domcontentloaded", timeout: GOTO_TIMEOUT_MS });
  await new Promise((r) => setTimeout(r, WAIT_AFTER_GOTO_MS));
  result.stages.push(await snapshot(page, "after_goto"));

    const homeLoginSelectors = [
      () => page.getByRole("button", { name: /登录|Sign In/i }),
      () => page.getByRole("link", { name: /登录|Sign In/i }),
      () => page.locator("button.button.button-elevated").filter({ hasText: /登录|Sign In/i }),
      () => page.locator('button:has-text("登录")'),
      () => page.locator('button:has-text("Sign In")'),
      () => page.locator('a:has-text("Sign In")'),
      () => page.locator('a:has-text("登录")'),
    ];
  let clicked = false;
  for (const getLoc of homeLoginSelectors) {
    try {
      await getLoc().first().click({ timeout: CLICK_LOGIN_TIMEOUT_MS });
      clicked = true;
      result.notes.push("首页登录点击成功");
      break;
    } catch {
      continue;
    }
  }
  if (!clicked) result.notes.push("未点击到首页「登录」或已自动跳转。");

  await new Promise((r) => setTimeout(r, WAIT_AFTER_CLICK_MS));
  result.stages.push(await snapshot(page, "after_click_login"));

  const last = result.stages[result.stages.length - 1];
  if (last.hasAccountInput) result.recommendedSelectors.accountInput = "#account_name_text_field";
  else if (last.inputs.length > 0) result.recommendedSelectors.accountInput = last.inputs[0].selectorHint;
  if (last.hasPasswordInput) result.recommendedSelectors.passwordInput = "#password_text_field";
  else result.recommendedSelectors.passwordInput = "input[type=password]";
  if (last.hasSignInButton) result.recommendedSelectors.signInButton = "#sign-in";
  else if (last.buttons.length > 0) result.recommendedSelectors.signInButton = last.buttons.find((b) => /登录|sign\s*in/i.test(b.text))?.selectorHint ?? last.buttons[0].selectorHint;
  result.recommendedSelectors.alertInfo = "#alertInfo";
  result.recommendedSelectors.idmsError = "div.idms-error .form-message";
}

async function main() {
  const headless = process.argv.includes("--headless");
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext();
  const page = await context.newPage();

  const result: {
    entryUrl: string;
    recordedAt: string;
    stages: StageSnapshot[];
    recommendedSelectors: Record<string, string>;
    notes: string[];
  } = {
    entryUrl: ENTRY_URL,
    recordedAt: new Date().toISOString(),
    stages: [],
    recommendedSelectors: {},
    notes: [],
  };

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("script_timeout")), TOTAL_SCRIPT_TIMEOUT_MS)
  );

  try {
    await Promise.race([runAnalysis(page, result), timeoutPromise]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "script_timeout") result.notes.push("总超时，已写入当前阶段数据");
    else result.notes.push(msg);
    if (result.stages.length > 0) {
      const last = result.stages[result.stages.length - 1];
      if (last.hasAccountInput) result.recommendedSelectors.accountInput = "#account_name_text_field";
      if (last.hasPasswordInput) result.recommendedSelectors.passwordInput = "#password_text_field";
      if (last.hasSignInButton) result.recommendedSelectors.signInButton = "#sign-in";
      result.recommendedSelectors.alertInfo = "#alertInfo";
      result.recommendedSelectors.idmsError = "div.idms-error .form-message";
    }
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }

  writeResult(result);
}

main().catch((e) => {
  console.error(e);
  const fallback = {
    entryUrl: ENTRY_URL,
    recordedAt: new Date().toISOString(),
    stages: [],
    recommendedSelectors: { accountInput: "#account_name_text_field", passwordInput: "#password_text_field", signInButton: "#sign-in", alertInfo: "#alertInfo", idmsError: "div.idms-error .form-message" },
    notes: [`run failed: ${e instanceof Error ? e.message : String(e)}`],
  };
  writeResult(fallback);
  process.exit(1);
});
