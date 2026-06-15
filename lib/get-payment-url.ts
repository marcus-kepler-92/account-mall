import { getAlipayPagePayUrl, getAlipayWapPayUrl } from "@/lib/alipay"
import { isZpayConfigured, getZpayPagePayUrl } from "@/lib/zpay"
import { config } from "@/lib/config"

export type ClientType = "pc" | "wap"

export interface GetPaymentUrlParams {
    orderNo: string
    totalAmount: string
    subject: string
    clientType?: ClientType
    /** 支付渠道: "alipay" | "wxpay" | "qqpay" */
    paymentMethod?: string
}

/**
 * 根据订单信息生成支付跳转 URL（z-pay 或支付宝 PC/Wap）。
 * 未配置支付或生成失败时返回 null。
 */
export function getPaymentUrlForOrder(params: GetPaymentUrlParams): string | null {
    const { orderNo, totalAmount, clientType = "pc", paymentMethod = "alipay" } = params
    // Always use the compliance label as the payment subject, never expose product names
    const subject = config.paymentSubjectLabel
    return isZpayConfigured()
        ? getZpayPagePayUrl({ orderNo, totalAmount, subject, type: paymentMethod })
        : clientType === "wap"
          ? getAlipayWapPayUrl({ orderNo, totalAmount, subject })
          : getAlipayPagePayUrl({ orderNo, totalAmount, subject })
}
