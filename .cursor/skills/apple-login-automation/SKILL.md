---
name: apple-login-automation
description: Encodes best practices for Apple ID login automation (account.apple.com / idmsa) in this project. Result is driven entirely by the signin/complete API response; three outcomes (invalid credentials, account locked, success with optional 2FA). Use when implementing or maintaining Apple login flows, debugging automation, adding new automation presets, or when the user asks for "Apple 登录自动化" / "account.apple.com 流程" / "signin/complete" / "自动化最佳实践".
---

# Apple 登录自动化 · 最佳实践

本项目的 Apple ID 登录流程以 **signin/complete 接口** 为唯一结果依据，成功/失败/锁定均来自该接口，仅超时未收到响应时用 URL/页面兜底。

## 何时使用本 Skill

- 实现或修改 Apple 登录相关自动化（`lib/automation/apple-login-flow.ts`、runners、presets）
- 排查登录自动化失败、误判、超时
- 新增自动化任务类型或选择器
- 用户提到「Apple 登录」「account.apple.com」「idmsa」「signin/complete」「自动化最佳实践」

## 核心原则：结果完全以 signin/complete 为准

| 步骤 | 做法 |
|------|------|
| 点击登录后 | `page.waitForResponse(url => url.includes(APPLE_AUTH_SIGNIN_COMPLETE_URL))` 再 `signInBtn.click()`，确保能等到接口 |
| 收到响应 | 解析 JSON：有 **serviceErrors** → 失败；无/空 → 成功 |
| 失败映射 | `code === "-20755"` 或 message 含 not active/locked/未激活/已锁定/停用 → **ACCOUNT_LOCKED**；其它 → **INVALID_CREDENTIALS**，文案用接口返回的 message |
| 成功 | 再根据当前页 URL/title 区分「进入账号页」与「需输入密保」→ `success: true` 或 `success: true, twoFactorRequired: true` |
| 兜底 | 超时未收到 signin/complete 时，用当前 URL + 成功页 DOM 做一次判定，避免卡死 |

**常量**（`lib/automation/constants.ts`）：

- `APPLE_AUTH_SIGNIN_COMPLETE_URL` = `"idmsa.apple.com/appleauth/auth/signin/complete"`
- `APPLE_SERVICE_ERROR_ACCOUNT_NOT_ACTIVE` = `"-20755"`

## 三种业务结果

| 结果 | 含义 | 返回值 |
|------|------|--------|
| 账号密码错误 | 凭证错误或账号不存在 | `success: false`, `errorCode: "INVALID_CREDENTIALS"` |
| 账号被锁定 | 接口 serviceErrors 中 -20755 或 not active/已锁定 等 | `success: false`, `errorCode: "ACCOUNT_LOCKED"` |
| 登录成功 | 无 serviceErrors；进入账号页或 2FA 页 | `success: true`；若在密保/2FA 页则 `twoFactorRequired: true` |

状态测试（runAppleStatusTest）中：前两种为失败，第三种为成功；改密/改区若「成功但需密保」则返回 TWO_FA_REQUIRED，不继续后续步骤。

## 流程与选择器要点

- **入口**：`account.apple.com`，首页用 getByRole(button/link, name: 登录|Sign In) 或 `APPLE_HOME_LOGIN_BUTTON`；先 race 等「登录入口或账号框」再进入表单。
- **表单**：在 **idmsa iframe**（`page.frames().find(f => f.url().includes("idmsa.apple.com"))`）；账号框 `#account_name_text_field`，密码框 `#password_text_field`，继续 `getByRole("button", { name: /继续|Continue/i })`，提交 `#sign-in`。
- **成功页**：URL 为 account.apple.com 且非 sign-in；或 title 匹配 `APPLE_SUCCESS_TITLE_REGEX`（管理你的 / Manage your / Apple 账户 / Apple Account）；或 `#ac-localnav .ac-localnav-title` 可见。
- **2FA 页**：URL 或文案含 2fa/双重/验证/密保/trusted phone 等 → 返回 `twoFactorRequired: true`。

选择器与常量集中在 `lib/automation/apple-selectors.ts` 和 `lib/automation/constants.ts`，改选择器时同步文档并跑 `__tests__/lib/automation-runners.test.ts`。

## 禁止与推荐

- **禁止**：用 DOM 错误区或 #alertInfo 作为**主要**失败依据；用固定延时轮询代替 waitForResponse/waitFor。
- **推荐**：线性步骤 + 单次 waitFor；结果只依赖 signin/complete 的 serviceErrors；超时仅作兜底；凭证由调用方传入或 env 读入，不写死在代码。

## 参考文档与测试

- 完整结论与业界对照： [docs/automation-apple-login-best-practices.md](../../docs/automation-apple-login-best-practices.md)
- 流程实现： [lib/automation/apple-login-flow.ts](../../lib/automation/apple-login-flow.ts)
- 单测： `npx jest __tests__/lib/automation-runners.test.ts`
