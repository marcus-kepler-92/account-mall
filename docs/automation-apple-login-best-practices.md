# account.apple.com 登录自动化 · 探索结论与最佳实践

基于有头探索脚本与当前实现整理的结论与推荐做法。探索报告见 [scripts/explore-apple-login-report.json](../scripts/explore-apple-login-report.json)（由 `scripts/explore-apple-login-headed.ts` 产出，凭证从环境变量读入，不写入报告）。

---

## 一、探索结论摘要

### 1. 首页 (https://account.apple.com/)

| 项目 | 结论 |
|------|------|
| 进入登录 | 有 **button: Sign In** 与 **link: Sign In**（英文；中文为「登录」），需同时支持；实现中 button 优先，link 兜底 |
| 稳定选择器 | getByRole button/link（name: 登录或Sign In），兜底 CSS `button.button-elevated` |
| 注意 | 页面 JS 渲染后才有按钮，需给足等待（当前用 race 15s） |

### 2. 登录表单页 (account.apple.com/sign-in 或 idmsa.apple.com)

| 项目 | 结论 |
|------|------|
| 表单位置 | **有头探索结论**：/sign-in 页主文档无账号/密码框，登录表单在 **idmsa iframe**（url 含 idmsa.apple.com，name 常为 aid-auth-widget）；流程优先在此 iframe 内等账号框（12s），再主文档与其它 iframe 兜底 |
| 账号框 | `#account_name_text_field`（crawl 与 idmsa 一致） |
| 密码框 | `#password_text_field` |
| 继续 | `getByRole("button", { name: /继续或Continue/i })` |
| 提交 | `#sign-in` |
| 结果/错误 | `#alertInfo`、`div.idms-error .form-message` |

### 3. 流程特点

- 首页 → 点 Sign In/登录 → 可能跳 `/sign-in` 或直接到 idmsa，表单异步出现。
- 不宜用「固定等 N 秒」或「短超时反复点」；应用 **race（按钮 vs 账号框）** + **单次 waitFor**，谁先出现用谁。

---

## 二、业界方案参考（Playwright 官方与社区）

调研来源：Playwright 官方 Auth 文档、Checkly/BrowserStack 登录自动化文章、Stack Overflow Promise.race 用法。

### 1. 成功判定

- **官方推荐**：点击登录后 **等最终 URL**，因为「登录流程可能在多次重定向中才设好 cookie」。
  ```ts
  await page.waitForURL('https://github.com/');
  // 或等成功后才出现的元素
  await expect(page.getByRole('button', { name: 'View profile and more' })).toBeVisible();
  ```
- **与本项目**：步骤 7 用 `waitForURL(非 sign-in)` 与「登录按钮消失」做 race，与「等最终 URL / 等成功态」一致。

### 2. 失败判定（密码错误等）

- **常见做法**：① 断言错误文案出现；② 断言**未**发生跳转到已登录页；③ 用固定错误 locator 读文案。
- **与本项目**：采用「仍在登录页 + 表单仍可见 → 判为登录未成功（凭证错误）」的**状态判定**，不依赖错误文案是否出现或结构变化，简单稳定。

### 3. 登录步骤与等待

- **通用模式**：Navigate → fill(username) → fill(password) → click(submit) → **waitForNavigation / waitForURL**。
- **配对等待**：用 `Promise.all([ page.waitForURL('**/dashboard'), page.getByRole('button', { name: 'Login' }).click() ])` 让等待与点击同时发生，避免漏掉导航。
- **与本项目**：线性 fill/click + 步骤 7 的 race(waitForURL, form_gone)，逻辑等价。

### 4. iframe 登录表单

- **做法**：`page.frameLocator('#id')` 或 `page.frames().find(...)` → 在 frame 内 `waitForSelector` 再 `fill`/`click`。
- **与本项目**：优先在 idmsa iframe 内 `waitFor` 账号框再操作，与「先等 iframe 内容再交互」一致。

### 5. 凭证与状态

- **共识**：凭证用环境变量，不写死在代码；可复用登录态时存 `storageState`，且将 `playwright/.auth` 加入 `.gitignore`。
- **与本项目**：探索脚本从 env 读凭证；生产 flow 由调用方传入账号密码，不落盘。

### 6. 别人对「失败判定」的具体说法

- **Stack Overflow（表单提交失败）**：不要用 `expect(error).not.toBeVisible()`，因为错误是服务端重渲染后才出现，会误判。应**等具体结果出现**：成功用例断言成功元素可见，失败用例断言**错误元素可见**（如 `expect(page.getByText("Failure")).toBeVisible()`）。
- **同一讨论**：正负用例都要有明确断言——正例「成功元素在、错误不在」，负例「错误元素在、成功不在」；若涉及导航，可再加 `toHaveURL()`。
- **OAuth/重定向**：用 `waitForURL` 等最终跳转；失败时若未发生重定向，则仍停留在登录页。

