import { getAlipayPagePayUrl, getAlipayWapPayUrl } from "@/lib/alipay"
import { isYipayConfigured, getYipayPagePayUrl, type YipayChannelConfig } from "@/lib/yipay"

export type ClientType = "pc" | "wap"

export interface GetPaymentUrlParams {
    orderNo: string
    totalAmount: string
    subject: string
    clientType?: ClientType
    /** 支付渠道: "alipay" | "wxpay" | "qqpay"，仅在使用易支付时生效 */
    paymentMethod?: string
    /** DB 渠道配置，有则优先使用；null/undefined 时 fallback 到 env var */
    channel?: YipayChannelConfig | null
}

/**
 * 根据订单信息生成支付跳转 URL（易支付或支付宝 PC/Wap）。
 * 未配置支付或生成失败时返回 null。
 */
export function getPaymentUrlForOrder(params: GetPaymentUrlParams): string | null {
    const { orderNo, totalAmount, subject, clientType = "pc", paymentMethod = "alipay", channel } = params
    const useYipay = channel != null || isYipayConfigured()
    return useYipay
        ? getYipayPagePayUrl({
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
