/**
 * 免费共享账号爬取（fetch + cheerio，可在 Vercel Serverless 运行）
 * 从 sourceUrl 页面解析账号列表，仅返回「状态:正常」的账号；异常等其它状态会被过滤。
 * 缓存为进程内缓存，Serverless 多实例下各实例独立，命中率视实例复用情况而定。
 */

import * as cheerio from "cheerio"
import { config } from "@/lib/config"

/** 仅领取该状态的账号，其它（如异常）过滤掉；调参请改此处或 config */
const ALLOWED_STATUS = "正常"
const DEFAULT_USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

export interface SharedAccount {
    account: string
    password: string
    region: string
    /** 状态，如「正常」（仅用于过滤，不在前端展示） */
    status: string
    /** 上次检查时间，如 2026-03-01 15:39:23 */
    lastCheckedAt?: string
    /** 装好状态，若页面有则解析 */
    installStatus?: string
}

/**
 * 从页面 HTML 中解析账号块，提取账号、密码、地区、状态等；最终仅返回状态为「正常」的账号。
 * 若目标站结构不同，可根据实际 HTML 调整选择器与正则。
 */
function parseAccountsFromHtml(html: string): SharedAccount[] {
    const $ = cheerio.load(html)
    const results: SharedAccount[] = []
    const seen = new Set<string>()

    // 状态值正则（用于解析与过滤）：状态: 正常 / 状态：异常 等
    const statusValueRe = /状态[：:]\s*([^\s\n]+)/
    // 上次检查：完整到时分秒，如 2026-03-01 15:39:23
    const lastCheckedRe = /上次检查[：:]\s*(\d{4}-\d{2}-\d{2}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?)/
    // 装好状态：装好状态: xxx 或 装好[：:]?\s*xxx
    const installStatusRe = /装好(?:状态)?[：:]\s*([^\s\n]+)/
    const accountRe = /账号[：:]\s*([^\s\n]+)|([^\s]+@[^\s]+)/
    const passwordRe = /密码[：:]\s*([^\s\n]+)/
    const regionRe = /地区[：:]\s*([^\s\n]+)|(美国|香港|日本|新加坡|台湾|韩国|英国|德国|法国)/

    function parseBlock(blockText: string): { status: string; lastCheckedAt?: string; installStatus?: string } {
        const status = extractGroup(blockText, statusValueRe)?.trim() ?? ""
        const lastCheckedAt = extractGroup(blockText, lastCheckedRe)?.trim() ?? undefined
        const installStatus = extractGroup(blockText, installStatusRe) ?? undefined
        return { status, lastCheckedAt, installStatus }
    }

    /** 仅保留状态为「正常」的账号，排除异常等 */
    function isAllowedStatus(status: string): boolean {
        return status.trim() === ALLOWED_STATUS
    }

    // 策略0：id.ali-door.top 等页面 — .card 内用 data-clipboard-text 的复制按钮
    $(".card").each((_, card) => {
        const $card = $(card)
        const text = $card.text()
        const { status, lastCheckedAt, installStatus } = parseBlock(text)
        if (!isAllowedStatus(status)) return
        const account =
            $card.find("button.copy-btn").attr("data-clipboard-text")?.trim() ||
            extractGroup(text, accountRe)
        const password = $card.find("button.copy-pass-btn").attr("data-clipboard-text")?.trim()
        const region =
            $card.find(".card-text .badge").first().text().trim() ||
            extractGroup(text, regionRe) ||
            "未知"
        if (account && password && !seen.has(account)) {
            seen.add(account)
            results.push({ account, password, region, status, lastCheckedAt, installStatus })
        }
    })

    if (results.length > 0) return results

    // 策略1：按表格行（tr）解析，仅保留状态为「正常」的行
    $("tr").each((_, tr) => {
        const $tr = $(tr)
        const text = $tr.text()
        const { status, lastCheckedAt, installStatus } = parseBlock(text)
        if (!isAllowedStatus(status)) return
        const account = extractGroup(text, accountRe)
        const password = extractGroup(text, passwordRe)
        const region = extractGroup(text, regionRe) || "未知"
        if (account && password && !seen.has(account)) {
            seen.add(account)
            results.push({ account, password, region, status, lastCheckedAt, installStatus })
        }
    })

    if (results.length > 0) return results

    // 策略2：按块级元素（常见 class 或 data 属性）找包含「正常」的块
    const blockSelectors = [
        "[class*='item']",
        "[class*='account']",
        "[class*='row']",
        "div[class*='list'] > div",
        ".list-group-item",
    ]
    for (const sel of blockSelectors) {
        $(sel).each((_, el) => {
            const $el = $(el)
            const text = $el.text()
            const { status, lastCheckedAt, installStatus } = parseBlock(text)
            if (!isAllowedStatus(status)) return
            const account = extractGroup(text, accountRe)
            const password = extractGroup(text, passwordRe)
            const region = extractGroup(text, regionRe) || "未知"
            if (account && password && !seen.has(account)) {
                seen.add(account)
                results.push({ account, password, region, status, lastCheckedAt, installStatus })
            }
        })
        if (results.length > 0) return results
    }

    // 策略3：整页按「状态:正常」分段，每段对应一个正常状态账号块（兜底）
    const segments = html.split(/状态[：:]\s*正常/).slice(1)
    for (const seg of segments) {
        const text = cheerio.load(seg).text()
        const account = extractGroup(text, accountRe)
        const password = extractGroup(text, passwordRe)
        const region = extractGroup(text, regionRe) || "未知"
        const lastCheckedAt = extractGroup(text, lastCheckedRe)?.trim() ?? undefined
        const installStatus = extractGroup(text, installStatusRe) ?? undefined
        if (account && password && !seen.has(account)) {
            seen.add(account)
            results.push({
                account,
                password,
                region,
                status: ALLOWED_STATUS,
                lastCheckedAt,
                installStatus,
            })
        }
    }

    return results
}

function extractGroup(text: string, re: RegExp): string | null {
    const m = text.match(re)
    if (!m) return null
    // 取第一个捕获组；若正则里有两个可选组（如账号或邮箱），取非空的那个
    const group = m.slice(1).find((g) => g != null && g.trim() !== "")
    return group ? group.trim() : null
}

/** 按 sourceUrl 缓存爬取结果，避免短时间重复请求目标页 */
const scrapeCache = new Map<string, { data: SharedAccount[]; expiresAt: number }>()

/**
 * 请求 sourceUrl，解析出所有「状态:正常」的账号列表。
 * 同一 URL 在配置的缓存时间内复用（见 config.freeSharedScrapeCacheTtlMs）；失败或解析不到时返回空数组。
 */
export async function scrapeSharedAccounts(sourceUrl: string): Promise<SharedAccount[]> {
    const url = sourceUrl.trim()
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
        return []
    }

    const now = Date.now()
    const cached = scrapeCache.get(url)
    if (cached && cached.expiresAt > now) {
        return cached.data
    }

    const timeoutMs = config.freeSharedScrapeTimeoutMs
    const userAgent = config.freeSharedScrapeUserAgent ?? DEFAULT_USER_AGENT
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
        const res = await fetch(url, {
            signal: controller.signal,
            headers: {
                "User-Agent": userAgent,
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            },
        })
        clearTimeout(timeoutId)

        if (!res.ok) return []
        const html = await res.text()
        const data = parseAccountsFromHtml(html)
        scrapeCache.set(url, { data, expiresAt: now + config.freeSharedScrapeCacheTtlMs })
        return data
    } catch {
        clearTimeout(timeoutId)
        return []
    }
}
