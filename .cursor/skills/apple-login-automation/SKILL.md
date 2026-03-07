---
name: apple-login-automation
description: Encodes best practices for Apple ID login automation (account.apple.com / idmsa) in this project. Automation runs locally via Python + Botasaurus CLI; result is driven entirely by the signin/complete API response; three outcomes (invalid credentials, account locked, success with optional 2FA). Use when implementing or maintaining the local automation, debugging flows, or when the user asks for "Apple 登录自动化" / "account.apple.com 流程" / "signin/complete" / "自动化最佳实践".
---

# Apple 登录自动化 · 本地 Python（Botasaurus）+ CLI

本项目的 Apple ID 登录流程以 **signin/complete 接口** 为唯一结果依据，成功/失败/锁定均来自该接口，仅超时未收到响应时用 URL/页面兜底。自动化已从 Next/Vercel 迁出，改为 **本地 Python + Botasaurus**，通过 **CLI** 控制。

## 何时使用本 Skill

- 实现或修改本地自动化：`automation/` 下的 `apple_login_flow.py`、`runners/`、`cli.py`
- 排查登录自动化失败、误判、超时
- 新增任务类型或选择器
- 用户提到「Apple 登录」「account.apple.com」「idmsa」「signin/complete」「自动化最佳实践」

## 入口与配置

- **CLI**：`uv run apple-automation run status-test | run change-password | run change-region`，`--input` / `--output` / `--delimiter` / `--config`。
- **入口数据**：CSV 或 JSON 或每行一条卡密（支持分隔符、标签格式）；与 `lib/free-shared-card.ts` 解析逻辑一致，见 `automation/card_parser.py`。
- **环境**：`.env` 中 `AUTOMATION_APPLE_LOGIN_URL`、`AUTOMATION_TIMEOUT_MS`、`AUTOMATION_HEADLESS`、`AUTOMATION_PROXY` 等，见 `automation/config.py`。

## 核心原则：结果完全以 signin/complete 为准

| 步骤 | 做法 |
|------|------|
| 点击登录后 | 等待 signin/complete 响应（Chrome 性能 log 或 CDP Network.getResponseBody），解析 JSON |
| 收到响应 | 有 **serviceErrors** → 失败；无/空 → 成功 |
| 失败映射 | `code === "-20755"` 或 message 含 not active/locked/未激活/已锁定/停用 → **ACCOUNT_LOCKED**；其它 → **INVALID_CREDENTIALS** |
| 成功 | 再根据当前页 URL/title 区分「进入账号页」与「需输入密保」→ `success: true` 或 `twoFactorRequired: true` |
| 兜底 | 超时未收到 signin/complete 时，用当前 URL + 成功页 DOM 做一次判定 |

**常量**（`automation/config.py`）：

- `APPLE_AUTH_SIGNIN_COMPLETE_URL` = `"idmsa.apple.com/appleauth/auth/signin/complete"`
- `APPLE_SERVICE_ERROR_ACCOUNT_NOT_ACTIVE` = `"-20755"`

## 三种业务结果

| 结果 | 含义 | 返回值 |
|------|------|--------|
| 账号密码错误 | 凭证错误或账号不存在 | `success: false`, `errorCode: "INVALID_CREDENTIALS"` |
| 账号被锁定 | 接口 serviceErrors 中 -20755 或 not active/已锁定 等 | `success: false`, `errorCode: "ACCOUNT_LOCKED"` |
| 登录成功 | 无 serviceErrors；进入账号页或 2FA 页 | `success: true`；若在密保/2FA 页则 `twoFactorRequired: true` |

状态测试中前两种为失败，第三种为成功；改密/改区若「成功但需密保」则返回 TWO_FA_REQUIRED，不继续后续步骤。

## 参考

- 完整结论与业界对照： [docs/automation-apple-login-best-practices.md](../../docs/automation-apple-login-best-practices.md)
- 本地流程实现： [automation/apple_login_flow.py](../../automation/apple_login_flow.py)
- 本地运行说明： [automation/README.md](../../automation/README.md)
