import { prisma } from "@/lib/prisma"

export async function checkPurchaseLimit(params: {
  productId: string
  email: string
  fingerprintHash: string | null
  clientIp: string
  limitQuantity: number
}): Promise<{ blocked: boolean; orderNo?: string; message: string }> {
  const { productId, email, fingerprintHash, clientIp, limitQuantity } = params
  const emailLower = email.trim().toLowerCase()

  const emailSignal = { email: emailLower }
  const auxiliarySignals: object[] = []

  if (fingerprintHash) {
    auxiliarySignals.push({
      fingerprintHash,
      OR: [
        { email: emailLower },
        ...(clientIp !== "unknown" ? [{ clientIp }] : []),
      ],
    })
  }

  if (clientIp !== "unknown") {
    auxiliarySignals.push({
      clientIp,
      OR: [
        { email: emailLower },
        ...(fingerprintHash ? [{ fingerprintHash }] : []),
      ],
    })
  }

  const orCondition = [emailSignal, ...auxiliarySignals]

  const count = await prisma.order.count({
    where: {
      productId,
      status: "COMPLETED",
      OR: orCondition,
    },
  })

  if (count < limitQuantity) {
    return { blocked: false, message: "" }
  }

  const existingOrder = await prisma.order.findFirst({
    where: {
      productId,
      status: "COMPLETED",
      OR: orCondition,
    },
    select: { orderNo: true, email: true },
  })

  const message = `该商品限购 ${limitQuantity} 件，您已购买 ${count} 件。`
  const isOwnOrder = existingOrder?.email === emailLower

  return {
    blocked: true,
    ...(isOwnOrder && existingOrder ? { orderNo: existingOrder.orderNo } : {}),
    message,
  }
}
