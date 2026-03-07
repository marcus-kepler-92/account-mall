import type { Page } from "playwright";
import type { RunnerContext, RunnerResult } from "./types";
import { AUTOMATION_ERROR_CODES, LOG_STEPS } from "../constants";
import { parseCardContentWithDelimiter } from "@/lib/free-shared-card";
import { performAppleLogin } from "../apple-login-flow";

const DEFAULT_TIMEOUT_MS = 20000;

/**
 * Apple 状态测试执行器（Playwright）
 * 按 account.apple.com 流程：首页点「登录」→ 填账号 → 填密码 → 点「登录」→ 根据 #alertInfo / div.idms-error 等判断结果
 */
export async function runAppleStatusTest(
  ctx: RunnerContext,
  page: Page
): Promise<RunnerResult> {
  const { cardContent, presetConfig, inputConfig, log } = ctx;
  const delimiter = (inputConfig.contentDelimiter as string) ?? undefined;
  const parsed = parseCardContentWithDelimiter(cardContent, delimiter);

  if (!parsed || !parsed.account || !parsed.password) {
    await log(LOG_STEPS.STATUS_CHECK_FAILED, "无法解析卡密内容");
    return {
      success: false,
      errorCode: AUTOMATION_ERROR_CODES.INVALID_CREDENTIALS,
      errorMessage:
        "无法解析卡密内容，请检查格式或设置正确的卡密分隔符（如 ----、:、|）",
    };
  }

  const account = parsed.account;
  const password = parsed.password;
  const timeoutMs = (presetConfig.timeoutMs as number) || DEFAULT_TIMEOUT_MS;

  await log(LOG_STEPS.STATUS_CHECK_START, "开始状态检测", { account });

  try {
    const outcome = await performAppleLogin(page, account, password, log, {
      timeoutMs,
      skipDelays: presetConfig.skipDelays as boolean | undefined,
    });

    if (outcome.success) {
      const need2FA = !!("twoFactorRequired" in outcome && outcome.twoFactorRequired);
      await log(
        LOG_STEPS.STATUS_CHECK_SUCCESS,
        need2FA ? "状态检测成功，账号密码正确，需输入密保/2FA" : "状态检测成功，账号正常",
        { account, twoFactorRequired: need2FA }
      );
      return {
        success: true,
        data: {
          account,
          checkedAt: new Date().toISOString(),
          status: "active",
          twoFactorRequired: need2FA,
        },
      };
    }

    await log(LOG_STEPS.STATUS_CHECK_FAILED, outcome.errorMessage, {
      errorCode: outcome.errorCode,
    });
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
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isTimeout = /timeout|exceeded/i.test(message);
    await log(LOG_STEPS.STATUS_CHECK_FAILED, message, {
      errorCode: isTimeout ? AUTOMATION_ERROR_CODES.TIMEOUT : "UNKNOWN",
    });
    return {
      success: false,
      errorCode: isTimeout
        ? AUTOMATION_ERROR_CODES.TIMEOUT
        : AUTOMATION_ERROR_CODES.UNKNOWN,
      errorMessage: message,
    };
  }
}
