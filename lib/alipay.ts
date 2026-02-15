import { AlipaySdk } from "alipay-sdk"
import { config } from "@/lib/config"

let alipaySdk: AlipaySdk | null = null

/**
 * Get Alipay SDK instance. Returns null if Alipay is not configured.
 */
export function getAlipaySdk(): AlipaySdk | null {
    if (alipaySdk) return alipaySdk
    const appId = config.alipayAppId
    const privateKey = config.alipayPrivateKey
    const alipayPublicKey = config.alipayPublicKey
    if (!appId || !privateKey || !alipayPublicKey) return null
    try {
        alipaySdk = new AlipaySdk({
            appId,
            privateKey: privateKey.replace(/\\n/g, "\n"),
            alipayPublicKey: alipayPublicKey.replace(/\\n/g, "\n"),
            signType: "RSA2",
        })
        return alipaySdk
    } catch {
        return null
    }
}

/**
 * Generate Alipay page pay URL for PC (电脑网站支付).
 * Returns null if SDK is not configured or generation fails.
 */
export function getAlipayPagePayUrl(params: {
    orderNo: string
    totalAmount: string
    subject: string
    body?: string
}): string | null {
    const sdk = getAlipaySdk()
    if (!sdk) return null
    const base = config.siteUrl
    try {
        const url = sdk.pageExecute(
            "alipay.trade.page.pay",
            "GET",
            {
                bizContent: {
                    out_trade_no: params.orderNo,
                    product_code: "FAST_INSTANT_TRADE_PAY",
                    total_amount: params.totalAmount,
                    subject: params.subject,
                    body: params.body ?? params.subject,
                },
                returnUrl: `${base}/orders/pay-return`,
                notifyUrl: `${base}/api/payment/alipay/notify`,
            } as any,
        )
        return typeof url === "string" ? url : null
    } catch {
        return null
    }
}

/**
 * Generate Alipay wap pay URL for mobile (手机网站支付).
 */
export function getAlipayWapPayUrl(params: {
    orderNo: string
    totalAmount: string
    subject: string
    body?: string
}): string | null {
    const sdk = getAlipaySdk()
    if (!sdk) return null
    const base = config.siteUrl
    try {
        const url = sdk.pageExecute(
            "alipay.trade.wap.pay",
            "GET",
            {
                bizContent: {
                    out_trade_no: params.orderNo,
                    product_code: "QUICK_WAP_WAY",
                    total_amount: params.totalAmount,
                    subject: params.subject,
                    body: params.body ?? params.subject,
                },
                returnUrl: `${base}/orders/pay-return`,
                notifyUrl: `${base}/api/payment/alipay/notify`,
            } as any,
        )
        return typeof url === "string" ? url : null
    } catch {
        return null
    }
}

/**
 * Verify Alipay async notify sign. Use for POST /api/payment/alipay/notify.
 */
export function verifyAlipayNotifySign(postData: Record<string, unknown>): boolean {
    const sdk = getAlipaySdk()
    if (!sdk) return false
    try {
        return sdk.checkNotifySignV2(postData as any) ?? false
    } catch {
        return false
    }
}
