# 关键词策略与页面映射（2026-10-21）

> 市场：中文用户（简体为主，兼顾繁体 / 港台）· 搜索引擎：Google · 转化目标：下单购买
> 代码中的关键词池见 `lib/seo-keywords.ts`；原始证据见 `docs/seo-evidence/`。

## 结论

0. **最大的问题不是关键词写法，而是几乎没有曝光。** Search Console 近 16 个月全站只有 208 次展示、17 次点击，平均排名 15.3。所以先解决收录和内容（服务端渲染描述、提交 sitemap、请求编入索引），再谈词序优化。
1. **首页**改为以「苹果ID购买」（KP 每月 1000–1万）开头。旧注释里"「苹果ID商城」是第一来源词、点击率约 25%"不成立：它在 KP 中每月只有 10–100 次搜索，在 GSC 中 16 个月共 15 次展示、3 次点击，近 3 个月只有 1 次展示。标题里保留「Apple ID商城」字样，继续兼顾这个词。
2. **各商品页**分别对应一个「{地区}Apple ID购买」交易词。目前商品页标题只是商品名（如「香港苹果商城账号 Apple ID HongKong」），**不含"购买"**。地区写法按数据选择：「美区」比「美国」高一个数量级，「台湾」比「台区」高一个数量级，港区/香港、日区/日本相当。
3. 小火箭类：独享页主打「小火箭账号购买」（KP 1000–1万），共享页主打「小火箭共享账号」（KP 1000–1万）。原先推荐的「已购小火箭Apple ID」在 KP 中没有数据，已降为副词。
4. 「美区Apple ID注册」每月 1000–1万次、同比 +900%，是最明确的教程页机会。注册、付款方式等信息型需求不要塞进商品页。

## 证据

原始数据：`docs/seo-evidence/keyword-planner-and-gsc-2026-10-21.md`、`docs/seo-evidence/autocomplete-2026-10-21.json`。

| 来源 | 观察 |
|---|---|
| Keyword Planner（所有位置，2025-10 至 2026-09） | 1000–1万：apple id购买、苹果id购买、美区apple id(购买)、美区id(购买)、美区苹果id、美区apple id注册、小火箭账号、小火箭共享账号、shadowrocket账号 |
| Keyword Planner | 100–1000：美国apple id、美区账号购买、香港apple id购买、港区apple id、日区apple id、日本苹果id、台湾apple id、海外apple id、苹果账号购买、免费apple id、美区礼品卡 |
| Keyword Planner | 10–100：苹果id商城、日本apple id购买、台区/韩区/韩国apple id、外区apple id购买、苹果礼品卡美国、临时id；无数据：临时apple id、已购小火箭id |
| Search Console（16 个月） | 共 17 个查询，展示最多的是 临时id（16）和 苹果id商城（15）；有点击的是 苹果id商城 3、苹果临时id 2、日本苹果id购买 2、日本id购买 1 |
| Search Console 网页 | 首页 78 次展示；免费号页面（新旧 URL 合计）70 次；日本页面（新旧 URL 合计）66 次。旧的带 ID 前缀的 URL 都已 308 跳到新地址 |
| Google 自动补全 | 「美区apple id」的第一个补全是「美区apple id购买」；香港、港区、日本、日区、台区、台湾都能补全出「…apple id购买」 |
| SERP「美区 / 香港 / 日本apple id购买」 | 交易型，前 10 名几乎都是小店商品页，标题模式为「XX Apple ID购买 + 独享 / 可改密 / 自动发货」 |
| SERP「美区礼品卡购买」 | 教程类页面 + SEAGM / Bitrefill 等大平台占主导，难度较高 |
| `site:voidlogins.com` | 只收录了 6 个页面 |

数据局限：这个 Ads 账号没有投放消费，KP 只给出粗略区间，而且会把近似写法合并统计（比如「美区id」和「美区apple id」可能落在同一个区间）。GSC 的量太小，只能当作方向参考。

## 页面映射与推荐值

在 **后台 → 商品 → 编辑 → 搜索引擎优化（SEO）** 中填写。标题末尾会自动追加「| 空域账号商城」。

