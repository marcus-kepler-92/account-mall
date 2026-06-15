import { createHash } from "crypto"
import { config } from "@/lib/config"
import { getVerifyParams } from "@/lib/zpay"

function md5(str: string): string {
    return createHash("md5").update(str, "utf8").digest("hex").toLowerCase()
}

/**
 * Build form params for POST /api/payment/zpay/notify that pass verifyZpayNotifySign.
 * E2E only: used to simulate a successful payment callback.
 * Requires ZPAY_PID, ZPAY_KEY, ZPAY_SUBMIT_URL, ZPAY_SITE_NAME to be set.
 */
export function buildZpayNotifyForm(
    orderNo: string,
    totalAmount: string,
): Record<string, string> {
    const { zpayPid, zpayKey, zpaySubmitUrl, zpaySiteName } = config
    if (!zpayPid || !zpayKey || !zpaySubmitUrl || !zpaySiteName) {
        throw new Error(
            "Zpay is not configured. Set ZPAY_PID, ZPAY_KEY, ZPAY_SUBMIT_URL, ZPAY_SITE_NAME for E2E payment flow.",
        )
    }
    const params: Record<string, string> = {
        money: totalAmount,
        out_trade_no: orderNo,
        pid: zpayPid,
        sitename: zpaySiteName,
        trade_status: "TRADE_SUCCESS",
    }
    const prestr = getVerifyParams(params)
    const sign = md5(prestr + zpayKey)
    return {
        ...params,
        sign,
        sign_type: "MD5",
    }
}

export function isZpayConfiguredForE2E(): boolean {
    const { zpayPid, zpayKey, zpaySubmitUrl, zpaySiteName } = config
    return !!(zpayPid && zpayKey && zpaySubmitUrl && zpaySiteName)
}
