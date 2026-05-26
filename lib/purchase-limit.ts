import { prisma } from "@/lib/prisma"

export async function checkPurchaseLimit(params: {
  productId: string
  email: string
  fingerprintHash: string | null
  clientIp: string
  limitQuantity: number
  productType?: string
}): Promise<{ blocked: boolean; orderNo?: string; message: string }> {
  const { productId, email, fingerprintHash, clientIp, limitQuantity, productType } = params

  // MANUAL products are exempt from purchase-limit: each SKU/variant is
  // priced independently and stocked by hand, so the per-email limit driven
  // by card-based products doesn't apply. Spec non-goal.
  if (productType === "MANUAL") {
    return { blocked: false, message: "" }
  }

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