---

## 三、综合业界与探索后的最佳方案

结合「业界写法」与「本项目的实际探索（表单在 iframe、错误文案结构可能因地域/版本变化）」，推荐如下统一做法。

### 0. 成功页结构（依据用户提供的「管理你的 Apple 账户」HTML）

登录成功后页面特征（用于敲定成功状态）：

| 来源 | 特征 |
|------|------|
| **Title** | `<title>管理你的 Apple 账户</title>`（英文：Manage your Apple account） |
| **DOM** | `#ac-localnav .ac-localnav-title` 存在，且为「Apple 账户」入口 |
| **Meta** | `meta[name="omni_page"][content="Apple - My Apple Account"]` |
| **URL** | `account.apple.com` 且路径不含 sign-in/login/auth/idmsa |

流程中成功判定：**URL 符合** 或 **页面 title 符合** `APPLE_SUCCESS_TITLE_REGEX`（管理你的 / Manage your / Apple 账户 / Apple Account） 或 **成功页导航** `#ac-localnav .ac-localnav-title` 可见，三者满足其一即视为进入账号页。

### 0b. 三种业务结果（测试「能否用账号密码登录」）

| 结果 | 含义 | 返回值 |
|------|------|--------|
| **账号密码错误** | 凭证错误或账号不存在 | `success: false`, `errorCode: "INVALID_CREDENTIALS"` |
| **账号被锁定** | 错误文案含「已锁定」/ account locked | `success: false`, `errorCode: "ACCOUNT_LOCKED"` |
| **登录成功** | 进入账号页，或进入密保/2FA 页（账号密码已通过） | `success: true`；若在密保/2FA 页则带 `twoFactorRequired: true` |

状态测试（runAppleStatusTest）中：前两种为失败，第三种为成功（含「登录成功，需输入密保」时仍计为成功，并在 data 中带 `twoFactorRequired: true`）。改密/改区任务若遇到「成功但需密保」会返回 TWO_FA_REQUIRED，不继续执行后续步骤。

### 1. 成功判定（与业界一致）

- **以 URL 为准**：点击登录后 `waitForURL(离开 sign-in/login/auth)`，或等「仅登录成功后才出现的元素」。
- 本项目：步骤 7 用 **race( URL 离开登录页, 登录按钮消失 )**，任一到即视为「可能成功」，再根据最终 URL 排除 2FA 后判成功。

### 2. 流程完全以 signin/complete 接口为准

- **唯一依据**：登录提交后必请求的接口  
  `https://idmsa.apple.com/appleauth/auth/signin/complete?isRememberMeEnabled=true`  
  流程在点击「登录」后 **waitForResponse(该 URL)**，收到响应后解析 JSON，**不再依赖 DOM 错误区或 #alertInfo 判定失败**。
- **有 serviceErrors**：按 `serviceErrors[]` 逐条判断  
  - `code === "-20755"` 或 `message` 含 not active / locked / inactive / 未激活 / 已锁定 / 停用 → 返回 **ACCOUNT_LOCKED**（文案用接口 message）；  
  - 其它 → 返回 **INVALID_CREDENTIALS**（文案用接口 message）。
- **无 serviceErrors**：接口表示成功，再根据当前页 URL/title 区分「进入账号页」与「需输入密保」→ 返回 `success: true` 或 `success: true, twoFactorRequired: true`。
- **兜底**：若未在超时内收到 signin/complete 响应，则用当前 URL/成功页 DOM 做一次判定，避免网络异常时卡死。

### 2b. 失败判定（状态为主、文案为辅）

- **业界常见**：负例里**等错误元素出现**并断言其可见（依赖稳定选择器）。
- **本项目探索**：密码错误时错误文案可能在不同容器（`#alertInfo`、`div.idms-error`、`[role=alert]`）或延迟出现，单靠「等错误元素」容易漏判或超时。
- **采用方案**：
  - **主逻辑**：race 结束后若 **仍在登录页（URL 仍含 sign-in/auth）且表单仍可见**（登录按钮或账号框仍在）→ 直接判为登录未成功（凭证错误），**不依赖错误文案是否出现**。与业界「未发生重定向 = 失败」一致，且不依赖错误 DOM。
  - **辅助**：若需区分「锁定」等，再在同上状态下读 `#alertInfo` / `div.idms-error` / `[role=alert]` 等文案，仅用于区分 ACCOUNT_LOCKED 与 INVALID_CREDENTIALS。
- **密保/2FA 页**：若表单已消失且 URL 或页面文案表明进入「双重认证/密保/验证码」等步骤，视为**登录成功**（账号密码已通过），返回 `success: true, twoFactorRequired: true`，不按失败处理。

