/**
 * Scrape shared Apple ID accounts (fetch + cheerio, runs on Vercel Serverless).
 * Parses account lists from source pages; only returns accounts where status is absent
 * or explicitly "正常". Accounts with a different status value are filtered out.
 * Uses an in-process cache; cache hit rate depends on serverless instance reuse.
 */

import * as cheerio from "cheerio"
import { config } from "@/lib/config"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import { VOIDLOGINS_SCHEME, parseVoidloginsSourceUrl } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Only accept accounts with this status; accounts with any other explicit status are rejected. */
const ALLOWED_STATUS = "正常"
/** Substrings that, if present in a region name, cause the account to be excluded. */
const BLOCKED_REGION_KEYWORDS = ["中国大陆", "小火箭"]
const DEFAULT_USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SharedAccount {
    account: string
    password: string
    region: string
    /** Status string, e.g. "正常" (used for filtering only, not shown in UI) */
    status: string
    /** Last check timestamp, e.g. "2026-03-01 15:39:23" */
    lastCheckedAt?: string
    /** Admin remark from the source platform (e.g. voidlogins frontend_remark) */
    remark?: string
}

interface VoidloginsResponse {
    code: number
    status: boolean
    msg: string
    accounts: {
        id: number
        username: string
        password: string
        status: boolean
        region_display?: string
        frontend_remark?: string
        message?: string
        last_check?: string
        last_check_success?: number
        check_interval?: number
    }[]
}

// ---------------------------------------------------------------------------
// Shared regexes
// ---------------------------------------------------------------------------

const STATUS_RE = /状态[：:]\s*([^\s\n]+)/
/** Matches various timestamp labels used across different source sites */
const LAST_CHECKED_RE = /(?:上次检查|检测时间|账号更新)[：:]\s*(\d{4}-\d{2}-\d{2}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?)/
const ACCOUNT_RE = /账号[：:]\s*([^\s\n]+)|([^\s]+@[^\s]+)/
const PASSWORD_RE = /密码[：:]\s*([^\s\n]+)/
const REGION_RE = /地区[：:]\s*([^\s\n]+)|(美国|香港|日本|新加坡|台湾|韩国|英国|德国|法国)/
const REGION_BRACKET_RE = /【([^】]+)】/
/** Matches onclick="copy('PASSWORD')" - used by ccbaohe.com and similar */
const ONCLICK_COPY_RE = /copy\(['"]([^'"]+)['"]\)/

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Decode Cloudflare email obfuscation (data-cfemail XOR encoding). */
function decodeCfEmail(hex: string): string {
    if (!hex || hex.length < 4) return ""
    try {
        const key = parseInt(hex.substring(0, 2), 16)
        let out = ""
        for (let i = 2; i < hex.length; i += 2) {
            out += String.fromCharCode(parseInt(hex.substring(i, i + 2), 16) ^ key)
        }
        return out
    } catch {
        return ""
    }
}

/** Decode JS unicode escapes (e.g. & → &) found in onclick attribute values. */
function decodeJsUnicodeEscapes(s: string): string {
    return s.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}

/** Return the first non-empty capture group from a regex match, or null. */
function extractGroup(text: string, re: RegExp): string | null {
    const m = text.match(re)
    if (!m) return null
    const group = m.slice(1).find((g) => g != null && g.trim() !== "")
    return group ? group.trim() : null
}

/**
 * Returns true if the status should be accepted.
 * A blank status (field not present on page) is accepted — the site itself
 * is assumed to only show valid accounts in that case.
 * An explicit non-allowed value (e.g. "异常") is rejected.
 */
function isAllowedStatus(status: string): boolean {
    return status === "" || status.trim() === ALLOWED_STATUS
}

function isAllowedRegion(region: string): boolean {
    const r = region.trim()
    return !BLOCKED_REGION_KEYWORDS.some((kw) => r.includes(kw))
}

// ---------------------------------------------------------------------------
// Extraction helpers
// ---------------------------------------------------------------------------

