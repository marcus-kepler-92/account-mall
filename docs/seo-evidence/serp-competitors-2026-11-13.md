# 同行 SERP 对照原始数据（2026-11-13 读取）

要验证的问题：我们和同行是不是在抢同一批关键词。

设置：google.com · `hl=zh-CN` · 已登录的桌面 Chrome（结果会受地区和个性化影响，只作方向参考）。每个词记录自然结果前 8–9 条。

## 各词前排结果

| 查询 | 前排（按顺序） | voidlogins |
|---|---|---|
| 美区apple id购买 | kxsw /buy/4、reegifts 首页、duoduo.uno /buy/4、svip.chat、github 教程、guowaiid 首页、evvcv 首页、accountboy 首页、sites.google.com 落地页 | 未出现 |
| 美区id购买 | kxsw、duoduo.uno、evvcv、guowaiid、github 教程、YouTube、ccbaohe（免费共享）、humkt、sites.google.com | 未出现 |
| 美区apple id | cqwlyxtg 首页、kxsw、apple.com、github 教程、Apple 支持、nodewu（免费共享）、duoduo.uno、X 文章 | 未出现 |
| 苹果id购买 | guowaiid、kxsw、duoduo.uno、accountboy、xiaohaoduo、apple.com.cn、sites.google.com、svip.chat、Apple 支持 | 未出现 |
| apple id购买 | guowaiid、kxsw、reegifts、accountboy、duoduo.uno、Apple 支持、xiaohaoduo、svip.chat、Apple 支持 | 未出现 |
| 香港apple id购买 | kxsw /buy/5、duoduo.uno /buy/5、appsir、guowaiid、locate.apple.com 站内搜索垃圾页、github、sites.google.com、bestbuy 站内搜索垃圾页 | 未出现 |
| 日本apple id购买 | kxsw /buy/10、appsir、duoduo.uno、sites.google.com、guowaiid、appleidi、apple.com、github、dddqq | 未出现 |
| 韩国苹果id购买 | kxsw /buy/14、duoduo.uno、sites.google.com、guowaiid、appleidi、skqwu、kxsw 首页、guowaiid /buy/79、appleid5 | 未出现 |
| 小火箭账号购买 | appsir（租用共享）、duoduo.uno（已购独享）、shadowrocket.id、evvcv、shadowrocket.work、kxsw /buy/2（已购独享）、ccbaohe（免费）、YouTube、sites.google.com | 未出现 |
| 小火箭共享账号 | fxapp.xyz、ccbaohe、YouTube、ailiao.eu、juzixp、github share-apple-id、shadowrocket.one、YouTube、X —— **全部是免费共享 / 分享类页面，没有一家卖号的** | 未出现 |

Search Console 同期给出的排名（展示次数只有 1–6 次）：韩国苹果id购买 7.2、美区账号购买 9.5、日本apple id购买 10、小火箭账号购买 14、香港苹果id购买 26.7。

## 同行页面用词（服务端 HTML）

| 页面 | title | H1 | 正文字数（约） | 结构化数据 |
|---|---|---|---|---|
| store.kxsw.org/buy/4 | Apple ID 美区账号 (独享) \| 数卡杂货铺 | 无 | 1,000 | 无 |
| store.kxsw.org/ | 首页 \| 数卡杂货铺 | 无 | 1,500 | 无；无 description |
| duoduo.uno/buy/4 | 美区Apple id \| 带密保可改密 \| 独享 - 多多有货 | 无 | 1,800 | Product、AggregateRating |
| guowaiid.com/ | 国外ID购买_苹果id批发网_苹果id购买平台 | 同 title | 5,300 | 无 |
| buy.evvcv.com/ | 首页 \| EV小卖铺 - 苹果美区ID、小火箭账号、海外账号自动发货 | EV小卖铺 | 2,700 | 无 |
| accountboy.com/ | 苹果id购买\|国外ID购买\|电报Telegram 账号购买-账号星球 | 空 | 4,100 | OnlineStore |
| reegifts.com/ | 美区Apple ID购买 \| 苹果账号批发 - 自动发货 | 苹果ID购买-美区及海外Apple ID购买平台 | 6,900 | WebSite、CollectionPage、ItemList、Product |
| xiaohaoduo.com/ | 小号多平台丨苹果ID购买丨苹果ID批发丨苹果账号购买 … | 同 title | 4,600 | Organization、WebSite |
| cqwlyxtg.com/ | 苹果ID购买 - 美区 Apple ID 独享号 自动发货 | 苹果ID购买 | 3,300 | WebSite、CollectionPage、ItemList |
| **voidlogins.com/** | 苹果ID购买 \| 美区/港区/日区海外Apple ID商城 - 空域账号商城 | 苹果ID购买 · 海外Apple ID商城 | 2,500 | Organization、WebSite |
| **voidlogins.com/products/apple-id-us** | 美区Apple ID购买（独享）- 美国苹果商城账号 \| 空域账号商城 | 美国苹果商城账号 Apple ID US（热门） | 2,500 | Product、Offer、BreadcrumbList 等 |

appsir.shop 被 Cloudflare 验证拦截，未读到页面内容。

## 同行在用、我们没写的词

- 批发类：苹果id批发、苹果账号批发、国外ID购买（guowaiid、accountboy、xiaohaoduo、reegifts 的首页主词）
- 「苹果账号购买」「苹果账号」（KP 100–1000）
- 属性词：带密保、成品号、老号、已开通 / 未开通 iCloud
- 小火箭：「已购小火箭」「租用」

## 站外信号（观察）

多个词的前 10 里反复出现同一批站外页面：`sites.google.com/view/...`「账号自动发卡平台」落地页、github 上的「XX Apple ID购买完整指南」仓库、X 文章、YouTube 视频，以及寄生在 apple.com / bestbuy.com 站内搜索页上的垃圾结果。这些是同行（或其推广方）铺的站外入口。各同行的外链数量未核实（没有 Ahrefs / Similarweb 数据）。
