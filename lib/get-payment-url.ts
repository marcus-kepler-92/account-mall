import { getAlipayPagePayUrl, getAlipayWapPayUrl } from "@/lib/alipay"
import { isZpayConfigured, getZpayPagePayUrl, type ZpayChannelConfig } from "@/lib/zpay"
import { config } from "@/lib/config"

export type ClientType = "pc" | "wap"

export interface GetPaymentUrlParams {
    orderNo: string
    totalAmount: string
    subject: string
    clientType?: ClientType
    /** 支付渠道: "alipay" | "wxpay" | "qqpay"，仅在使用z-pay时生效 */
    paymentMethod?: string
    /** DB 渠道配置，有则优先使用；null/undefined 时 fallback 到 env var */
    channel?: ZpayChannelConfig | null
}

/**
 * 根据订单信息生成支付跳转 URL（z-pay或支付宝 PC/Wap）。
 * 未配置支付或生成失败时返回 null。
 */
export function getPaymentUrlForOrder(params: GetPaymentUrlParams): string | null {
    const { orderNo, totalAmount, clientType = "pc", paymentMethod = "alipay", channel } = params
    // Always use the compliance label as the payment subject, never expose product names
    const subject = config.paymentSubjectLabel
    const useZpay = channel != null || isZpayConfigured()
    return useZpay
        ? getZpayPagePayUrl({
              orderNo,
              totalAmount,
              subject,
              type: paymentMethod,
              channel: channel ?? undefined,
          })
        : clientType === "wap"
          ? getAlipayWapPayUrl({ orderNo, totalAmount, subject })
          : getAlipayPagePayUrl({ orderNo, totalAmount, subject })
}
