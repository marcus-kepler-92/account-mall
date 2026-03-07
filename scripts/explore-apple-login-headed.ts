/**
 * 有头探索 account.apple.com 登录流程，记录每步 URL、frame、可交互元素与推荐 selector。
 * 凭证从环境变量读取：APPLE_EXPLORE_EMAIL、APPLE_EXPLORE_PASSWORD（不写入任何文件）。
 *
 * 运行（PowerShell）:
 *   $env:APPLE_EXPLORE_EMAIL="your@email"; $env:APPLE_EXPLORE_PASSWORD="pwd"; npx tsx scripts/explore-apple-login-headed.ts
 *
 * 输出: scripts/explore-apple-login-report.json（不含凭证）
 */

import { chromium } from "playwright";
import { writeFileSync } from "fs";
import { join } from "path";

const ENTRY_URL = "https://account.apple.com";
const REPORT_PATH = join(process.cwd(), "scripts", "explore-apple-login-report.json");

const GOTO_TIMEOUT_MS = 60000;
const STEP_TIMEOUT_MS = 15000;
const WAIT_AFTER_NAV_MS = 3000;
const WAIT_AFTER_CLICK_MS = 4000;

type StepRecord = {
  step: string;
  url: string;
  title?: string;
  frame: "main" | string;
  iframes?: { url: string; name?: string }[];
  buttons?: { id?: string; text: string; selectorHint: string }[];
  inputs?: { id?: string; name?: string; type: string; placeholder?: string; selectorHint: string }[];
  links?: { text: string; selectorHint: string }[];
  actionTaken?: string;
  selectorUsed?: string;
  outcome?: string;
};

async function snapshotPage(page: import("playwright").Page, frameLabel: "main" | string = "main") {
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
      const text = (el.textContent || "").trim().slice(0, 80);
      const selectorHint = id ? `#${id}` : `button:has-text("${text.slice(0, 30)}")`;
      return { id, text, selectorHint };
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

  const links = await page.evaluate(() =>
    Array.from(document.querySelectorAll("a[href]")).map((el) => {
      const text = (el.textContent || "").trim().slice(0, 80);
      return { text, selectorHint: `a:has-text("${text.slice(0, 30)}")` };
    })
  );

  return { url, title, frame: frameLabel, iframes, buttons, inputs, links };
}

async function snapshotFrame(frame: import("playwright").Frame, frameLabel: string) {
  const frameUrl = frame.url();
  const inputs = await frame.evaluate(() =>
    Array.from(document.querySelectorAll("input")).map((el) => {
      const id = (el as HTMLInputElement).id || undefined;
      const name = (el as HTMLInputElement).name || undefined;
      const type = (el as HTMLInputElement).type || "text";
      const placeholder = (el as HTMLInputElement).placeholder || undefined;
      const selectorHint = id ? `#${id}` : name ? `input[name="${name}"]` : `input[type="${type}"]`;
      return { id, name, type, placeholder, selectorHint };
    })
  );
  const buttons = await frame.evaluate(() =>
    Array.from(document.querySelectorAll("button, [role='button']")).map((el) => {
      const id = (el as HTMLElement).id || undefined;
      const text = (el.textContent || "").trim().slice(0, 80);
      const selectorHint = id ? `#${id}` : `button:has-text("${text.slice(0, 30)}")`;
      return { id, text, selectorHint };
    })
  );
  return {
    url: frameUrl,
    frame: frameLabel,
    iframes: [],
    buttons,
    inputs,
    links: [] as { text: string; selectorHint: string }[],
  };
}