这样既满足「等具体结果状态」的业界建议，又避免因 Apple 错误 UI 多变导致的漏判。

### 3. 可选优化（加快错误场景）

- 若希望密码错误时**更快返回**（不必等 RESULT_TIMEOUT_MS 结束）：可在 race 中增加「错误元素可见」（如 `resultScope.locator('#alertInfo, div.idms-error, [role=alert]').first().waitFor({ state: 'visible' })`）。谁先到谁生效；超时后仍走「仍在登录页 + 表单仍在 → 失败」的兜底。当前实现未加此项，以逻辑简单、少依赖 DOM 为主。

---

## 四、选择器最佳实践

### 1. 多语言统一用正则

- 首页登录：正则匹配「登录」或「Sign In」
- 继续：正则匹配「继续」或「Continue」（已在 `APPLE_CONTINUE_BUTTON_LABEL`）
- 避免只写死一种语言，否则换区/换语言即失败。

### 2. 优先 role + name，再 id，再 CSS

- 推荐：`page.getByRole("button", { name: /登录|Sign In/i })`（正则）
- 有稳定 id 的表单控件用 id：`#account_name_text_field`、`#password_text_field`、`#sign-in`
- CSS 仅作兜底（如 `button.button.button-elevated`），且配合 `filter({ hasText: ... })` 避免误点。

### 3. 选择器集中维护

- 所有 Apple 登录相关选择器放在 [lib/automation/apple-selectors.ts](../lib/automation/apple-selectors.ts)，流程里只引用常量，不写魔法字符串。

### 4. 结果判定：URL + 表单状态为主，文案为辅

- **成功/失败**：以「URL 是否离开登录页」+「登录按钮/账号框是否仍可见」判定；失败不依赖错误文案。详见「三、综合业界与探索后的最佳方案」。
- **锁定/2FA**：在已判为未成功时，读 `#alertInfo`、`div.idms-error`、`APPLE_ERROR_FALLBACK` 等文案仅用于区分 ACCOUNT_LOCKED、TWO_FA_REQUIRED 与 INVALID_CREDENTIALS。

---

## 五、流程设计最佳实践

### 1. 用 race 替代串行“先 A 再 B”

- **步骤 2+3**：`Promise.race([ 点首页登录, 等账号框 ])`，谁先满足谁继续，避免“等不到按钮就永远等不到账号框”的串行超时。
- **步骤 7**：结果用 `Promise.race([ URL 离开登录域, 表单消失 ])`；超时后若仍在登录页且表单仍可见则判为登录失败（凭证错误），不依赖错误文案。详见「三、综合业界与探索后的最佳方案」。

### 2. 不轮询、不“点击探测”

- 不用短超时 `click()` 循环“试探”元素是否存在；用 `waitFor({ state: 'visible' })` 一次，超时再考虑兜底（如 iframe 试一次）。
- 避免 150ms 轮询读 `textContent()`/`isVisible()`；用 race + 一次读 DOM 即可。

### 3. 超时分层、常量收敛

- **NAV_TIMEOUT_MS**（15s）：goto、进入登录表单（race）等与导航相关的等待。
- **STEP_TIMEOUT_MS**（8s）：单步操作（点继续、等密码框、点登录、click 后等账号框）。
- **RESULT_TIMEOUT_MS**（8s）：结果 race。
- **FALLBACK_IFRAME_MS**（3s）：主页面失败后 iframe 只试一次。
- 不在流程里散落多种 2s/5s/18s 混用，便于调参和排错。

### 4. 优先 idmsa iframe，再主文档与其它 iframe 兜底

- 有头探索证实：点击首页「登录」后进入 /sign-in，主文档无表单，表单在 idmsa.apple.com 的 iframe 内。
- 流程先 `page.frames().find(f => f.url().includes('idmsa.apple.com'))`，在该 frame 内 `waitFor` 账号框（IFRAME_IDMSA_WAIT_MS 12s）；失败再主文档 STEP_TIMEOUT_MS、其它 iframe FALLBACK_IFRAME_MS。

### 5. iframe 只做一次性兜底（非 idmsa 时）

- 主页面 `waitFor` 账号框超时后，再对**第一个非 main 的 frame** 试一次 `waitFor` 账号框；不循环轮询所有 frame。

### 6. 不依赖固定 delay，依赖 auto-wait

- 除 goto 后 200ms 的短缓冲外，不写“再等 800ms”“再等 400ms”；用 `click()`/`fill()` 的 actionability（Visible、Stable、Enabled）自然等待。

---

## 六、何时重新探索 / 再分析

- Apple 改版登录页或域名（如 idmsa 路径变化）。
- 换地区/语言后出现“找不到按钮”或“找不到账号框”。
- 任务日志里同一步骤反复超时（例如总是“账号输入框未找到”）。

