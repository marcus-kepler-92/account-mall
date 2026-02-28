/**
 * SEO 关键词：从竞品站提炼，按重复率排序
 * 来源：accountboy.com, reegifts.com, guowaiid.com（页面标题、导航、商品名、文章标题）
 */

/** 重复率最高的核心词（三站共现 + 页面内高频） */
export const TOP_KEYWORDS = [
    "苹果ID",
    "苹果id购买",
    "Apple ID",
    "美区苹果ID",
    "苹果账号购买",
    "国外苹果ID",
    "苹果id批发",
    "苹果账号批发",
    "Apple ID购买",
    "美区apple id购买",
    "国外ID购买",
    "苹果ID账号",
    "iCloud账号",
    "独享",
    "即买即用",
    "自动发货",
    "可绑定邮箱",
    "未开通iCloud",
    "已激活iCloud",
    "App Store账号",
    "苹果礼品卡",
    "老号",
    "成品号",
] as const

/** 地区 + 品类长尾（竞品标题/商品名高频） */
export const REGION_KEYWORDS = [
    "美区",
    "美国",
    "香港",
    "日本",
    "韩国",
    "台湾",
    "新加坡",
    "英国",
    "德国",
    "马来西亚",
    "泰国",
    "越南",
    "澳大利亚",
] as const

/** 用于 meta keywords 的字符串（逗号分隔，优先高重复词） */
export const KEYWORDS_META =
    "苹果ID,苹果id购买,美区苹果ID,Apple ID,苹果账号购买,国外苹果ID,苹果id批发,苹果账号批发,独享,即买即用,自动发货,iCloud账号,App Store,苹果礼品卡"

/** 默认 SEO 标题（可被 config.siteName 覆盖） */
export const DEFAULT_SEO_TITLE = "苹果ID购买 | 美区Apple ID | 苹果账号批发 - 独享即买即用自动发货"

/** 默认 SEO 描述（可被 config.siteDescription 覆盖） */
export const DEFAULT_SEO_DESCRIPTION =
    "苹果ID购买、美区Apple ID、国外苹果ID、苹果账号批发，独享账号可绑定邮箱，即买即用自动发货。支持未开通iCloud/已激活iCloud、苹果礼品卡，安全可靠。"
