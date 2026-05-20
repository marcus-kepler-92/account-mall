-- Seed AgentKnowledge with 13 production customer-service entries.
--
-- Idempotency: each row keyed by a deterministic id (kb-*); ON CONFLICT
--   (id) DO NOTHING means re-running the migration on a DB that already
--   has these rows is a no-op. Editing these contents post-deploy is
--   done via /admin/agent/knowledge UI — do NOT edit this migration.
--
-- authorId resolution: takes the first ADMIN user by createdAt. If the
--   admin seed (prisma/seed.ts) hasn't run yet, the CTE returns 0 rows
--   and all INSERTs are skipped silently — which is the desired
--   behavior for fresh DBs that haven't been seeded.

WITH first_admin AS (
    SELECT id FROM "User" WHERE role = 'ADMIN' ORDER BY "createdAt" ASC LIMIT 1
)
INSERT INTO "AgentKnowledge" (id, title, content, tags, status, "authorId", "createdAt", "updatedAt", "publishedAt")
SELECT 'kb-001',
    '共享号商品说明',
    E'共享号是多人共用的 Apple ID，价格最便宜。\n\n特性：\n- 密码是动态的：因苹果风控等原因，密码会被运营方不定期修改，最新密码会同步更新到用户的订单详情页\n- 仅可在 App Store 内登录使用，下载已购应用；不可登录 iCloud / 设置 / iMessage / FaceTime\n- 适合：能接受偶尔需要更新密码、对价格敏感的用户\n\n注意：共享号是 AUTO_FETCH 类型商品，订单详情页可自助"更换账号"（受 accountSwitchLimit 次数限制；具体规则以商品 summary 为准，可调 lookup_order 看 canSwitchAccount / switchAccountRemaining）。',
    ARRAY['商品', '共享号'],
    'PUBLISHED'::"KnowledgeStatus",
    first_admin.id,
    NOW(), NOW(), NOW()
FROM first_admin
ON CONFLICT (id) DO NOTHING;

WITH first_admin AS (SELECT id FROM "User" WHERE role = 'ADMIN' ORDER BY "createdAt" ASC LIMIT 1)
INSERT INTO "AgentKnowledge" (id, title, content, tags, status, "authorId", "createdAt", "updatedAt", "publishedAt")
SELECT 'kb-002',
    '共享号售前必须告知：绝不绑定双重认证',
    E'售前必须主动告知：使用共享号绝对不要绑定双重认证（2FA）。\n\n- 一旦绑定，账号会被强制锁定到客户自己的手机号，运营方无法解除\n- 绑定过程中如果短时间收到大量验证码（验证码轰炸），就是其他用户操作触发的，更不能确认绑定\n- 正确的应对方式见知识库"双重认证弹窗的应对"\n\n如果客户已经绑了 2FA，按知识库"共享号已绑 2FA 的处理"应对（基于 canSwitchAccount 决定是引导自助换号还是转人工）。',
    ARRAY['共享号', '售前红线'],
    'PUBLISHED'::"KnowledgeStatus",
    first_admin.id,
    NOW(), NOW(), NOW()
FROM first_admin
ON CONFLICT (id) DO NOTHING;

WITH first_admin AS (SELECT id FROM "User" WHERE role = 'ADMIN' ORDER BY "createdAt" ASC LIMIT 1)
INSERT INTO "AgentKnowledge" (id, title, content, tags, status, "authorId", "createdAt", "updatedAt", "publishedAt")
SELECT 'kb-003',
    '双重认证弹窗的应对（必须跳过 2FA）',
    E'客户登录账号过程中如出现弹窗，仅以下两种弹窗有标准答案，其他文案的弹窗一律转人工，不要推断：\n\n- 旧版本弹窗（标题"Apple ID 安全性"）→ 点【其他选项】\n- 新版本弹窗（标题"保护你的帐户"）→ 点【不要升级】\n\n绝对不要点：【继续】 / 【升级帐户安全】 / 【确认】 — 一旦点击会强制绑定双重认证。\n\n完整登录流程：必须在 AppStore 内登录（点 AppStore 右上角头像登录），不要去"设置 → Apple ID"里登录。详细图文请参考商品详情页的"苹果应用商店登录教程"。\n\n教学话术末尾请附："以上为通用建议，请确认你的弹窗文案与描述一致；如不一致请截图发给客服。"',
    ARRAY['操作教学', '高频问题', '共享号'],
    'PUBLISHED'::"KnowledgeStatus",
    first_admin.id,
    NOW(), NOW(), NOW()
FROM first_admin
ON CONFLICT (id) DO NOTHING;