/**
 * Try to extract a SharedAccount from a card-like cheerio element.
 * Handles both data-clipboard-text buttons (ali-door.top style) and
 * Cloudflare-obfuscated emails + copy() onclick handlers (ccbaohe.com style).
 * Returns null if account or password cannot be found, or if status/region is rejected.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tryExtractCard($: cheerio.CheerioAPI, el: any, seen: Set<string>): SharedAccount | null {
    const $el = $(el)
    const text = $el.text()

    const status = extractGroup(text, STATUS_RE)?.trim() ?? ""
    if (!isAllowedStatus(status)) return null

    const lastCheckedAt = extractGroup(text, LAST_CHECKED_RE)?.trim() ?? undefined
    // --- Account ---
    // 1. Cloudflare XOR-encoded email (data-cfemail attribute); validate result looks like an email
    let account = ""
    const cfDecoded = decodeCfEmail($el.find("[data-cfemail]").first().attr("data-cfemail") ?? "")
    if (cfDecoded.includes("@")) account = cfDecoded
    // 2. data-clipboard-text on a copy button that looks like an email
    if (!account) {
        $el.find("[data-clipboard-text]").each((_, btn) => {
            const v = $(btn).attr("data-clipboard-text") ?? ""
            if (v.includes("@") && !v.includes("*")) { account = v.trim(); return false }
        })
    }
    // 3. Regex fallback — reject masked addresses (e.g. nb***@hotmail.com from visible header text)
    if (!account) {
        const candidate = extractGroup(text, ACCOUNT_RE) ?? ""
        if (candidate.includes("@") && !candidate.includes("*")) account = candidate
    }

    // --- Password ---
    // 1. onclick="copy('...')" handler
    let password = ""
    $el.find("button[onclick]").each((_, btn) => {
        const m = ($(btn).attr("onclick") ?? "").match(ONCLICK_COPY_RE)
        if (m) { password = decodeJsUnicodeEscapes(m[1]); return false }
    })
    // 2. data-clipboard-text on a dedicated password copy button
    if (!password) {
        password = $el.find("button.copy-pass-btn").attr("data-clipboard-text")?.trim() ?? ""
    }
    // 3. Regex fallback
    if (!password) password = extractGroup(text, PASSWORD_RE) ?? ""

    // --- Region ---
    // Prefer the card header / title element for bracket-style regions (【美国】),
    // then fall back to badge text, then regex.
    const headerText = $el.find(".card-header, .card-title, h5").first().text()
    const region =
        extractGroup(headerText || text, REGION_BRACKET_RE) ||
        $el.find(".card-text .badge, .badge").first().text().trim() ||
        extractGroup(text, REGION_RE) ||
        "未知"

    if (!account || password.length < 4) return null
    if (!isAllowedRegion(region)) return null
    if (seen.has(account)) return null

    seen.add(account)
    return { account, password, region, status: status || ALLOWED_STATUS, lastCheckedAt }
}

/** Try to extract a SharedAccount from a plain text blob (used by strategies 2 and 3). */
function tryExtractFromText(text: string, seen: Set<string>): SharedAccount | null {
    const status = extractGroup(text, STATUS_RE)?.trim() ?? ""
    if (!isAllowedStatus(status)) return null
    const account = extractGroup(text, ACCOUNT_RE)
    const password = extractGroup(text, PASSWORD_RE)
    if (!account || !password || seen.has(account)) return null
    const region = extractGroup(text, REGION_RE) || "未知"
    if (!isAllowedRegion(region)) return null
    seen.add(account)
    return {
        account,
        password,
        region,
        status: status || ALLOWED_STATUS,
        lastCheckedAt: extractGroup(text, LAST_CHECKED_RE)?.trim() ?? undefined,
    }
}

// ---------------------------------------------------------------------------
// HTML parser
// ---------------------------------------------------------------------------

