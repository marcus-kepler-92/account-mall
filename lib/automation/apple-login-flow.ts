import type { Page, Frame } from "playwright";
import type { LogStep } from "./constants";
import {
  APPLE_ID_SIGN_IN_URL,
  APPLE_AUTH_SIGNIN_COMPLETE_URL,
  APPLE_SERVICE_ERROR_ACCOUNT_NOT_ACTIVE,
  LOG_STEPS,
} from "./constants";
import {
  APPLE_HOME_LOGIN_BUTTON,
  APPLE_ACCOUNT_INPUT,
  APPLE_ACCOUNT_INPUT_FALLBACK,
  APPLE_PASSWORD_INPUT,
  APPLE_SIGN_IN_BUTTON,
  APPLE_CONTINUE_BUTTON_LABEL,
  APPLE_SUCCESS_TITLE_REGEX,
  APPLE_SUCCESS_NAV_SELECTOR,
} from "./apple-selectors";
// 维护与最佳实践见 docs/automation-apple-login-best-practices.md
// 步骤 6～7 完全以 idmsa.apple.com/appleauth/auth/signin/complete 响应为准；成功/失败/锁定均来自该接口的 serviceErrors，仅超时未收到响应时用 URL/页面兜底。

/** 登录结果：三种业务结果 — 账号密码错误 / 账号被锁定 / 登录成功（含「成功但需输入密保」） */
export type AppleLoginOutcome =
  | { success: true; twoFactorRequired?: true }
  | { success: false; errorCode: string; errorMessage: string };

type LogFn = (step: LogStep, message: string, data?: Record<string, unknown>) => Promise<void>;

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** 线性流水线超时：无轮询，每步一次 Playwright 调用 */
const NAV_TIMEOUT_MS = 15000; // goto + 页面跳转（首页登录 + 重定向）
const STEP_TIMEOUT_MS = 8000; // 各交互步骤
const RESULT_TIMEOUT_MS = 8000; // 结果检测 Promise.race
const FALLBACK_IFRAME_MS = 3000; // 非 idmsa iframe 的兜底等待
const IFRAME_IDMSA_WAIT_MS = 12000; // 点击登录后等 idmsa iframe 内账号框（探索报告：表单在此 iframe）
const AFTER_GOTO_MS = 200; // goto 后短延时，domcontentloaded 不保证 JS 渲染完成
const PAGE_READY_MS = 8000; // 等待首页「登录」或账号框出现后再做 race，避免第一次点不到

