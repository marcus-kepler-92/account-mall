import { createHash } from "crypto"
import { config } from "@/lib/config"

/**
 * Check if Zpay (z-pay) is fully configured. When true, use getZpayPagePayUrl instead of Alipay SDK.
 */
export function isZpayConfigured(): boolean {
    const { zpayPid, zpayKey, zpaySubmitUrl, zpaySiteName } = config
    return !!(zpayPid && zpayKey && zpaySubmitUrl && zpaySiteName)
}

/**
 * Build待签名字符串: exclude sign, sign_type and empty values, sort by key, join key=value&key2=value2.
 * Same as demo getVerifyParams.
 */
export function getVerifyParams(params: Record<string, string>): string {
    const sPara: [string, string][] = []
    for (const key of Object.keys(params)) {
        if (key === "sign" || key === "sign_type") continue
        const value = params[key]
        if (value === undefined || value === null || String(value).trim() === "") continue
        sPara.push([key, String(value).trim()])
    }
    sPara.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    return sPara.map(([k, v]) => `${k}=${v}`).join("&")
}

function md5(str: string): string {
    return createHash("md5").update(str, "utf8").digest("hex").toLowerCase()
}

/**
 * Build full submit URL: prestr + sign=MD5(prestr+key) + sign_type=MD5.
 * Key must be kept server-side only.
 */
export function buildSubmitUrl(params: Record<string, string>, key: string, submitUrl?: string): string {
    const prestr = getVerifyParams(params)
    const sign = md5(prestr + key)
    const base = submitUrl ?? config.zpaySubmitUrl ?? ""
    return `${base}?${prestr}&sign=${sign}&sign_type=MD5`
}

/**
 * Generate Zpay page pay URL. Uses orderNo, totalAmount, subject; notify_url and return_url from config.siteUrl.
 * Credentials always come from env config. Returns null if required config (pid/key/submitUrl/siteName) is missing.
 * @param params.type - Payment channel: "alipay" | "wxpay" | "qqpay" (default: "alipay")
 */
export function getZpayPagePayUrl(params: {
    orderNo: string
    totalAmount: string
    subject: string
    type?: string
}): string | null {
    const pid = config.zpayPid
    const key = config.zpayKey
    const submitUrl = config.zpaySubmitUrl
    const siteName = config.zpaySiteName

    if (!pid || !key || !submitUrl || !siteName) return null

    const base = config.siteUrl
    const requestParams: Record<string, string> = {
        pid,
        money: params.totalAmount,
        name: params.subject,
        notify_url: `${base}/api/payment/zpay/notify`,
        return_url: `${base}/orders/pay-return`,
        out_trade_no: params.orderNo,
        sitename: siteName,
        type: params.type ?? "alipay",
    }
    try {
        return buildSubmitUrl(requestParams, key, submitUrl)
    } catch {
        return null
    }
}

/**
 * Outcome of an active Zpay order query, used to drive irreversible decisions
 * (e.g. closing an expired order). The four states are deliberately distinct so
 * callers never have to collapse "gateway says no such order" with "we couldn't
 * reach the gateway" — those demand opposite handling:
 *
 * - "paid":      Zpay confirms the order is paid → complete it.
 * - "unpaid":    Zpay knows the order and it is not paid → safe to close.
 * - "not_found": Zpay positively reports no such out_trade_no → never can be
 *                paid (customer never reached the gateway) → safe to close.
 * - "error":     Transient failure / unrecognized response / unconfigured →
 *                we cannot tell. Callers must NOT close on this (money safety).
 */
export type ZpayOrderQuery = { status: "paid" | "unpaid" | "not_found" | "error" }

/** Matches Zpay/epay "order does not exist" style messages for unknown out_trade_no. */
const ZPAY_NOT_FOUND_MSG = /不存在|无此订单|查询不到|not.?found|no.*order/i

/** Hard timeout for a single Zpay query so a hung gateway can't stall a batch (cron) caller. */
const ZPAY_QUERY_TIMEOUT_MS = 8_000

/**
 * Query a single order's payment status from Zpay. Credentials always come from
 * env config. Never throws and never returns null — failures map to "error" so
 * callers get a total function over {@link ZpayOrderQuery}.
 */