function parseAccountsFromHtml(html: string): SharedAccount[] {
    const $ = cheerio.load(html)
    const results: SharedAccount[] = []
    const seen = new Set<string>()

    // Strategy 1: card containers (.card) — handles ali-door.top, ccbaohe.com, and similar layouts.
    // Only process leaf cards (no descendant .card elements) to avoid aggregated text from wrappers.
    $(".card").filter((_, el) => $(el).find(".card").length === 0).each((_, el) => {
        const acc = tryExtractCard($, el, seen)
        if (acc) results.push(acc)
    })
    if (results.length > 0) return results

    // Strategy 2: table rows
    $("tr").each((_, tr) => {
        const acc = tryExtractFromText($(tr).text(), seen)
        if (acc) results.push(acc)
    })
    if (results.length > 0) return results

    // Strategy 3: common block-level selectors
    const blockSelectors = [
        "[class*='item']",
        "[class*='account']",
        "[class*='row']",
        "div[class*='list'] > div",
        ".list-group-item",
    ]
    for (const sel of blockSelectors) {
        $(sel).each((_, el) => {
            const acc = tryExtractFromText($(el).text(), seen)
            if (acc) results.push(acc)
        })
        if (results.length > 0) return results
    }

    // Strategy 4: split page by "状态:正常" markers — last resort for plain-text pages.
    // Segments inherit ALLOWED_STATUS from the marker that preceded them; status is not re-extracted.
    const segments = html.split(/状态[：:]\s*正常/).slice(1)
    for (const seg of segments) {
        const text = cheerio.load(seg).text()
        const account = extractGroup(text, ACCOUNT_RE)
        const password = extractGroup(text, PASSWORD_RE)
        const region = extractGroup(text, REGION_RE) || "未知"
        if (account && password && !seen.has(account) && isAllowedRegion(region)) {
            seen.add(account)
            results.push({
                account,
                password,
                region,
                status: ALLOWED_STATUS,
                lastCheckedAt: extractGroup(text, LAST_CHECKED_RE)?.trim() ?? undefined,
            })
        }
    }

    return results
}

// ---------------------------------------------------------------------------
// Cache helper
// ---------------------------------------------------------------------------

/** In-process TTL cache keyed by source URL / strategy key */
const scrapeCache = new Map<string, { data: SharedAccount[]; expiresAt: number }>()

/** Read from cache or call fetcher; caches non-empty results for ttlMs. */
async function withCache(
    key: string,
    ttlMs: number,
    fetcher: () => Promise<SharedAccount[]>,
): Promise<SharedAccount[]> {
    const now = Date.now()
    const cached = scrapeCache.get(key)
    if (cached && cached.expiresAt > now) return cached.data
    const data = await fetcher()
    if (data.length > 0) scrapeCache.set(key, { data, expiresAt: now + ttlMs })
    return data
}

// ---------------------------------------------------------------------------
// Fetch strategy
// ---------------------------------------------------------------------------

/**
 * Strategy discriminated union.
 * Add new kinds here as new AUTO_FETCH source types are introduced.
 */
type FetchStrategy =
    | { kind: "scrape"; urls: string[] }
    | { kind: "voidlogins"; code: string; password: string }

/** Resolve a stored sourceUrl into the appropriate fetch strategy. */
function resolveStrategy(sourceUrl: string): FetchStrategy | null {
    const trimmed = sourceUrl.trim()
    const voidlogins = parseVoidloginsSourceUrl(trimmed)
    if (voidlogins) return { kind: "voidlogins", code: voidlogins.code, password: voidlogins.password }
    const urls = trimmed.split(",").map((u) => u.trim()).filter((u) => u.startsWith("http"))
    if (urls.length === 0) return null
    return { kind: "scrape", urls }
}

// ---------------------------------------------------------------------------
// Strategy executors
// ---------------------------------------------------------------------------

/**
 * Fetch sourceUrl and parse all valid shared accounts (HTML scraping).
 * Results are cached for config.autoFetchScrapeCacheTtlMs; empty results are not cached
 * so the next request retries immediately.
 */