**做法**：用有头探索脚本或 MCP 再抓一次当前 DOM，更新选择器与流程说明。

- **有头探索**：设置环境变量 `APPLE_EXPLORE_EMAIL`、`APPLE_EXPLORE_PASSWORD` 后运行 `npx tsx scripts/explore-apple-login-headed.ts`（有头浏览器），根据 `scripts/explore-apple-login-report.json` 的 `steps`、`summary.recommendedSelectors`、`summary.findings` 调整 [apple-selectors.ts](../lib/automation/apple-selectors.ts) 和 [apple-login-flow.ts](../lib/automation/apple-login-flow.ts)。凭证仅当次使用，不写入任何文件。
- **MCP**：Cursor 里用 `cursor-ide-browser` 或 `playwright` 打开 account.apple.com → 点 Sign In → 等几秒 → snapshot，看 role/name/ref 与是否有 iframe。
- **分析脚本**：`npx tsx scripts/analyze-apple-login.ts`（有头更稳），根据 `scripts/analyze-apple-login-result.json` 的 `stages`、`recommendedSelectors` 调整选择器与流程。

---

## 七、修改流程时的自检清单

- [ ] 选择器是否支持中英文（登录/Sign In、继续/Continue）？
- [ ] 是否仍用 race 处理“首页按钮 vs 账号框”、结果用 race 而非轮询？
- [ ] 是否没有新增“短超时 + 循环”的探测逻辑？
- [ ] 超时是否只用 NAV/STEP/IFRAME_IDMSA_WAIT/RESULT/FALLBACK 等常量？
- [ ] 是否跑过 `npx jest __tests__/lib/automation-runners.test.ts`？
- [ ] 若改选择器，是否更新了 [apple-selectors.ts](../lib/automation/apple-selectors.ts) 和 [automation-apple-login-flow.md](automation-apple-login-flow.md) 的说明？

---

## 八、维护说明（由 AI/维护者执行）

按下面顺序做，可长期保持流程与文档一致、选择器与页面同步。

1. **定期或失败时重跑探索或分析**
   - **有头探索（推荐）**：设置 `APPLE_EXPLORE_EMAIL`、`APPLE_EXPLORE_PASSWORD` 后执行 `npx tsx scripts/explore-apple-login-headed.ts`，看 `scripts/explore-apple-login-report.json` 的 `steps`、`summary.findings`、`summary.recommendedSelectors`。
   - **分析脚本**：`npx tsx scripts/analyze-apple-login.ts`（有头），看 `scripts/analyze-apple-login-result.json` 的 `stages`、`recommendedSelectors`、`notes`。
   - 若与 [apple-selectors.ts](../lib/automation/apple-selectors.ts) 或流程不一致，或出现「未找到账号框」「总超时」等，则进入步骤 2。

2. **用 MCP 复现问题（可选）**
   - 在 Cursor 里用 `cursor-ide-browser` 打开 https://account.apple.com → 点 Sign In → 等几秒 → snapshot。
   - 记录当前按钮/输入框的 role、name、是否有 iframe，更新 [scripts/mcp-explore-account-apple.md](../scripts/mcp-explore-account-apple.md)。

3. **改代码**
   - 只改 [apple-selectors.ts](../lib/automation/apple-selectors.ts) 中的常量，或 [apple-login-flow.ts](../lib/automation/apple-login-flow.ts) 中的步骤/超时；不在流程里写魔法字符串。
   - 改完后跑：`npx jest __tests__/lib/automation-runners.test.ts`，全部通过再提交。

4. **同步文档**
   - 若选择器或步骤有变更，更新本文「一、探索结论摘要」和 [automation-apple-login-flow.md](automation-apple-login-flow.md) 的步骤/选择器表。
   - 勾选「七、修改流程时的自检清单」确认无遗漏。

---

## 九、参考文件

| 文件 | 用途 |
|------|------|
| 本文 | 探索结论、最佳实践、维护说明、自检清单 |
| [lib/automation/apple-login-flow.ts](../lib/automation/apple-login-flow.ts) | 登录流程实现 |
| [lib/automation/apple-selectors.ts](../lib/automation/apple-selectors.ts) | 选择器常量 |
| [docs/automation-apple-login-flow.md](automation-apple-login-flow.md) | 步骤与超时说明 |
| [scripts/explore-apple-login-report.json](../scripts/explore-apple-login-report.json) | 有头探索产出（无凭证） |
| [scripts/explore-apple-login-headed.ts](../scripts/explore-apple-login-headed.ts) | 有头探索脚本（凭证从 env 读入） |
| [scripts/analyze-apple-login.ts](../scripts/analyze-apple-login.ts) | 本地分析脚本（无登录） |
