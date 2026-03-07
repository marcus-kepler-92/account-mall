export const AUTOMATION_CATEGORY = {
  APPLE: "APPLE",
} as const;

export type AutomationCategoryType =
  (typeof AUTOMATION_CATEGORY)[keyof typeof AUTOMATION_CATEGORY];

export const APPLE_PRESET_KEYS = {
  STATUS_TEST_BASIC: "status_test_basic",
  PASSWORD_CHANGE_V1: "password_change_v1",
  CHANGE_REGION_V1: "change_region_v1",
} as const;

export type ApplePresetKey =
  (typeof APPLE_PRESET_KEYS)[keyof typeof APPLE_PRESET_KEYS];

export const AUTOMATION_PRESET_TYPES = {
  STATUS_TEST: "STATUS_TEST",
  CHANGE_PASSWORD: "CHANGE_PASSWORD",
  CHANGE_REGION: "CHANGE_REGION",
} as const;

export type AutomationPresetTypeValue =
  (typeof AUTOMATION_PRESET_TYPES)[keyof typeof AUTOMATION_PRESET_TYPES];

export const AUTOMATION_TASK_STATUS = {
  PENDING: "PENDING",
  RUNNING: "RUNNING",
  SUCCESS: "SUCCESS",
  PARTIAL_SUCCESS: "PARTIAL_SUCCESS",
  FAILED: "FAILED",
} as const;

export type AutomationTaskStatusType =
  (typeof AUTOMATION_TASK_STATUS)[keyof typeof AUTOMATION_TASK_STATUS];

export const AUTOMATION_TASK_ITEM_STATUS = {
  PENDING: "PENDING",
  RUNNING: "RUNNING",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
} as const;

export type AutomationTaskItemStatusType =
  (typeof AUTOMATION_TASK_ITEM_STATUS)[keyof typeof AUTOMATION_TASK_ITEM_STATUS];

export const DEFAULT_APPLE_PRESETS = [
  {
    presetKey: APPLE_PRESET_KEYS.STATUS_TEST_BASIC,
    name: "Apple ID 状态测试",
    presetType: AUTOMATION_PRESET_TYPES.STATUS_TEST,
    adapterKey: "apple.status_test.basic",
    configJson: { timeoutMs: 90000, retries: 0 },
  },
  {
    presetKey: APPLE_PRESET_KEYS.PASSWORD_CHANGE_V1,
    name: "Apple ID 改密",
    presetType: AUTOMATION_PRESET_TYPES.CHANGE_PASSWORD,
    adapterKey: "apple.password_change.v1",
    configJson: { timeoutMs: 60000, retries: 1, passwordLength: 14 },
  },
  {
    presetKey: APPLE_PRESET_KEYS.CHANGE_REGION_V1,
    name: "Apple ID 改地区",
    presetType: AUTOMATION_PRESET_TYPES.CHANGE_REGION,
    adapterKey: "apple.change_region.v1",
    configJson: { timeoutMs: 60000, retries: 1 },
  },
] as const;

export const DESTRUCTIVE_PRESET_TYPES = [
  AUTOMATION_PRESET_TYPES.CHANGE_PASSWORD,
  AUTOMATION_PRESET_TYPES.CHANGE_REGION,
] as const;

export function isDestructivePresetType(type: string): boolean {
  return (DESTRUCTIVE_PRESET_TYPES as readonly string[]).includes(type);
}

/** 每 N 条卡密共用一个 browser context，以节省资源 */
export const PLAYWRIGHT_CONTEXT_GROUP_SIZE = 3;

/** 是否无头模式：开发环境默认有头便于调试，生产默认无头；可通过环境变量 AUTOMATION_HEADLESS 覆盖 */
export const PLAYWRIGHT_DEFAULT_HEADLESS =
  process.env.NODE_ENV === "development" ? false : true;

/** 调试模式：AUTOMATION_DEBUG=1 时放慢操作、便于肉眼观察；与有头模式配合使用 */
export const isAutomationDebug = (): boolean =>
  process.env.AUTOMATION_DEBUG === "1" || process.env.AUTOMATION_DEBUG === "true";