export async function scrapeSharedAccounts(sourceUrl: string): Promise<SharedAccount[]> {
    const url = sourceUrl.trim()
    if (!url.startsWith("http://") && !url.startsWith("https://")) return []

    return withCache(url, config.autoFetchScrapeCacheTtlMs, async () => {
        const res = await fetchWithTimeout(url, {
            timeoutMs: config.autoFetchScrapeTimeoutMs,
            headers: {
                "User-Agent": config.autoFetchScrapeUserAgent ?? DEFAULT_USER_AGENT,
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            },
        })
        if (!res.ok) {
            console.warn(`[scrape] HTTP ${res.status} from ${url}`)
            return []
        }
        const html = await res.text()
        const data = parseAccountsFromHtml(html)
        console.log(`[scrape] parsed ${data.length} accounts from ${url}`)
        return data
    }).catch((err) => {
        console.warn("[scrape] fetch failed:", err instanceof Error ? err.message : err)
        return []
    })
}

/** Execute the scrape strategy: fetch one or more HTML sources and merge results. */
async function executeScrapeStrategy(urls: string[]): Promise<SharedAccount[]> {
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

/** Execute the voidlogins strategy: call the apple.voidlogins.com JSON API. */
async function executeVoidloginsStrategy(code: string, password: string): Promise<SharedAccount[]> {
    const appleHostingBaseUrl = config.appleHostingUrl.replace(/\/$/, "")
    const encodedCode = encodeURIComponent(code)
    const encodedPassword = password ? encodeURIComponent(password) : ""
    const cacheKey = encodedPassword
        ? `${VOIDLOGINS_SCHEME}${encodedCode}/${encodedPassword}`
        : `${VOIDLOGINS_SCHEME}${encodedCode}`

    const apiPath = encodedPassword
        ? `/shareapi/${encodedCode}/${encodedPassword}`
        : `/shareapi/${encodedCode}`
    const url = `${appleHostingBaseUrl}${apiPath}`

    return withCache(cacheKey, config.autoFetchScrapeCacheTtlMs, async () => {
        console.log(`[voidlogins] fetching ${url}`)
        const res = await fetchWithTimeout(url, {
            timeoutMs: config.autoFetchScrapeTimeoutMs,
            headers: { Accept: "application/json" },
        })
        if (!res.ok) {
            console.warn(`[voidlogins] HTTP ${res.status} from ${appleHostingBaseUrl}`)
            return []
        }
        const json = await res.json() as VoidloginsResponse
        if (!json.status || !Array.isArray(json.accounts)) {
            console.warn(`[voidlogins] API error: ${json.msg}`)
            return []
        }
        const seen = new Set<string>()
        const data: SharedAccount[] = []
        for (const acc of json.accounts) {
            if (!acc.username || !acc.password) continue
            if (!acc.status) continue
            if (seen.has(acc.username)) continue
            seen.add(acc.username)
            data.push({
                account: acc.username,
                password: acc.password,
                region: acc.region_display || "未知",
                status: ALLOWED_STATUS,
                ...(acc.last_check && { lastCheckedAt: acc.last_check }),
                ...(acc.frontend_remark && { remark: acc.frontend_remark }),
            })
        }
        console.log(`[voidlogins] got ${data.length} accounts`)
        return data
    }).catch((err) => {
        console.warn("[voidlogins] fetch failed:", err instanceof Error ? err.message : err)
        return []
    })
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve the source URL to a fetch strategy, execute it, and return normalised SharedAccount[].
 * Supported sourceUrl formats:
 * - `voidlogins://CODE` or `voidlogins://CODE/PASSWORD` → voidlogins JSON API
 * - Comma-separated HTTP URLs → HTML scraping
 */
export async function scrapeMultipleUrls(sourceUrl: string): Promise<SharedAccount[]> {
    const strategy = resolveStrategy(sourceUrl)
    if (!strategy) return []
    switch (strategy.kind) {
        case "voidlogins":
            return executeVoidloginsStrategy(strategy.code, strategy.password)
        case "scrape":
            return executeScrapeStrategy(strategy.urls)
    }
}
