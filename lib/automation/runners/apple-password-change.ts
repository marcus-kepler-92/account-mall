import type { Page } from "playwright";
import type { RunnerContext, RunnerResult } from "./types";
import {
  AUTOMATION_ERROR_CODES,
  LOG_STEPS,
} from "../constants";
import { parseCardContentWithDelimiter } from "@/lib/free-shared-card";
import { performAppleLogin } from "../apple-login-flow";

const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Apple 改密执行器（Playwright）
 * 先按统一流程登录，成功后进入账户安全页修改密码并回写
 */
export async function runApplePasswordChange(
  ctx: RunnerContext,
  page: Page
): Promise<RunnerResult> {
  const { cardContent, presetConfig, inputConfig, log } = ctx;
  const delimiter = (inputConfig.contentDelimiter as string) ?? undefined;
  const parsed = parseCardContentWithDelimiter(cardContent, delimiter);

  if (!parsed || !parsed.account || !parsed.password) {
    await log(LOG_STEPS.CHANGE_PASSWORD_FAILED, "无法解析卡密内容");
    return {
      success: false,
      errorCode: AUTOMATION_ERROR_CODES.INVALID_CREDENTIALS,
      errorMessage:
        "无法解析卡密内容，请检查格式或设置正确的卡密分隔符（如 ----、:、|）",
    };
  }

  const account = parsed.account;
  const oldPassword = parsed.password;
  const passwordLength = (presetConfig.passwordLength as number) || 14;
  const timeoutMs = (presetConfig.timeoutMs as number) || DEFAULT_TIMEOUT_MS;
  const newPassword = generateSecurePassword(passwordLength);

  await log(LOG_STEPS.LOGIN_START, "开始登录验证", { account });

  try {
    const outcome = await performAppleLogin(page, account, oldPassword, log, {
      timeoutMs,
      skipDelays: presetConfig.skipDelays as boolean | undefined,
    });

    if (!outcome.success) {
      await log(LOG_STEPS.LOGIN_FAILED, outcome.errorMessage);
      return {
        success: false,
        errorCode:
          outcome.errorCode === "ACCOUNT_LOCKED"
            ? AUTOMATION_ERROR_CODES.ACCOUNT_LOCKED
            : outcome.errorCode === "TWO_FA_REQUIRED"
              ? AUTOMATION_ERROR_CODES.TWO_FA_REQUIRED
              : outcome.errorCode === "TIMEOUT"
                ? AUTOMATION_ERROR_CODES.TIMEOUT
                : AUTOMATION_ERROR_CODES.INVALID_CREDENTIALS,
        errorMessage: outcome.errorMessage,
      };
    }
    if ("twoFactorRequired" in outcome && outcome.twoFactorRequired) {
      await log(LOG_STEPS.LOGIN_FAILED, "账号密码正确但需输入密保，无法自动改密");
      return {
        success: false,
        errorCode: AUTOMATION_ERROR_CODES.TWO_FA_REQUIRED,
        errorMessage: "账号密码正确，但需要双重认证/密保，无法自动完成改密",
      };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await log(LOG_STEPS.LOGIN_FAILED, message);
    return {
      success: false,
      errorCode: AUTOMATION_ERROR_CODES.INVALID_CREDENTIALS,
      errorMessage: "登录失败",
    };
  }

  await log(LOG_STEPS.LOGIN_SUCCESS, "登录验证成功");
  await log(LOG_STEPS.CHANGE_PASSWORD_START, "开始修改密码", {
    account,
    passwordLength: newPassword.length,
  });

  try {
    const passwordLink = page
      .getByRole("link", { name: /password|密码|安全/i })
      .first();
    await passwordLink.click({ timeout: 10000 });
    await new Promise((r) => setTimeout(r, 1500));

    const newPasswordInput = page
      .locator("input[type='password']")
      .nth(1)
      .or(page.locator("input[name*='new']").first());
    await newPasswordInput.waitFor({ state: "visible", timeout: 8000 });
    await newPasswordInput.fill(newPassword);
    await new Promise((r) => setTimeout(r, 500));

    const confirmInput = page
      .locator("input[type='password']")
      .nth(2)
      .or(page.locator("input[name*='confirm']").first());
    if (await confirmInput.isVisible().catch(() => false)) {
      await confirmInput.fill(newPassword);
    }
    await page
      .getByRole("button", { name: /save|change|修改|保存/i })
      .first()
      .click({ timeout: 5000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  } catch {
    await log(LOG_STEPS.CHANGE_PASSWORD_FAILED, "密码修改流程失败或页面结构变化");
    return {
      success: false,
      errorCode: AUTOMATION_ERROR_CODES.PASSWORD_CHANGE_FAILED,
      errorMessage: "密码修改失败，请重试",
    };
  }

  await log(LOG_STEPS.CHANGE_PASSWORD_SUCCESS, "密码修改成功", { account });
  return {
    success: true,
    newPassword,
    data: {
      account,
      changedAt: new Date().toISOString(),
      passwordLength: newPassword.length,
    },
  };
}

function generateSecurePassword(length: number): string {
  const lowercase = "abcdefghijkmnopqrstuvwxyz";
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const special = "!@#$%";
  const allChars = lowercase + uppercase + digits + special;
  let password = "";
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += digits[Math.floor(Math.random() * digits.length)];
  password += special[Math.floor(Math.random() * special.length)];
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}
