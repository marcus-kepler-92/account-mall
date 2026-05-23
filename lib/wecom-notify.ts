import { prisma } from "@/lib/prisma"
import { getSiteSettings } from "@/lib/site-settings"
import { config } from "@/lib/config"

export type WecomEvent = "order.awaiting_fulfillment" | "order.dun"

type OrderForNotify = {
  id: string
  orderNo: string
  amount: { toString(): string }
  email: string
  status: string
  productNameSnapshot: string | null
  variantNameSnapshot: string | null
  dunCount?: number
}

function buildMarkdown(event: WecomEvent, order: OrderForNotify): string {
  const adminLink = `${config.siteUrl}/admin/orders/${order.id}`
  const sku = order.variantNameSnapshot ?? "—"
  const product = order.productNameSnapshot ?? "—"
  switch (event) {
    case "order.awaiting_fulfillment":
      return [
        `### 🆕 新订单待发货`,
        `> 商品：**${product}**`,
        `> 规格：${sku}`,
        `> 金额：¥${order.amount.toString()}`,
        `> 买家：${order.email}`,
        `> 订单号：\`${order.orderNo}\``,
        `[在后台处理](${adminLink})`,
      ].join("\n")
    case "order.dun":
      return [
        `### ⏰ 买家催发货（已累计 ${order.dunCount ?? 1} 次）`,
        `> 商品：**${product}**`,
        `> 规格：${sku}`,
        `> 订单号：\`${order.orderNo}\``,
        `[立刻处理](${adminLink})`,
      ].join("\n")
  }
}

export async function sendWecomNotification(event: WecomEvent, order: OrderForNotify): Promise<void> {
  const settings = await getSiteSettings()
  const url = settings.wecomWebhookUrl
  if (!url) return

  const content = buildMarkdown(event, order)
  const payload = { msgtype: "markdown", markdown: { content } }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      await logFail(event, payload, order.id, `HTTP ${res.status}`)
      return
    }
    await prisma.notificationLog.create({
      data: {
        channel: "wecom", event, payload: JSON.stringify(payload),
        status: "sent", orderId: order.id,
      },
    })
  } catch (err) {
    await logFail(event, payload, order.id, err instanceof Error ? err.message : String(err))
  }
}

async function logFail(event: WecomEvent, payload: unknown, orderId: string, error: string) {
  try {
    await prisma.notificationLog.create({
      data: {
        channel: "wecom", event, payload: JSON.stringify(payload),
        status: "failed", error, orderId,
      },
    })
  } catch (logErr) {
    console.error("[wecom-notify] failed to log failure", logErr)
  }
}