WITH first_admin AS (SELECT id FROM "User" WHERE role = 'ADMIN' ORDER BY "createdAt" ASC LIMIT 1)
INSERT INTO "AgentKnowledge" (id, title, content, tags, status, "authorId", "createdAt", "updatedAt", "publishedAt")
SELECT 'kb-004',
    '共享号无法登录的标准排查',
    E'客户反馈共享号登录失败时，按以下顺序引导（先教学，不要立刻转人工）：\n\n1. 确认是否使用订单详情页里的【最新密码】 — 共享号密码会动态更新，旧密码失效是正常现象\n2. 确认是否在 AppStore 内登录（不是"设置 → Apple ID"）\n3. 登新共享号前，先在 AppStore 点头像【退出登录】退出当前账号\n4. 如遇 2FA 弹窗，按"双重认证弹窗的应对"指引跳过\n5. 等 30 秒后重新尝试登录 1-2 次（账号可能临时被风控，稍后恢复）\n\n只有当客户【复述了执行的步骤】并报告【具体的失败现象】（弹窗文字 / 错误码）后仍无法登录，才转人工。\n\n纯抱怨"还是不行"但没复述操作或描述现象 → 要求其说明具体情况，不要立刻转人工。',
    ARRAY['共享号', '操作教学', '高频问题'],
    'PUBLISHED'::"KnowledgeStatus",
    first_admin.id,
    NOW(), NOW(), NOW()
FROM first_admin
ON CONFLICT (id) DO NOTHING;

WITH first_admin AS (SELECT id FROM "User" WHERE role = 'ADMIN' ORDER BY "createdAt" ASC LIMIT 1)
INSERT INTO "AgentKnowledge" (id, title, content, tags, status, "authorId", "createdAt", "updatedAt", "publishedAt")
SELECT 'kb-005',
    '独享号商品说明',
    E'独享号是一人独占的 Apple ID，比共享号贵但稳定。\n\n卖点：\n- 固定账号、固定密码，无密码动态更新的烦恼\n- 可自行修改密码和密保邮箱\n- 不会因为多人共用被苹果风控锁定\n\n限制：\n- 不能登录 iCloud / "设置 → Apple ID"，只能在 AppStore 内登录使用\n- 购买后必须按商品描述【立即修改密码 + 修改密保邮箱】，否则账号被锁后将无法收到解锁邮件，售后需酌情处理\n- 售前必须明确告知以上限制，避免售后争议\n\n具体使用规则、改密步骤以商品 summary 为准（请用 lookup_product 拿当前商品的描述）。',
    ARRAY['商品', '独享号'],
    'PUBLISHED'::"KnowledgeStatus",
    first_admin.id,
    NOW(), NOW(), NOW()
FROM first_admin
ON CONFLICT (id) DO NOTHING;

WITH first_admin AS (SELECT id FROM "User" WHERE role = 'ADMIN' ORDER BY "createdAt" ASC LIMIT 1)
INSERT INTO "AgentKnowledge" (id, title, content, tags, status, "authorId", "createdAt", "updatedAt", "publishedAt")
SELECT 'kb-006',
    '独享号售前必须告知：不能登录 iCloud',
    E'售前必须明确告知客户：独享号【不能】登录 iCloud / "设置 → Apple ID"。\n\n- 可以做：在 AppStore 内登录、下载已购应用、可自改密码 / 密保邮箱\n- 不能做：iCloud 同步 / 查找 iPhone / iMessage / FaceTime / 备份 / iCloud 邮箱\n\n如果客户需要登录 iCloud 用全套苹果服务，独享号也满足不了，建议客户自己注册一个真实的 Apple ID。\n\n客户售后投诉"为什么不能登 iCloud" → 先引用本条说明商品页已明示此为产品设计，再询问是否仍需人工。',
    ARRAY['独享号', '售前红线'],
    'PUBLISHED'::"KnowledgeStatus",
    first_admin.id,
    NOW(), NOW(), NOW()
FROM first_admin
ON CONFLICT (id) DO NOTHING;

WITH first_admin AS (SELECT id FROM "User" WHERE role = 'ADMIN' ORDER BY "createdAt" ASC LIMIT 1)
INSERT INTO "AgentKnowledge" (id, title, content, tags, status, "authorId", "createdAt", "updatedAt", "publishedAt")
SELECT 'kb-007',
    '成品号商品说明',
    E'成品号是已经预先购买好特定付费 App 的 Apple ID（典型场景：内购了 Shadowrocket / 小火箭）。\n\n适合人群：\n- 不会自己充值 / 没有海外信用卡 / 不想折腾的客户\n- 只需要使用某个特定付费 App 的客户\n\n限制：\n- 账号绑定的内购 App 是【固定的，不能更换成其他 App】，因此原因不支持退款\n- 与独享号 / 共享号一样不能登 iCloud，只能 AppStore 内登录使用\n\n售前必须告知"绑定的 App 不可换"，避免售后争议。',
    ARRAY['商品', '成品号'],
    'PUBLISHED'::"KnowledgeStatus",
    first_admin.id,
    NOW(), NOW(), NOW()
