import { createHash } from "crypto"
import { config } from "@/lib/config"

/**
 * Check if Yipay (易支付) is fully configured. When true, use getYipayPagePayUrl instead of Alipay SDK.
 */
export function isYipayConfigured(): boolean {
    const { yipayPid, yipayKey, yipaySubmitUrl, yipaySiteName } = config
    return !!(yipayPid && yipayKey && yipaySubmitUrl && yipaySiteName)
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
    const base = submitUrl ?? config.yipaySubmitUrl ?? ""
    return `${base}?${prestr}&sign=${sign}&sign_type=MD5`
}

export type YipayChannelConfig = {
    pid: string
    key: string
    submitUrl: string
    siteName: string
}

/**
 * Generate Yipay page pay URL. Uses orderNo, totalAmount, subject; notify_url and return_url from config.siteUrl.
 * Returns null if required config (pid/key/submitUrl/siteName) is missing.
 * @param params.type - Payment channel: "alipay" | "wxpay" | "qqpay" (default: "alipay")
 * @param params.channel - Optional per-channel config overrides; falls back to global env vars.
 */
export function getYipayPagePayUrl(params: {
    orderNo: string
    totalAmount: string
    subject: string
    type?: string
    channel?: YipayChannelConfig
}): string | null {
    const channel = params.channel
    const pid = channel?.pid ?? config.yipayPid
    const key = channel?.key ?? config.yipayKey
    const submitUrl = channel?.submitUrl ?? config.yipaySubmitUrl
    const siteName = channel?.siteName ?? config.yipaySiteName

    if (!pid || !key || !submitUrl || !siteName) return null

    const base = config.siteUrl
    const requestParams: Record<string, string> = {
        pid,
        money: params.totalAmount,
        name: params.subject,
        notify_url: `${base}/api/payment/yipay/notify`,
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
 * Query a single order's payment status from Yipay.
 * Returns { paid: true } when Yipay confirms payment, { paid: false } when unpaid, null on error/unconfigured.
 */
export async function queryYipayOrder(
    orderNo: string,
    channel?: Pick<YipayChannelConfig, "pid" | "key" | "submitUrl">,
): Promise<{ paid: boolean } | null> {
    const pid = channel?.pid ?? config.yipayPid
    const key = channel?.key ?? config.yipayKey
    const submitUrl = channel?.submitUrl ?? config.yipaySubmitUrl
    if (!pid || !key || !submitUrl) return null
    try {
        const base = new URL(submitUrl)
        base.pathname = "/api.php"
        base.search = ""
        const url = `${base.toString()}?act=order&pid=${encodeURIComponent(pid)}&key=${encodeURIComponent(key)}&out_trade_no=${encodeURIComponent(orderNo)}`
        const res = await fetch(url, { cache: "no-store" })
        if (!res.ok) {
            console.warn("[yipay-query] orderNo=%s http_status=%d", orderNo, res.status)
            return null
        }
        const data = (await res.json()) as Record<string, unknown>
        if (data.code !== 1 && data.code !== "1") return null
        const tradeStatus = data.trade_status as string | undefined
        const numericStatus = data.status
        const paid =
            tradeStatus === "TRADE_SUCCESS" ||
            tradeStatus === "TRADE_FINISHED" ||
            tradeStatus === "success" ||
            numericStatus === 1 ||
            numericStatus === "1"
        return { paid }
    } catch (e) {
        console.error("[yipay-query] orderNo=%s error=%s", orderNo, e instanceof Error ? e.message : String(e))
        return null
    }
}

/**
 * Refund an order through Yipay (易支付) via `act=refund` POST.
 * Mirrors queryYipayOrder's credential resolution: per-channel pid/key/submitUrl when provided,
 * else env fallback. Returns { ok: true } when Yipay confirms refund (code === 1),
 * { ok: false, message } with Yipay's msg on a declined refund, or null on error/unconfigured.
 *
 * @param orderNo  out_trade_no — the platform order number used at payment time
 * @param money    refund amount string; must equal the original paid amount (Order.amount)
 */
export async function refundYipayOrder(
    orderNo: string,
    money: string,
    channel?: Pick<YipayChannelConfig, "pid" | "key" | "submitUrl">,
): Promise<{ ok: boolean; message?: string } | null> {
    const pid = channel?.pid ?? config.yipayPid
    const key = channel?.key ?? config.yipayKey
    const submitUrl = channel?.submitUrl ?? config.yipaySubmitUrl
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
            console.warn("[yipay-refund] orderNo=%s http_status=%d", orderNo, res.status)
            return null
        }
        const data = (await res.json()) as Record<string, unknown>
        const ok = data.code === 1 || data.code === "1"
        const message = typeof data.msg === "string" ? data.msg : undefined
        return { ok, message }
    } catch (e) {
        console.error("[yipay-refund] orderNo=%s error=%s", orderNo, e instanceof Error ? e.message : String(e))
        return null
    }
}

/**
 * Verify Yipay async notify sign. Same algorithm as submit: prestr from params (exclude sign/sign_type), mysign = MD5(prestr+key), compare with sign (lowercase).
 */
export function verifyYipayNotifySign(postData: Record<string, unknown>, key?: string): boolean {
    const signingKey = key ?? config.yipayKey
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