async function main() {
  const email = process.env.APPLE_EXPLORE_EMAIL;
  const password = process.env.APPLE_EXPLORE_PASSWORD;
  if (!email || !password) {
    console.error("Set APPLE_EXPLORE_EMAIL and APPLE_EXPLORE_PASSWORD env vars.");
    process.exit(1);
  }

  const steps: StepRecord[] = [];
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Step 1: Open homepage
    await page.goto(ENTRY_URL, { waitUntil: "domcontentloaded", timeout: GOTO_TIMEOUT_MS });
    await page.waitForLoadState("networkidle").catch(() => {});
    await new Promise((r) => setTimeout(r, WAIT_AFTER_NAV_MS));

    const homeSnapshot = await snapshotPage(page, "main");
    steps.push({
      step: "1_homepage",
      url: homeSnapshot.url,
      title: homeSnapshot.title,
      frame: "main",
      iframes: homeSnapshot.iframes,
      buttons: homeSnapshot.buttons,
      inputs: homeSnapshot.inputs,
      links: homeSnapshot.links?.filter((l) => /登录|Sign In|sign in/i.test(l.text)),
    });

    // Step 2: Click Sign In (button or link)
    const homeLoginBtn = page
      .getByRole("button", { name: /登录|Sign In/i })
      .or(page.getByRole("link", { name: /登录|Sign In/i }));
    await homeLoginBtn.first().click({ timeout: STEP_TIMEOUT_MS });
    await new Promise((r) => setTimeout(r, WAIT_AFTER_CLICK_MS));

    steps.push({
      step: "2_after_click_sign_in",
      url: page.url(),
      frame: "main",
      actionTaken: "click Sign In button or link",
      selectorUsed: "getByRole(button|link, { name: /登录|Sign In/i })",
    });

    // Step 3: Snapshot login form page (main + iframes)
    const signInSnapshot = await snapshotPage(page, "main");
    steps.push({
      step: "3_signin_page_main",
      url: signInSnapshot.url,
      title: signInSnapshot.title,
      frame: "main",
      iframes: signInSnapshot.iframes,
      buttons: signInSnapshot.buttons,
      inputs: signInSnapshot.inputs,
      links: signInSnapshot.links,
    });

    // 优先在 idmsa iframe 内等账号框（探索结论：表单在此 iframe，主文档无）
    const IFRAME_IDMSA_WAIT_MS = 18000;
    let accountFrame: import("playwright").Frame | null = null;
    const idmsaFrame = page.frames().find((f) => f.url().includes("idmsa.apple.com"));
    if (idmsaFrame) {
      try {
        const accountInIdmsa = idmsaFrame
          .locator("#account_name_text_field")
          .or(idmsaFrame.locator("input[name*='account'], input[type='email']"))
          .first();
        await accountInIdmsa.waitFor({ state: "visible", timeout: IFRAME_IDMSA_WAIT_MS });
        accountFrame = idmsaFrame;
        const frameSnap = await snapshotFrame(idmsaFrame, "idmsa");
        steps.push({
          step: "3_signin_idmsa_iframe",
          url: frameSnap.url,
          frame: "iframe:idmsa",
          iframes: frameSnap.iframes,
          buttons: frameSnap.buttons,
          inputs: frameSnap.inputs,
          actionTaken: "waited for account input in idmsa iframe",
        });
      } catch (e) {
        steps.push({
          step: "3_signin_idmsa_iframe",
          url: page.url(),
          frame: "iframe:idmsa",
          outcome: (e as Error).message?.slice(0, 200) ?? "timeout",
        });
      }
    }
    if (!accountFrame) {
      for (const frame of page.frames()) {
        if (frame === page.mainFrame() || frame === idmsaFrame) continue;
        try {
          const frameSnap = await snapshotFrame(frame, frame.url());
          steps.push({
            step: "3_signin_page_iframe",
            url: frameSnap.url,
            frame: "iframe:" + frame.url().slice(0, 50),
            iframes: frameSnap.iframes,
            buttons: frameSnap.buttons,
            inputs: frameSnap.inputs,
          });
          const hasAccount = frameSnap.inputs?.some(
            (i) => i.id === "account_name_text_field" || i.name?.toLowerCase().includes("account")
          );
          if (hasAccount) {
            accountFrame = frame;
            break;
          }
        } catch {
          continue;
        }
      }
    }

    const target = accountFrame ?? page;
    const scopeIsFrame = !!accountFrame;
    const accountLocator = target.locator("#account_name_text_field").or(target.locator("input[name*='account'], input[type='email']")).first();
    if (!scopeIsFrame) await accountLocator.waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
    await accountLocator.fill(email);
    steps.push({
      step: "4_fill_account",
      url: page.url(),
      frame: scopeIsFrame ? "iframe" : "main",
      actionTaken: "fill account/email",
      selectorUsed: "#account_name_text_field or input[name*='account']",
    });

    const continueBtn = target.getByRole("button", { name: /继续|Continue/i }).first();
    await continueBtn.click({ timeout: STEP_TIMEOUT_MS });
    await new Promise((r) => setTimeout(r, WAIT_AFTER_CLICK_MS));

    steps.push({
      step: "5_click_continue",
      url: page.url(),
      frame: scopeIsFrame ? "iframe" : "main",
      actionTaken: "click Continue",
      selectorUsed: "getByRole(button, { name: /继续|Continue/i })",
    });

    const passwordLocator = target.locator("#password_text_field").or(target.locator("input[type='password']")).first();
    await passwordLocator.waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
    await passwordLocator.fill(password);
    const signInBtn = target.locator("#sign-in").or(target.getByRole("button", { name: /登录|Sign In/i })).first();
    await signInBtn.click({ timeout: STEP_TIMEOUT_MS });
    await new Promise((r) => setTimeout(r, 5000));

    const finalUrl = page.url();
    let outcome = "unknown";
    if (/account\.apple\.com\/$/.test(finalUrl) || /manage|home/i.test(finalUrl)) outcome = "success";
    else if (/signin|login|auth/i.test(finalUrl)) outcome = "still_on_login";
    else if (/verify|2fa|two/i.test(finalUrl)) outcome = "2fa_required";

    steps.push({
      step: "6_submit_and_result",
      url: finalUrl,
      frame: scopeIsFrame ? "iframe" : "main",
      actionTaken: "fill password, click Sign In",
      selectorUsed: "#password_text_field, #sign-in",
      outcome,
    });

    const report = {
      recordedAt: new Date().toISOString(),
      entryUrl: ENTRY_URL,
      steps,
      summary: {
        finalUrl,
        outcome,
        accountInputFrame: scopeIsFrame ? "iframe" : "main",
        recommendedSelectors: {
          homeSignIn: "getByRole('button', { name: /登录|Sign In/i }) or getByRole('link', { name: /登录|Sign In/i })",
          accountInput: "#account_name_text_field",
          accountInputFallback: "input[name*='account'], input[type='email']",
          continueButton: "getByRole('button', { name: /继续|Continue/i })",
          passwordInput: "#password_text_field",
          signInButton: "#sign-in",
          alertInfo: "#alertInfo",
          idmsError: "div.idms-error .form-message",
        },
      },
    };

    writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf-8");
    console.log("Report written to", REPORT_PATH);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    steps.push({ step: "error", url: page.url(), frame: "main", outcome: msg });
    const report = {
      recordedAt: new Date().toISOString(),
      entryUrl: ENTRY_URL,
      steps,
      summary: { error: msg },
    };
    writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf-8");
    console.error(msg);
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
