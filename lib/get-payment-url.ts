import { getAlipayPagePayUrl, getAlipayWapPayUrl } from "@/lib/alipay"
import { isYipayConfigured, getYipayPagePayUrl } from "@/lib/yipay"

export type ClientType = "pc" | "wap"

export interface GetPaymentUrlParams {
    orderNo: string
    totalAmount: string
    subject: string
    clientType?: ClientType
    /** 支付渠道: "alipay" | "wxpay" | "qqpay"，仅在使用易支付时生效 */
    paymentMethod?: string
}

/**
 * 根据订单信息生成支付跳转 URL（易支付或支付宝 PC/Wap）。
 * 未配置支付或生成失败时返回 null。
 */
export function getPaymentUrlForOrder(params: GetPaymentUrlParams): string | null {
    const { orderNo, totalAmount, subject, clientType = "pc", paymentMethod = "alipay" } = params
    return isYipayConfigured()
        ? getYipayPagePayUrl({ orderNo, totalAmount, subject, type: paymentMethod })
        : clientType === "wap"
          ? getAlipayWapPayUrl({ orderNo, totalAmount, subject })
          : getAlipayPagePayUrl({ orderNo, totalAmount, subject })
}