export async function queryZpayOrder(orderNo: string): Promise<ZpayOrderQuery> {
    const pid = config.zpayPid
    const key = config.zpayKey
    const submitUrl = config.zpaySubmitUrl
    if (!pid || !key || !submitUrl) return { status: "error" }
    try {
        const base = new URL(submitUrl)
        base.pathname = "/api.php"
        base.search = ""
        const url = `${base.toString()}?act=order&pid=${encodeURIComponent(pid)}&key=${encodeURIComponent(key)}&out_trade_no=${encodeURIComponent(orderNo)}`
        const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(ZPAY_QUERY_TIMEOUT_MS) })
        if (!res.ok) {
            console.warn("[zpay-query] orderNo=%s http_status=%d", orderNo, res.status)
            return { status: "error" }
        }
        const data = (await res.json()) as Record<string, unknown>
        if (data.code !== 1 && data.code !== "1") {
            // Non-success code: only treat as not_found when the gateway message
            // positively says so; otherwise stay conservative ("error", do not close).
            const msg = typeof data.msg === "string" ? data.msg : ""
            return { status: ZPAY_NOT_FOUND_MSG.test(msg) ? "not_found" : "error" }
        }
        const tradeStatus = data.trade_status as string | undefined
        const numericStatus = data.status
        const paid =
            tradeStatus === "TRADE_SUCCESS" ||
            tradeStatus === "TRADE_FINISHED" ||
            tradeStatus === "success" ||
            numericStatus === 1 ||
            numericStatus === "1"
        return { status: paid ? "paid" : "unpaid" }
    } catch (e) {
        console.error("[zpay-query] orderNo=%s error=%s", orderNo, e instanceof Error ? e.message : String(e))
        return { status: "error" }
    }
}

/**
 * Refund an order through Zpay (z-pay) via `act=refund` POST.
 * Credentials always come from env config. Returns { ok: true } when Zpay confirms refund (code === 1),
 * { ok: false, message } with Zpay's msg on a declined refund, or null on error/unconfigured.
 *
 * @param orderNo  out_trade_no — the platform order number used at payment time
 * @param money    refund amount string; must equal the original paid amount (Order.amount)
 */
export async function refundZpayOrder(
    orderNo: string,
    money: string,
): Promise<{ ok: boolean; message?: string } | null> {
    const pid = config.zpayPid
    const key = config.zpayKey
    const submitUrl = config.zpaySubmitUrl
    if (!pid || !key || !submitUrl) return null
    try {
        const base = new URL(submitUrl)
        base.pathname = "/api.php"
        base.search = ""
        const url = `${base.toString()}?act=refund`
        const form = new URLSearchParams({ pid, key, money, out_trade_no: orderNo })
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: form.toString(),
            cache: "no-store",
        })
        if (!res.ok) {
            console.warn("[zpay-refund] orderNo=%s http_status=%d", orderNo, res.status)
            return null
        }
        const data = (await res.json()) as Record<string, unknown>
        const ok = data.code === 1 || data.code === "1"
        const message = typeof data.msg === "string" ? data.msg : undefined
        return { ok, message }
    } catch (e) {
        console.error("[zpay-refund] orderNo=%s error=%s", orderNo, e instanceof Error ? e.message : String(e))
        return null
    }
}

/**
 * Verify Zpay async notify sign. Same algorithm as submit: prestr from params (exclude sign/sign_type), mysign = MD5(prestr+key), compare with sign (lowercase).
 * The signing key always comes from env config.
 */
export function verifyZpayNotifySign(postData: Record<string, unknown>): boolean {
    const signingKey = config.zpayKey
    if (!signingKey) return false
    const signReceived = postData.sign
    if (typeof signReceived !== "string" || !signReceived) return false
    const stringParams: Record<string, string> = {}
    for (const [k, v] of Object.entries(postData)) {
        if (v !== undefined && v !== null && String(v).trim() !== "") {
            stringParams[k] = String(v).trim()
        }
    }
    const prestr = getVerifyParams(stringParams)
    const mysign = md5(prestr + signingKey)
    return mysign === signReceived.toLowerCase()
}