FROM first_admin
ON CONFLICT (id) DO NOTHING;

WITH first_admin AS (SELECT id FROM "User" WHERE role = 'ADMIN' ORDER BY "createdAt" ASC LIMIT 1)
INSERT INTO "AgentKnowledge" (id, title, content, tags, status, "authorId", "createdAt", "updatedAt", "publishedAt")
SELECT 'kb-008',
    '三种账号怎么选（共享 / 独享 / 成品）',
    E'帮客户选购时的决策路径（注意中文俗称同义词：小火箭 = Shadowrocket）：\n\n1. 客户只想用某个特定付费 App（如 Shadowrocket / 小火箭）？→ 推荐【成品号】\n2. 客户能接受偶尔换密码、对价格敏感？→ 推荐【共享号】\n3. 客户嫌共享号麻烦、需要稳定不换号？→ 推荐【独享号】\n4. 客户要登 iCloud / 同步通讯录照片？→ 三种都不满足，建议自己注册真实 Apple ID\n\n升级引导话术（共享号反复换号的客户）：\n"如果不想反复更新密码，我们的独享号是固定账号，可以自己改密码邮箱，您看看是否合适。" → 用 lookup_product 拿独享号商品页 URL 给客户。\n\n禁止：不要主动列出全部商品做对比（防同行爬数据）；用户问 X 就只回 X。',
    ARRAY['商品', '选购'],
    'PUBLISHED'::"KnowledgeStatus",
    first_admin.id,
    NOW(), NOW(), NOW()
FROM first_admin
ON CONFLICT (id) DO NOTHING;

WITH first_admin AS (SELECT id FROM "User" WHERE role = 'ADMIN' ORDER BY "createdAt" ASC LIMIT 1)
INSERT INTO "AgentKnowledge" (id, title, content, tags, status, "authorId", "createdAt", "updatedAt", "publishedAt")
SELECT 'kb-009',
    '在哪里查看你的订单和最新密码',
    E'引导客户查看订单详情和卡密：\n\n1. 访问站点的【订单查询】入口（路径 /orders/lookup）\n2. 输入订单号和下单邮箱完成验证\n3. 进入订单详情页即可看到当前最新的账号 / 密码 / 操作按钮（如更换账号）\n\n注意：\n- 共享号的密码会被运营方动态更新，每次登录失败请先回此页查看最新密码再尝试\n- AI 客服不能直接告诉你账号 / 密码 / 卡密内容（这些必须通过订单查询页自助查看，需邮箱验证）\n- 如果客户忘了下单邮箱 → 转人工核实身份',
    ARRAY['操作教学', '高频问题', '订单'],
    'PUBLISHED'::"KnowledgeStatus",
    first_admin.id,
    NOW(), NOW(), NOW()
FROM first_admin
ON CONFLICT (id) DO NOTHING;

WITH first_admin AS (SELECT id FROM "User" WHERE role = 'ADMIN' ORDER BY "createdAt" ASC LIMIT 1)
INSERT INTO "AgentKnowledge" (id, title, content, tags, status, "authorId", "createdAt", "updatedAt", "publishedAt")
SELECT 'kb-010',
    '付款流程与到货时间',
    E'付款 → 收卡流程：\n\n1. 选择商品 → 填写邮箱和下单数量\n2. 跳转支付（支付宝 / 易支付）→ 完成付款\n3. 系统收到支付回调后【立即自动发卡】，邮件 + 订单详情页同步呈现\n4. 一般情况下付款后 10 秒内即可看到卡密\n\n异常情况：\n- 付款已完成但订单仍显示"待支付"：等 1-2 分钟刷新订单详情页；仍未更新 → 在订单查询页（/orders/lookup）点击"我已付款"主动触发查询\n- 仍未恢复 → 提供订单号，转人工核查\n- 收不到发货邮件：检查垃圾邮件文件夹；或直接通过订单查询页查看卡密（无需依赖邮件）',
    ARRAY['订单', '高频问题', '操作教学'],
    'PUBLISHED'::"KnowledgeStatus",
    first_admin.id,
    NOW(), NOW(), NOW()
FROM first_admin
ON CONFLICT (id) DO NOTHING;

