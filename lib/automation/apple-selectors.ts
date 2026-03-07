/**
 * Apple 登录页 DOM 选择器（与 account.apple.com / idmsa 流程对齐）
 * 依据有头探索脚本 scripts/explore-apple-login-headed.ts 产出 scripts/explore-apple-login-report.json
 * 参见 docs/automation-apple-login-flow.md
 * 维护：改选择器时同步 docs/automation-apple-login-best-practices.md 与 flow 文档，并跑 __tests__/lib/automation-runners.test.ts
 */

/** 首页「登录」按钮/链接，点击后进入 /sign-in；主文档内，getByRole(button|link, { name: /登录|Sign In/i }) */
export const APPLE_HOME_LOGIN_BUTTON = "button.button.button-elevated";

/** 账号输入框（主选择器）；登录表单在 idmsa iframe 内时，须在 frame 上 locator 使用 */
export const APPLE_ACCOUNT_INPUT = "#account_name_text_field";

/** 账号输入框兜底（部分区域/版本可能用 name 或 placeholder） */
export const APPLE_ACCOUNT_INPUT_FALLBACK =
  "input[name*='account'], input[placeholder*='mail'], input[placeholder*='Apple'], input[type='email']";

/** 输入账号后点击「继续」，进入密码步；在 idmsa iframe 内用 getByRole(button, { name: /继续|Continue/i }) */
export const APPLE_CONTINUE_BUTTON_LABEL = /继续|Continue/i;

/** 密码输入框；在 idmsa iframe 内时须在 frame 上 locator 使用 */
export const APPLE_PASSWORD_INPUT = "#password_text_field";

/** 提交登录按钮（表单内，输入密码后点击）；在 idmsa iframe 内时须在 frame 上 locator 使用 */
export const APPLE_SIGN_IN_BUTTON = "#sign-in";

/** 结果/提示区域：文案「此账户已锁定」时表示账号被锁定 */
export const APPLE_ALERT_INFO = "#alertInfo";

/**
 * 登录失败时必出的错误区域（存在即表示失败状态）
 * 用户提供：#sign_in_form 下 .is-error.signin-content__footer 内的 span
 */
export const APPLE_SIGNIN_ERROR_FOOTER =
  "#sign_in_form .is-error.signin-content__footer.signin-content__footer--has-content span";
export const APPLE_SIGNIN_ERROR_FOOTER_FALLBACK = "#sign_in_form .signin-content__footer.is-error span";

/** 凭证错误区域：如「请检查输入的账户信息并重试。」 */
export const APPLE_IDMS_ERROR = "div.idms-error";
export const APPLE_IDMS_ERROR_MESSAGE = "div.idms-error .form-message";

/** 错误信息兜底：Apple 可能用 role=alert 或其它 class 展示密码/凭证错误 */
export const APPLE_ERROR_FALLBACK =
  "[role='alert'], .form-message, div.idms-error, [class*='error'][class*='message'], [class*='form-message']";

/** 文案片段，用于结果判断 */
export const APPLE_ALERT_ACCOUNT_LOCKED = "此账户已锁定";
export const APPLE_MESSAGE_CHECK_CREDENTIALS = "请检查输入的账户信息并重试";

/**
 * 登录成功页（管理你的 Apple 账户）— 依据用户提供的 HTML 结构
 * 成功时：<title>管理你的 Apple 账户</title>，且存在 #ac-localnav .ac-localnav-title
 */
/** 成功页 title 需包含的片段（中/英） */
export const APPLE_SUCCESS_TITLE_REGEX = /管理你的|Manage your|Apple 账户|Apple Account/i;
/** 成功页本地导航标题（仅登录成功后出现） */
export const APPLE_SUCCESS_NAV_SELECTOR = "#ac-localnav .ac-localnav-title";
