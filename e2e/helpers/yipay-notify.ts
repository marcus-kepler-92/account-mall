import { createHash } from "crypto"
import { config } from "@/lib/config"
import { getVerifyParams } from "@/lib/yipay"

function md5(str: string): string {
    return createHash("md5").update(str, "utf8").digest("hex").toLowerCase()
}

/**
 * Build form params for POST /api/payment/yipay/notify that pass verifyYipayNotifySign.
 * E2E only: used to simulate a successful payment callback.
 * Requires YIPAY_PID, YIPAY_KEY, YIPAY_SUBMIT_URL, YIPAY_SITE_NAME to be set.
 */
export function buildYipayNotifyForm(
    orderNo: string,
    totalAmount: string,
): Record<string, string> {
    const { yipayPid, yipayKey, yipaySubmitUrl, yipaySiteName } = config
    if (!yipayPid || !yipayKey || !yipaySubmitUrl || !yipaySiteName) {
        throw new Error(
            "Yipay is not configured. Set YIPAY_PID, YIPAY_KEY, YIPAY_SUBMIT_URL, YIPAY_SITE_NAME for E2E payment flow.",
        )
    }
    const params: Record<string, string> = {
        money: totalAmount,
        out_trade_no: orderNo,
        pid: yipayPid,
        sitename: yipaySiteName,
        trade_status: "TRADE_SUCCESS",
    }
    const prestr = getVerifyParams(params)
    const sign = md5(prestr + yipayKey)
    return {
        ...params,
        sign,
        sign_type: "MD5",
    }
}

export function isYipayConfiguredForE2E(): boolean {
    const { yipayPid, yipayKey, yipaySubmitUrl, yipaySiteName } = config
    return !!(yipayPid && yipayKey && yipaySubmitUrl && yipaySiteName)
}