WITH first_admin AS (SELECT id FROM "User" WHERE role = 'ADMIN' ORDER BY "createdAt" ASC LIMIT 1)
INSERT INTO "AgentKnowledge" (id, title, content, tags, status, "authorId", "createdAt", "updatedAt", "publishedAt")
SELECT 'kb-011',
    '独享号被锁定 / 收不到验证码邮件（用户未改密保邮箱）',
    E'独享号商品描述明确要求购买后【立即修改密码 + 修改密保邮箱】（改成客户自己的邮箱）。\n\n如客户没改密保邮箱，账号被苹果锁定后，解锁验证码会发到原密保邮箱（运营方持有），客户自己收不到。\n\n应对话术：\n1. 明确告知客户："根据商品描述，密保邮箱应在购买后立即改成您自己的邮箱。本次问题是因为没有按商品描述操作导致的。"\n2. 让客户加企微客服并发送订单号，由人工判断是否协助本次解锁\n3. 不要承诺一定能帮、不要承诺帮取验证码 — 这是售后人工的酌情处理范围\n4. 强调"本次如果协助处理了，下次请务必按商品描述步骤改密保邮箱"\n\n触发关键词：账号锁了 / 锁定 / 收不到验证码 / 苹果要邮箱验证 / 找回密码 / 安全验证 / 验证我的身份\n\n这类情形 → 直接 escalate_to_human，由运营酌情决定是否协助。',
    ARRAY['售后', '独享号', '用户责任'],
    'PUBLISHED'::"KnowledgeStatus",
    first_admin.id,
    NOW(), NOW(), NOW()
FROM first_admin
ON CONFLICT (id) DO NOTHING;

WITH first_admin AS (SELECT id FROM "User" WHERE role = 'ADMIN' ORDER BY "createdAt" ASC LIMIT 1)
INSERT INTO "AgentKnowledge" (id, title, content, tags, status, "authorId", "createdAt", "updatedAt", "publishedAt")
SELECT 'kb-012',
    '共享号"没退出当前账号"的标准教学',
    E'共享号客户用完后没在 AppStore 退出账号，再次登录新共享号时会冲突。\n\n标准教学步骤：\n1. 打开 AppStore → 点击右上角头像\n2. 滑到底部 → 点【退出登录】\n3. 返回 AppStore → 重新点击头像\n4. 输入新订单详情页里的【最新账号 + 最新密码】登录\n5. 如遇 2FA 弹窗，按"双重认证弹窗的应对"指引跳过\n\n注意：不要去"设置 → Apple ID"里退出 / 登录，只在 AppStore 内操作。\n\n教学末尾请附："以上为通用建议，请确认你的界面文案与描述一致。"',
    ARRAY['操作教学', '共享号', '高频问题'],
    'PUBLISHED'::"KnowledgeStatus",
    first_admin.id,
    NOW(), NOW(), NOW()
FROM first_admin
ON CONFLICT (id) DO NOTHING;

WITH first_admin AS (SELECT id FROM "User" WHERE role = 'ADMIN' ORDER BY "createdAt" ASC LIMIT 1)
INSERT INTO "AgentKnowledge" (id, title, content, tags, status, "authorId", "createdAt", "updatedAt", "publishedAt")
SELECT 'kb-013',
    '共享号已绑 2FA 的处理（区分是否可自助换号）',
    E'客户共享号已绑 2FA（验证码轰炸 / 双重认证已开启 / 账号已锁到自己手机号），处理路径基于 lookup_order 返回字段判断：\n\n**情形 A：canSwitchAccount = true 且 switchAccountRemaining > 0**\n→ 引导自助换号，不要转人工：\n"您的共享号已绑双重认证无法解除，可以自助更换账号：\n1. 访问站点订单查询页（/orders/lookup）\n2. 输入您的订单号和下单邮箱完成验证\n3. 进入订单详情页 → 点【更换账号】按钮\n4. 系统会立即分配新账号给您，您还剩 X 次换号机会"\n\n**情形 B：canSwitchAccount = false（换号次数用完 / 订单已过期 / 商品不支持换号）**\n→ 转人工，由运营酌情处理：\n"您本订单已无法自助更换账号（次数已用完 / 订单已过期 / 商品不支持）。请扫码加客服并发送您的订单号 XXX，运营会酌情协助。"\n\n**情形 C：lookup_order found:false**\n→ 让客户提供正确的订单号，不要解释原因。\n\n绝不返回带 token 的订单 URL，仅给 /orders/lookup 公开入口。',
    ARRAY['共享号', '售后', '操作教学'],
    'PUBLISHED'::"KnowledgeStatus",
    first_admin.id,
    NOW(), NOW(), NOW()
FROM first_admin
ON CONFLICT (id) DO NOTHING;
