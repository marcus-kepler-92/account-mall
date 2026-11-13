# Search Console + 线上页面复查原始数据（2026-11-13 读取）

对照基线：`keyword-planner-and-gsc-2026-10-21.md`。上一轮改动于 2026-10-21 上线（标题 / 描述 / 商品 SEO 字段），教程栏目与 5 篇文章于 2026-11-07 发布。

## Search Console（sc-domain:voidlogins.com，网页搜索）

**近 28 天**（2026-10-14 至 2026-11-10）对比 **此前 28 天**：

| 指标 | 近 28 天 | 此前 28 天 |
|---|---|---|
| 点击 | 3 | 1 |
| 展示 | 78 | 28 |
| 点击率 | 3.8% | 3.6% |
| 平均排名 | 12.8 | 11.6 |

### 查询（近 28 天，共 16 个；此前 28 天这些词的展示全部为 0）

| 查询 | 点击 | 展示 | 排名 |
|---|---|---|---|
| 香港苹果id购买 | 1 | 3 | 26.7 |
| 香港id购买 | 1 | 2 | 9.0 |
| 韩国苹果id购买 | 0 | 6 | 7.2 |
| 韩国苹果id | 0 | 4 | 12.8 |
| 美区账号购买 | 0 | 2 | 9.5 |
| 日本apple id购买 | 0 | 2 | 10.0 |
| apple id地区区别 | 0 | 1 | 3.0 |
| 香港账号 | 0 | 1 | 7.0 |
| 小火箭账号购买 | 0 | 1 | 14.0 |
| 美国id购买 | 0 | 1 | 16.0 |
| apple id 注册 | 0 | 1 | 20.0 |
| 苹果id商城 | 0 | 1 | 23.0 |
| 日本苹果id购买 | 0 | 1 | 30.0 |
| apple id注册 | 0 | 1 | 48.0 |
| 香港苹果id | 0 | 1 | 50.0 |
| 苹果id香港 | 0 | 1 | 62.0 |

### 网页（近 28 天）

| 网页 | 点击 | 展示 | 排名 |
|---|---|---|---|
| /products/apple-id-hongkong | 2 | 17 | 18.1 |
| /products/apple-id-korea | 1 | 27 | 9.3 |
| /products/apple-id-japan | 0 | 13 | 10.9 |
| / | 0 | 8 | 8.6 |
| /products/apple-id-us | 0 | 7 | 16.6 |
| /products/apple-id-free | 0 | 4 | 8.0 |
| /guides/shadowrocket-apple-id | 0 | 3 | 7.7 |
| /guides/us-apple-id-register | 0 | 2 | 34.0 |
| /guides/which-region-apple-id | 0 | 1 | 3.0 |
| /guides/redeem-us-apple-gift-card | 0 | 1 | 10.0 |

### 网页索引编制

已编入索引 **13**（10-21 时 `site:` 只有 6）· 未编入索引 19：

| 原因 | 网页数 |
|---|---|
| 网页会自动重定向（旧的带 ID 前缀 URL，符合预期） | 8 |
| 未找到 (404) | 3 |
| 备用网页（有适当的规范标记） | 1 |
| 已发现 - 尚未编入索引 | 7 |

「已发现 - 尚未编入索引」的 7 个网址，上次抓取日期全部为「不适用」（Google 从未抓取）：

- /products/apple-gift-card-us
- /products/apple-id-england
- /products/apple-id-malaysia
- /products/apple-id-shadowrocket
- /products/apple-id-taiwan
- /products/apple-id-thailand
- /products/temporary-apple-id-random-region

站点地图：`/sitemap.xml` 于 2026-11-07 提交并读取成功，发现 20 个网页。
核心网页指标：移动 / 桌面均为「过去 90 天数据不足」。

## 线上页面抓取（curl / fetch，2026-11-13）

| 页面 | 状态 | 首字节耗时 | 备注 |
|---|---|---|---|
| / | 200 | 2.6–4.0 s | `cache-control: private, no-store`；H2 只有「公告」「商品列表」；正文没有指向任何一篇教程的链接（只有导航里的 /guides） |
| /products/apple-id-us | 200 | 1.3 s | title / description 已是后台 SEO 字段；H1 仍是商品名「美国苹果商城账号 Apple ID US（热门）」；页面内没有指向其他商品的链接 |
| /products/apple-id-japan、-free、-shadowrocket | 200 | 0.7–1.7 s | 同上 |
| /products/apple-id-shadowrocket-us | **404** | — | 策略文档把「小火箭账号购买」映射到这个 slug，但该商品不存在 / 未上架，sitemap 里也没有 |
| /guides、/guides/us-apple-id-register | 200 | 0.6 s | Article + BreadcrumbList 结构化数据齐全 |
| /orders/lookup | 200 | — | 服务端 HTML 里没有 H1 和正文（纯客户端渲染） |
| /terms、不存在的商品 | 200 / 404 | — | 均带 `noindex`，符合预期 |
| robots.txt、sitemap.xml | 200 | — | sitemap 20 个网址，与 GSC 一致 |

sitemap 里 8 个商品的 `lastmod` 都是 2026-11-13 11:08（几秒内依次更新），是后台批量保存 / 排序带来的，不代表内容变更。
