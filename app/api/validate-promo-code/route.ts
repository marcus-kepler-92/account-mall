import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { config } from "@/lib/config"
import { checkValidatePromoCodeRateLimit } from "@/lib/rate-limit"

/**
 * GET /api/validate-promo-code?promoCode=XXX
 * Returns whether the code matches an enabled distributor and the discount percent (if any).
 * Rate limited per IP. Used by product order form with debounce.
 */
export async function GET(request: NextRequest) {
    const rateLimitRes = await checkValidatePromoCodeRateLimit(request)
    if (rateLimitRes) return rateLimitRes

    const promoCode = request.nextUrl.searchParams.get("promoCode")?.trim()
    if (!promoCode || promoCode.length < 1 || promoCode.length > config.promoCodeMaxLength) {
        return NextResponse.json({ valid: false, discountPercent: null })
    }

    const distributor = await prisma.user.findFirst({
        where: {
            distributorCode: promoCode,
            role: "DISTRIBUTOR",
            disabledAt: null,
        },
        select: { id: true, discountCodeEnabled: true, discountPercent: true },
    })

    if (!distributor) {
        return NextResponse.json({ valid: false, discountPercent: null })
    }

    let discountPercent: number | null = null
    if (distributor.discountCodeEnabled && distributor.discountPercent != null) {
        const pct = Number(distributor.discountPercent)
        if (pct > 0 && pct <= 100) discountPercent = pct
    }

    return NextResponse.json({ valid: true, discountPercent })
}
