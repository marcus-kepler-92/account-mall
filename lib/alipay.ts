import { AlipaySdk } from "alipay-sdk"

let alipaySdk: AlipaySdk | null = null

function getBaseUrl(): string {
    return (
        process.env.BETTER_AUTH_URL ??
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
    )
}

/**
 * Get Alipay SDK instance. Returns null if Alipay is not configured.
 */
export function getAlipaySdk(): AlipaySdk | null {
    if (alipaySdk) return alipaySdk
    const appId = process.env.ALIPAY_APP_ID
    const privateKey = process.env.ALIPAY_PRIVATE_KEY
    const alipayPublicKey = process.env.ALIPAY_PUBLIC_KEY
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
    const base = getBaseUrl()
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
    const base = getBaseUrl()
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