| 商品 slug | 主关键词 | SEO 标题 | SEO 描述 |
|---|---|---|---|
| apple-id-us | 美区Apple ID购买 | 美区Apple ID购买（独享）- 美国苹果商城账号 | 美国Apple ID独享账号，美区App Store商城号，用于下载美区应用。付款后自动发货，7×24小时自助下单。本账号仅用于App下载，不适用于AI订阅。 |
| apple-id-hongkong | 香港Apple ID购买 | 香港Apple ID购买（港区独享）- 香港苹果账号 | 港区Apple ID独享账号，香港App Store商城号，用于下载港区应用。付款后自动发货，7×24小时自助下单。本账号仅用于App下载，不适用于AI订阅。 |
| apple-id-japan | 日本Apple ID购买 | 日本Apple ID购买（日区独享）- 可改密终身售后 | 日区Apple ID完全独享，可自行修改密码与邮箱，可正常下载日本区App、订阅与内购，享终身售后。付款后自动发货。 |
| apple-id-taiwan | 台湾Apple ID购买 | 台湾Apple ID购买（台区独享）- 可改密终身售后 | 台区Apple ID完全独享，可自行修改密码与邮箱，可正常下载台湾区App、订阅与内购，享终身售后。付款后自动发货。 |
| apple-id-korea | 韩国Apple ID购买 | 韩国Apple ID购买（韩区独享）- 可改密终身售后 | 韩区Apple ID完全独享，可自行修改密码与邮箱，可正常下载韩国区App、订阅与内购，享终身售后。付款后自动发货。 |
| apple-id-thailand | 泰国Apple ID购买 | 泰国Apple ID购买（泰区独享）- 可改密终身售后 | 泰区Apple ID完全独享，可自行修改密码与邮箱，可正常下载泰国区App、订阅与内购，享终身售后。付款后自动发货。 |
| apple-id-malaysia | 马来西亚Apple ID购买 | 马来西亚Apple ID购买（马区独享）- 可改密终身售后 | 马来西亚区Apple ID完全独享，可自行修改密码与邮箱，可正常下载马来西亚区App、订阅与内购，享终身售后。付款后自动发货。 |
| apple-id-england | 英国Apple ID购买 | 英国Apple ID购买（英区独享）- 可改密终身售后 | 英区Apple ID完全独享，可自行修改密码与邮箱，可正常下载英国区App、订阅与内购，享终身售后。付款后自动发货。 |
| apple-id-shadowrocket-us | 小火箭账号购买 | 小火箭账号购买（美区独享）- 已购Shadowrocket Apple ID | 美区独享Apple ID，已购买小火箭Shadowrocket，登录App Store即可直接下载，无需自行购买。适合短期使用，付款后自动发货并附登录操作指引。 |
| apple-id-shadowrocket | 小火箭共享账号 | 小火箭共享账号 - Shadowrocket共享美区Apple ID | 美区Apple ID临时共享账号，已购买小火箭Shadowrocket，登录App Store即可直接下载。账号未激活iCloud，付款后自动发货，即买即用。 |
| apple-gift-card-us | 美区礼品卡购买 | 美区礼品卡购买 - 美国Apple礼品卡 / App Store充值 | 美国Apple礼品卡，可为美区Apple ID充值，用于App Store应用、订阅、内购及Apple官网购物。人工发卡，工作时间内通常15分钟内处理。 |
| temporary-apple-id-random-region | 苹果临时ID | 苹果临时ID（共享·随机地区）- 临时Apple ID | 临时苹果ID共享号，随机地区、未激活iCloud，仅用于临时登录App Store下载应用。付款后自动发货；长期使用建议选择独享Apple ID。 |
| apple-id-free | 免费Apple ID | 免费Apple ID共享号 - 临时空白号 | 免费领取共享Apple ID临时空白号，仅用于临时登录App Store下载。共享账号请勿绑定双重认证，私自绑定导致锁机由使用者自行负责。 |

以上"可改密 / 终身售后 / 临时账号 / 不适用于AI订阅"等表述，均已于 2026-10-21 对照线上商品详情核实。

## 首页（已在代码中修改）

| 字段 | 修改前 | 修改后 |
|---|---|---|
| title | 苹果ID商城 \| 海外Apple ID购买 - 空域账号商城 | 苹果ID购买 \| 美区/港区/日区海外Apple ID商城 - 空域账号商城 |
| description | …下单后**24小时自动发货**… | 修正为「Apple ID付款后自动发货，7×24小时自助下单」；补充美国Apple礼品卡。礼品卡是人工发货，所以"自动发货"只限定在 Apple ID 上 |
| H1 | 苹果ID商城 · 海外Apple ID一站购买 | 苹果ID购买 · 海外Apple ID商城 |

## 需要在代码之外处理

1. **Vercel 环境变量 `SITE_DESCRIPTION`**：线上值是「台区, 韩区, 成品号, 手工注册, 小火箭Shadowrocket, 已激活iCloud」，这是一串堆砌的关键词。它会作为所有没有单独设置描述的页面（订单查询、协议页）的 meta description，也会写进 Organization 结构化数据。建议删除这个变量（改用代码默认值），或者改成一句通顺的介绍。
2. 部署后在 Search Console 提交 sitemap，并对首页和商品页逐个「请求编入索引」（目前只收录了 6 页）。
3. 上线约 4–8 周后重新导出 GSC 数据，对照本文档复核标题效果。

## 后续可做（未在本次范围内）

- 教程页：美区Apple ID注册（KP 1000–1万，同比 +900%，优先级最高），以及付款方式 / 充值、礼品卡使用、订阅 ChatGPT。
- 标签落地页：目前 `/?tag=` 的 canonical 指向首页，无法独立排名；如果要做「独享Apple ID」「共享Apple ID」等分类词，需要建 `/tags/[slug]` 页面。
