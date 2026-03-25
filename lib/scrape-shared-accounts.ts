/**
 * 免费共享账号爬取（fetch + cheerio，可在 Vercel Serverless 运行）
 * 从 sourceUrl 页面解析账号列表，仅返回「状态:正常」的账号；异常等其它状态会被过滤。
 * 缓存为进程内缓存，Serverless 多实例下各实例独立，命中率视实例复用情况而定。
 */

import * as cheerio from "cheerio"
import { config } from "@/lib/config"

/** 仅领取该状态的账号，其它（如异常）过滤掉；调参请改此处或 config */
const ALLOWED_STATUS = "正常"
/** 过滤掉的地区，这些地区的账号不会被分配给用户 */
const BLOCKED_REGIONS = ["中国大陆"]
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
    // 上次检查/检测时间：完整到时分秒，如 2026-03-01 15:39:23
    const lastCheckedRe = /(?:上次检查|检测时间)[：:]\s*(\d{4}-\d{2}-\d{2}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?)/
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

    /** 排除中国大陆等地区 */
    function isAllowedRegion(region: string): boolean {
        return !BLOCKED_REGIONS.includes(region.trim())
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
        if (account && password && !seen.has(account) && isAllowedRegion(region)) {
            seen.add(account)
            results.push({ account, password, region, status, lastCheckedAt, installStatus })
        }
    })

    if (results.length > 0) return results

    // 策略1：Bootstrap card + Cloudflare 邮箱解码 + copy() onclick（ccbaohe.com）
    // 指纹：.card-header + .card-body 同时存在，且页面含 [data-cfemail] 编码邮箱
    if ($(".card-header").length > 0 && $("[data-cfemail]").length > 0) {
        const onclickPasswordRe = /copy\(['"]([^'"]+)['"]\)/
        const regionBracketRe = /【([^】]+)】/

        $(".card").each((_, card) => {
            const $card = $(card)
            const $header = $card.find(".card-header")
            const $body = $card.find(".card-body")
            if (!$header.length || !$body.length) return

            const cardTitleText = $body.find(".card-title").text()
            if (!cardTitleText.includes(ALLOWED_STATUS)) return
            const bodyText = $body.text()
            const { lastCheckedAt, installStatus } = parseBlock(bodyText)

            const headerText = $header.text()
            const region =
                extractGroup(headerText, regionBracketRe) ||
                extractGroup(headerText, regionRe) ||
                "未知"

            // Cloudflare 邮箱解码：data-cfemail 十六进制 XOR 解码
            let account = ""
            const cfemail = $body.find("[data-cfemail]").first().attr("data-cfemail") ?? ""
            if (cfemail) {
                try {
                    const key = parseInt(cfemail.substring(0, 2), 16)
                    let decoded = ""
                    for (let i = 2; i < cfemail.length; i += 2) {
                        decoded += String.fromCharCode(parseInt(cfemail.substring(i, i + 2), 16) ^ key)
                    }
                    account = decoded
                } catch {
                    account = ""
                }
            }
            if (!account) account = extractGroup(headerText + " " + bodyText, accountRe) ?? ""

            let password: string | null = null
            $body.find("button[onclick]").each((_, btn) => {
                const onclick = $(btn).attr("onclick") ?? ""
                const m = onclick.match(onclickPasswordRe)
                if (m) { password = m[1]; return false }
            })
            password = password || extractGroup(bodyText, passwordRe)

            if (account && password && !seen.has(account) && isAllowedRegion(region)) {
                seen.add(account)
                results.push({ account, password, region, status: ALLOWED_STATUS, lastCheckedAt, installStatus })
            }
        })

        if (results.length > 0) return results
    }

    // 策略2：按表格行（tr）解析，仅保留状态为「正常」的行
    $("tr").each((_, tr) => {
        const $tr = $(tr)
        const text = $tr.text()
        const { status, lastCheckedAt, installStatus } = parseBlock(text)
        if (!isAllowedStatus(status)) return
        const account = extractGroup(text, accountRe)
        const password = extractGroup(text, passwordRe)
        const region = extractGroup(text, regionRe) || "未知"
        if (account && password && !seen.has(account) && isAllowedRegion(region)) {
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
            if (account && password && !seen.has(account) && isAllowedRegion(region)) {
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
        if (account && password && !seen.has(account) && isAllowedRegion(region)) {
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

    const timeoutMs = config.autoFetchScrapeTimeoutMs
    const userAgent = config.autoFetchScrapeUserAgent ?? DEFAULT_USER_AGENT
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

        if (!res.ok) {
            console.warn(`[scrape] HTTP ${res.status} 从 ${url}`)
            return []
        }
        const html = await res.text()
        const data = parseAccountsFromHtml(html)
        console.log(`[scrape] 解析出 ${data.length} 条账号，来源: ${url}`)
        // Only cache non-empty results; empty results should be retried immediately
        if (data.length > 0) {
            scrapeCache.set(url, { data, expiresAt: now + config.autoFetchScrapeCacheTtlMs })
        }
        return data
    } catch (err) {
        clearTimeout(timeoutId)
        console.warn("[scrape] 爬取失败:", err instanceof Error ? err.message : err)
        return []
    }
}

/**
 * 支持逗号分隔的多 URL 并发爬取，结果合并去重（以 account 为 key）。
 * 单 URL 时直接委托 scrapeSharedAccounts。
 */
export async function scrapeMultipleUrls(sourceUrl: string): Promise<SharedAccount[]> {
    const urls = sourceUrl.split(",").map((u) => u.trim()).filter((u) => u.startsWith("http"))
    if (urls.length === 0) return []
    if (urls.length === 1) return scrapeSharedAccounts(urls[0])

    const lists = await Promise.all(urls.map((u) => scrapeSharedAccounts(u)))
    const seen = new Set<string>()
    const merged: SharedAccount[] = []
    for (const list of lists) {
        for (const acc of list) {
            if (!seen.has(acc.account)) {
                seen.add(acc.account)
                merged.push(acc)
            }
        }
    }
    return merged
}
