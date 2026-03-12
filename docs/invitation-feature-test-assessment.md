# 邀请分销员功能 — 测试覆盖与生产就绪评估

## 一、当前覆盖情况

### 1. 已间接覆盖（未断言邀请逻辑）

| 范围 | 说明 |
|------|------|
| 可提现余额计算 | `distributor.test.ts`、`admin-distribution.test.ts` 在 mock 未提供 `invitationReward.aggregate` 时用 `?.` 得到 0，接口不报错，但**没有断言**「含邀请奖励时余额正确」。 |
| 分销员/管理员接口 | GET me、commissions、withdrawals、GET admin/distributors 仍返回 200，仅保证不崩，不验证邀请奖励数据。 |

### 2. 完全未覆盖

| 模块 | 缺失用例 |
|------|----------|
| **completePendingOrder 邀请奖励** | ① 被邀请人首单完成 → 创建 InvitationReward（inviterId、inviteeId、orderId、amount）；② 非首单 / 无 inviterId / 已有记录 / config 金额为 0 → 不创建；③ 自买不归因时仍可能发邀请奖励（与佣金独立）的边界。 |
| **POST /api/distributor/bind-inviter** | 401 未登录；400 邀请码为空/无效/邀请人已停用；400 自己邀自己；200 成功并写入 inviterId。 |
| **注册页 + inviteCode** | URL 带 inviteCode 时文案与注册成功后调用 bind-inviter 的集成（可 e2e）。 |
| **E2E 邀请全流程** | 无：从「打开邀请链接 → 注册 → 绑定 → 被邀请人首单完成 → 邀请人余额含奖励」的端到端验证。 |

### 3. 结论（评估时点）

- **逻辑覆盖**：邀请奖励发放、绑定邀请人两条核心路径**无单测/集成测**，仅靠代码审查。
- **回归保护**：可提现余额多处修改已有通用测试，但邀请奖励相关分支改动易引入回归且无测试发现。
- **生产就绪**：**未达到「可直接上生产」的测试标准**。建议补全核心单测 + bind-inviter API 测试后再上线；e2e 可选，用于关键路径兜底。

---

## 二、已补充的测试（达生产标准）

以下用例已实现，邀请功能可视为**具备上生产的测试标准**：

1. **`__tests__/lib/complete-pending-order.test.ts`**（邀请奖励）
   - 被邀请人首单完成且存在 inviterId → 创建 InvitationReward（inviterId、inviteeId、orderId、amount=5、SETTLED）。
   - 非首单（completedCount > 1）→ 不创建。
   - 分销员无 inviterId → 不创建。
   - 已存在该 invitee 的 InvitationReward → 不重复创建。
2. **`__tests__/api/distributor-bind-inviter.test.ts`**
   - 401 未登录；400  body 非法 / inviteCode 为空；400 邀请码无效或邀请人已停用；400 自己邀自己；200 成功并更新 inviterId；inviteCode trim。

**可选（未做）**：E2E 邀请全流程（邀请链接 → 注册 → 首单完成 → 邀请人余额），依赖 seed 与支付模拟，可按需补充。