export const PLAYWRIGHT_DEBUG_SLOW_MO_MS = 400;

/**
 * Apple 账号登录入口 URL，用于自动化登录与状态检测。
 * 由环境变量 AUTOMATION_APPLE_LOGIN_URL 控制，未设置时默认 https://account.apple.com。
 * 访问后会由苹果重定向到 idmsa.apple.com 完成认证；建议保持使用浏览器（Playwright），不建议改为直接 HTTP 请求。
 */
export const APPLE_ID_SIGN_IN_URL =
  process.env.AUTOMATION_APPLE_LOGIN_URL ?? "https://account.apple.com";

/** 登录提交必请求的接口（响应体含 serviceErrors 数组时表示失败） */
export const APPLE_AUTH_SIGNIN_COMPLETE_URL = "idmsa.apple.com/appleauth/auth/signin/complete";
/** 已知错误码：-20755 = This Apple Account is not active.（账号未激活/锁定/停用） */
export const APPLE_SERVICE_ERROR_ACCOUNT_NOT_ACTIVE = "-20755";

export const AUTOMATION_ERROR_CODES = {
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  ACCOUNT_LOCKED: "ACCOUNT_LOCKED",
  NETWORK_ERROR: "NETWORK_ERROR",
  TIMEOUT: "TIMEOUT",
  CAPTCHA_REQUIRED: "CAPTCHA_REQUIRED",
  TWO_FA_REQUIRED: "TWO_FA_REQUIRED",
  PASSWORD_CHANGE_FAILED: "PASSWORD_CHANGE_FAILED",
  UNKNOWN: "UNKNOWN",
} as const;

export type AutomationErrorCode =
  (typeof AUTOMATION_ERROR_CODES)[keyof typeof AUTOMATION_ERROR_CODES];

export const LOG_LEVELS = {
  INFO: "INFO",
  WARN: "WARN",
  ERROR: "ERROR",
} as const;

export type LogLevel = (typeof LOG_LEVELS)[keyof typeof LOG_LEVELS];

export const LOG_STEPS = {
  TASK_START: "TASK_START",
  TASK_COMPLETE: "TASK_COMPLETE",
  ITEM_START: "ITEM_START",
  ITEM_COMPLETE: "ITEM_COMPLETE",
  ITEM_FAILED: "ITEM_FAILED",
  LOGIN_START: "LOGIN_START",
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  LOGIN_FAILED: "LOGIN_FAILED",
  CHANGE_PASSWORD_START: "CHANGE_PASSWORD_START",
  CHANGE_PASSWORD_SUCCESS: "CHANGE_PASSWORD_SUCCESS",
  CHANGE_PASSWORD_FAILED: "CHANGE_PASSWORD_FAILED",
  CHANGE_REGION_START: "CHANGE_REGION_START",
  CHANGE_REGION_SUCCESS: "CHANGE_REGION_SUCCESS",
  CHANGE_REGION_FAILED: "CHANGE_REGION_FAILED",
  STATUS_CHECK_START: "STATUS_CHECK_START",
  STATUS_CHECK_SUCCESS: "STATUS_CHECK_SUCCESS",
  STATUS_CHECK_FAILED: "STATUS_CHECK_FAILED",
} as const;

export type LogStep = (typeof LOG_STEPS)[keyof typeof LOG_STEPS];

export const RESULT_LOG_STEPS = [
  LOG_STEPS.TASK_COMPLETE,
  LOG_STEPS.ITEM_COMPLETE,
  LOG_STEPS.ITEM_FAILED,
  LOG_STEPS.LOGIN_SUCCESS,
  LOG_STEPS.LOGIN_FAILED,
  LOG_STEPS.CHANGE_PASSWORD_SUCCESS,
  LOG_STEPS.CHANGE_PASSWORD_FAILED,
  LOG_STEPS.CHANGE_REGION_SUCCESS,
  LOG_STEPS.CHANGE_REGION_FAILED,
  LOG_STEPS.STATUS_CHECK_SUCCESS,
  LOG_STEPS.STATUS_CHECK_FAILED,
] as const;
