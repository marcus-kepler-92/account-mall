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
export function buildSubmitUrl(params: Record<string, string>, key: string): string {
    const prestr = getVerifyParams(params)
    const sign = md5(prestr + key)
    const base = config.yipaySubmitUrl ?? ""
    return `${base}?${prestr}&sign=${sign}&sign_type=MD5`
}

/**
 * Generate Yipay page pay URL. Uses orderNo, totalAmount, subject; notify_url and return_url from config.siteUrl.
 * Returns null if Yipay is not configured.
 * @param params.type - Payment channel: "alipay" | "wxpay" | "qqpay" (default: "alipay")
 */
export function getYipayPagePayUrl(params: {
    orderNo: string
    totalAmount: string
    subject: string
    type?: string
}): string | null {
    if (!isYipayConfigured()) return null
    const base = config.siteUrl
    const pid = config.yipayPid!
    const key = config.yipayKey!
    const _submitUrl = config.yipaySubmitUrl!
    const siteName = config.yipaySiteName!

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
        return buildSubmitUrl(requestParams, key)
    } catch {
        return null
    }
}

/**
 * Verify Yipay async notify sign. Same algorithm as submit: prestr from params (exclude sign/sign_type), mysign = MD5(prestr+key), compare with sign (lowercase).
 */
export function verifyYipayNotifySign(postData: Record<string, unknown>): boolean {
    if (!isYipayConfigured()) return false
    const key = config.yipayKey!
    const signReceived = postData.sign
    if (typeof signReceived !== "string" || !signReceived) return false
    const stringParams: Record<string, string> = {}
    for (const [k, v] of Object.entries(postData)) {
        if (v !== undefined && v !== null && String(v).trim() !== "") {
            stringParams[k] = String(v).trim()
        }
    }
    const prestr = getVerifyParams(stringParams)
    const mysign = md5(prestr + key)
    return mysign === signReceived.toLowerCase()
}