export async function performAppleLogin(
  page: Page,
  account: string,
  password: string,
  log: LogFn,
  options: { timeoutMs?: number; skipDelays?: boolean } = {}
): Promise<AppleLoginOutcome> {
  const rawTimeout = options.timeoutMs ?? 90000;
  // 至少 50s 给 goto，避免网络慢时未连上就报超时
  const gotoTimeout = Math.max(rawTimeout, 50000);
  const skipDelays = options.skipDelays ?? false;

  await log(LOG_STEPS.LOGIN_START, "步骤1: 打开登录页", { url: APPLE_ID_SIGN_IN_URL });
  try {
    await page.goto(APPLE_ID_SIGN_IN_URL, { waitUntil: "domcontentloaded", timeout: gotoTimeout });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isGotoTimeout = /timeout|exceeded|ERR_TIMED_OUT/i.test(msg) || /goto|navigat/i.test(msg);
    await log(LOG_STEPS.LOGIN_START, "步骤1 失败: 打开登录页超时或异常", { error: msg });
    const hint = /ERR_TIMED_OUT|net::/i.test(msg)
      ? "（多为网络无法访问 account.apple.com，可检查代理/防火墙或稍后重试）"
      : "";
    return {
      success: false,
      errorCode: "TIMEOUT",
      errorMessage: isGotoTimeout
        ? "打开登录页超时（网络或服务器响应过慢），请稍后重试" + hint
        : "打开登录页失败：" + msg.slice(0, 120) + hint,
    };
  }
  if (!skipDelays) await delay(AFTER_GOTO_MS);

  const homeLoginBtn = page
    .getByRole("button", { name: /登录|Sign In/i })
    .or(page.locator(APPLE_HOME_LOGIN_BUTTON).filter({ hasText: /登录|Sign In/i }))
    .or(page.getByRole("link", { name: /登录|Sign In/i }));
  const mainAccountLocator = page
    .locator(APPLE_ACCOUNT_INPUT)
    .or(page.locator(APPLE_ACCOUNT_INPUT_FALLBACK))
    .first();
  let scope: Page | Frame = page;
  let accountInput = mainAccountLocator;
  let passwordInput = page.locator(APPLE_PASSWORD_INPUT).first();
  let signInBtn = page.locator(APPLE_SIGN_IN_BUTTON).first();
  let continueBtn = page.getByRole("button", { name: APPLE_CONTINUE_BUTTON_LABEL }).first();

  // 步骤2 前：先等页面就绪（首页「登录」或账号框至少一个出现），避免第一次点不到
  await log(LOG_STEPS.LOGIN_START, "步骤2: 等待页面就绪（登录入口或账号框，最多 " + PAGE_READY_MS / 1000 + "s）");
  await Promise.race([
    homeLoginBtn.first().waitFor({ state: "visible", timeout: PAGE_READY_MS }),
    mainAccountLocator.waitFor({ state: "visible", timeout: PAGE_READY_MS }),
  ]).catch(() => {});

  // 步骤2+3：进入登录表单（race：点击首页入口 vs 账号框已出现）
  await log(LOG_STEPS.LOGIN_START, "步骤2b: 进入登录表单（race 首页按钮/链接 / 账号框，最多 " + NAV_TIMEOUT_MS / 1000 + "s）");
  type NavOutcome = "clicked_home" | "account_visible" | "timeout";
  const navResult: NavOutcome = await Promise.race([
    homeLoginBtn.first().click({ timeout: NAV_TIMEOUT_MS }).then(() => "clicked_home" as const),
    mainAccountLocator.waitFor({ state: "visible", timeout: NAV_TIMEOUT_MS }).then(() => "account_visible" as const),
  ]).catch(() => "timeout" as const);

  if (navResult === "clicked_home") {
    await log(LOG_STEPS.LOGIN_START, "步骤2a: 已点击首页登录，等账号框（探索报告：表单在 idmsa iframe，先等 iframe 内账号框）");
    const accountInFrame = (f: Frame) =>
      f.locator(APPLE_ACCOUNT_INPUT).or(f.locator(APPLE_ACCOUNT_INPUT_FALLBACK)).first();
    let foundAccount = false;
    // 优先在 idmsa iframe 内找账号框（有头探索结论：/sign-in 页主文档无表单，表单在 idmsa.apple.com iframe）
    const idmsaFrame = page.frames().find((f) => f.url().includes("idmsa.apple.com"));
    if (idmsaFrame) {
      try {
        await accountInFrame(idmsaFrame).waitFor({ state: "visible", timeout: IFRAME_IDMSA_WAIT_MS });
        scope = idmsaFrame;
        accountInput = accountInFrame(idmsaFrame);
        passwordInput = idmsaFrame.locator(APPLE_PASSWORD_INPUT).first();
        signInBtn = idmsaFrame.locator(APPLE_SIGN_IN_BUTTON).first();
        continueBtn = idmsaFrame.getByRole("button", { name: APPLE_CONTINUE_BUTTON_LABEL }).first();
        await log(LOG_STEPS.LOGIN_START, "步骤3b: 在 idmsa iframe 中找到账号框");
        foundAccount = true;
      } catch {
        // idmsa 内未等到，继续尝试主文档与其它 iframe
      }
    }
    if (!foundAccount) {
      try {
        await mainAccountLocator.waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
        await log(LOG_STEPS.LOGIN_START, "步骤3a: 在主页面找到账号框");
        foundAccount = true;
      } catch {
        for (const frame of page.frames()) {
          if (frame === page.mainFrame() || frame === idmsaFrame) continue;
          try {
            await accountInFrame(frame).waitFor({ state: "visible", timeout: FALLBACK_IFRAME_MS });
            scope = frame;
            accountInput = accountInFrame(frame);
            passwordInput = frame.locator(APPLE_PASSWORD_INPUT).first();
            signInBtn = frame.locator(APPLE_SIGN_IN_BUTTON).first();
            continueBtn = frame.getByRole("button", { name: APPLE_CONTINUE_BUTTON_LABEL }).first();
            await log(LOG_STEPS.LOGIN_START, "步骤3b: 在 iframe 中找到账号框");
            foundAccount = true;
            break;
          } catch {
            continue;
          }
        }
      }
    }
    if (!foundAccount) {
      await log(LOG_STEPS.LOGIN_START, "步骤3c: 未找到账号框，放弃");
      return { success: false, errorCode: "TIMEOUT", errorMessage: "登录表单未出现，账号输入框未找到" };
    }
  } else if (navResult === "account_visible") {
    await log(LOG_STEPS.LOGIN_START, "步骤3a: 账号框已出现（自动重定向或已在登录页）");
  } else {
    // timeout：主页面都没找到，尝试 iframe 一次性兜底
    await log(LOG_STEPS.LOGIN_START, "步骤3: race 超时，尝试 iframe 兜底");
    const frame = page.frames().find((f) => f !== page.mainFrame());
    if (frame) {
      const accountInFrame = frame
        .locator(APPLE_ACCOUNT_INPUT)
        .or(frame.locator(APPLE_ACCOUNT_INPUT_FALLBACK))
        .first();
      try {
        await accountInFrame.waitFor({ state: "visible", timeout: FALLBACK_IFRAME_MS });
        scope = frame;
        accountInput = accountInFrame;
        passwordInput = frame.locator(APPLE_PASSWORD_INPUT).first();
        signInBtn = frame.locator(APPLE_SIGN_IN_BUTTON).first();
        continueBtn = frame.getByRole("button", { name: APPLE_CONTINUE_BUTTON_LABEL }).first();
        await log(LOG_STEPS.LOGIN_START, "步骤3b: 在 iframe 中找到账号框");
      } catch {
        await log(LOG_STEPS.LOGIN_START, "步骤3c: 未找到账号框，放弃");
        return { success: false, errorCode: "TIMEOUT", errorMessage: "登录表单未出现，账号输入框未找到" };
      }
    } else {
      await log(LOG_STEPS.LOGIN_START, "步骤3c: 未找到账号框，放弃");
      return { success: false, errorCode: "TIMEOUT", errorMessage: "登录表单未出现，账号输入框未找到" };
    }
  }

  await log(LOG_STEPS.LOGIN_START, "步骤3e: 输入账号");
  await accountInput.fill(account);

  // 步骤4：点击继续
  await log(LOG_STEPS.LOGIN_START, "步骤4: 点击继续（最多 " + STEP_TIMEOUT_MS / 1000 + "s）");
  const continueOk = await continueBtn.click({ timeout: STEP_TIMEOUT_MS }).then(() => true).catch(() => false);
  if (!continueOk) {
    await log(LOG_STEPS.LOGIN_START, "步骤4b: 未点到继续，继续等密码框");
  }
  if (!skipDelays) await delay(1500);

  // 步骤5：等密码框并输入（点击继续后表单会切到密码步，多给一点时间）
  const PWD_WAIT_MS = STEP_TIMEOUT_MS * 2;
  await log(LOG_STEPS.LOGIN_START, "步骤5: 等密码框并输入（最多 " + PWD_WAIT_MS / 1000 + "s）");
  const pwdVisible = await passwordInput.waitFor({ state: "visible", timeout: PWD_WAIT_MS }).then(() => true).catch(() => false);
  if (!pwdVisible) {
    await log(LOG_STEPS.LOGIN_START, "步骤5a: 密码框未出现，放弃");
    return { success: false, errorCode: "TIMEOUT", errorMessage: "密码框未出现" };
  }
  await passwordInput.fill(password);

  const isSuccessUrl = (u: string) => {
    const s = u.toLowerCase();
    if (!/account\.apple\.com/i.test(s)) return false;
    if (/signin|login|auth\/authorize|idmsa/i.test(s)) return false;
    return true;
  };
  const isSuccessTitle = (title: string) => APPLE_SUCCESS_TITLE_REGEX.test(title);
  const isTwoFactorPage = (u: string, text: string) =>
    /2fa|two.?factor|双重|验证|security code|验证码|密保|trusted phone|trust.*device/i.test(u + text);

  const parseServiceErrors = (body: unknown): { locked: boolean; invalid: boolean; firstMessage: string } => {
    const out = { locked: false, invalid: false, firstMessage: "" };
    if (!body || typeof body !== "object" || !Array.isArray((body as { serviceErrors?: unknown }).serviceErrors)) return out;
    const arr = (body as { serviceErrors: Array<{ code?: string; message?: string }> }).serviceErrors;
    for (const err of arr) {
      const code = String(err?.code ?? "");
      const msg = String(err?.message ?? "");
      if (!out.firstMessage) out.firstMessage = msg || "登录失败";
      if (code === APPLE_SERVICE_ERROR_ACCOUNT_NOT_ACTIVE || /not active|locked|inactive|未激活|已锁定|停用/i.test(msg)) {
        out.locked = true;
      } else {
        out.invalid = true;
      }
    }
    return out;
  };

  // 步骤6：点击登录，并等待必请求接口 signin/complete 的响应（流程完全以该接口为准）
  await log(LOG_STEPS.LOGIN_START, "步骤6: 点击登录并等待 signin/complete 响应（最多 " + RESULT_TIMEOUT_MS / 1000 + "s）");
  const responsePromise = page.waitForResponse(
    (res) => res.url().includes(APPLE_AUTH_SIGNIN_COMPLETE_URL),
    { timeout: RESULT_TIMEOUT_MS }
  );
  await signInBtn.click({ timeout: STEP_TIMEOUT_MS, noWaitAfter: true });

  let signinCompleteBody: unknown = null;
  try {
    const response = await responsePromise;
    signinCompleteBody = await response.json().catch(() => null);
  } catch {
    await log(LOG_STEPS.LOGIN_START, "步骤7: 未收到 signin/complete 响应（超时或异常），按兜底逻辑判定");
  }

  const url = page.url();
  const pageTitle = await page.title().catch(() => "");
  const successNavVisible = await page.locator(APPLE_SUCCESS_NAV_SELECTOR).first().isVisible({ timeout: 500 }).catch(() => false);
  const hasSuccessPage = isSuccessUrl(url) || isSuccessTitle(pageTitle) || successNavVisible;

  if (signinCompleteBody !== null) {
    const parsed = parseServiceErrors(signinCompleteBody);
    const hasErrors = parsed.locked || parsed.invalid;
    await log(LOG_STEPS.LOGIN_START, "步骤7 判定（以 signin/complete 为准）", {
      hasServiceErrors: hasErrors,
      locked: parsed.locked,
      invalid: parsed.invalid,
      firstMessage: parsed.firstMessage.slice(0, 60),
    });
    if (parsed.locked) {
      return { success: false, errorCode: "ACCOUNT_LOCKED", errorMessage: parsed.firstMessage || "此账户已锁定" };
    }
    if (parsed.invalid) {
      return { success: false, errorCode: "INVALID_CREDENTIALS", errorMessage: parsed.firstMessage || "请检查输入的账户信息并重试" };
    }
    // 无 serviceErrors：接口表示成功，再根据当前页区分「进入账号页」与「需输入密保」
    if (isTwoFactorPage(url, pageTitle)) {
      return { success: true, twoFactorRequired: true };
    }
    if (hasSuccessPage) {
      return { success: true };
    }
    return { success: true };
  }

  // 兜底：未收到 signin/complete 时用 URL/页面状态判定
  await log(LOG_STEPS.LOGIN_START, "步骤7 兜底", { url: url.slice(0, 80), hasSuccessPage });
  if (hasSuccessPage) return { success: true };
  if (isTwoFactorPage(url, pageTitle)) return { success: true, twoFactorRequired: true };
  return { success: false, errorCode: "INVALID_CREDENTIALS", errorMessage: "登录未完成或未收到登录接口响应" };
}
