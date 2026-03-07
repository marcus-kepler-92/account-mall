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
 * Apple 改地区执行器（Playwright）
 * 先按统一流程登录，成功后进入账户地区设置并修改为目标地区
 */
export async function runAppleChangeRegion(
  ctx: RunnerContext,
  page: Page
): Promise<RunnerResult> {
  const { cardContent, presetConfig, inputConfig, log } = ctx;
  const delimiter = (inputConfig.contentDelimiter as string) ?? undefined;
  const parsed = parseCardContentWithDelimiter(cardContent, delimiter);

  if (!parsed || !parsed.account || !parsed.password) {
    await log(LOG_STEPS.CHANGE_REGION_FAILED, "无法解析卡密内容");
    return {
      success: false,
      errorCode: AUTOMATION_ERROR_CODES.INVALID_CREDENTIALS,
      errorMessage:
        "无法解析卡密内容，请检查格式或设置正确的卡密分隔符（如 ----、:、|）",
    };
  }

  const account = parsed.account;
  const password = parsed.password;
  const targetRegion = (inputConfig.targetRegion as string) || "US";
  const timeoutMs = (presetConfig.timeoutMs as number) || DEFAULT_TIMEOUT_MS;

  await log(LOG_STEPS.LOGIN_START, "开始登录验证", { account });

  try {
    const outcome = await performAppleLogin(page, account, password, log, {
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
      await log(LOG_STEPS.LOGIN_FAILED, "账号密码正确但需输入密保，无法自动改区");
      return {
        success: false,
        errorCode: AUTOMATION_ERROR_CODES.TWO_FA_REQUIRED,
        errorMessage: "账号密码正确，但需要双重认证/密保，无法自动完成改区",
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
  await log(LOG_STEPS.CHANGE_REGION_START, "开始修改地区", {
    account,
    targetRegion,
    oldRegion: parsed?.region || "未知",
  });

  try {
    const regionLink = page
      .getByRole("link", { name: /country|region|地区|国家/i })
      .first();
    await regionLink.click({ timeout: 10000 });
    await new Promise((r) => setTimeout(r, 1500));

    const regionSelect = page
      .locator("select[name*='country']")
      .or(page.locator("select[id*='country']"))
      .first();
    await regionSelect.waitFor({ state: "visible", timeout: 8000 });
    await regionSelect
      .selectOption({ value: targetRegion })
      .catch(() =>
        regionSelect.selectOption({ label: targetRegion })
      );
    await new Promise((r) => setTimeout(r, 500));
    await page
      .getByRole("button", { name: /save|update|保存|更新/i })
      .first()
      .click({ timeout: 5000 });
    await page.waitForLoadState("networkidle").catch(() => {});
  } catch {
    await log(LOG_STEPS.CHANGE_REGION_FAILED, "地区修改流程失败或页面结构变化");
    return {
      success: false,
      errorCode: AUTOMATION_ERROR_CODES.UNKNOWN,
      errorMessage: "地区修改失败，请重试",
    };
  }

  await log(LOG_STEPS.CHANGE_REGION_SUCCESS, `地区修改成功: ${targetRegion}`, {
    account,
    newRegion: targetRegion,
  });
  return {
    success: true,
    data: {
      account,
      changedAt: new Date().toISOString(),
      oldRegion: parsed?.region || "未知",
      newRegion: targetRegion,
    },
    newRegion: targetRegion,
  };
}
