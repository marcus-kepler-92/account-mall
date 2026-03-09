import { NextRequest, NextResponse } from "next/server"
import { config } from "@/lib/config"

const PROMO_COOKIE_NAME = "distributor_promo_code"
const PROMO_COOKIE_MAX_AGE_DAYS = 30

/**
 * GET /api/set-promo-cookie?promoCode=XXX
 * Sets distributor_promo_code cookie when promoCode is valid (1–config.promoCodeMaxLength chars).
 * Used by client-side hook to sync URL promoCode to cookie (e.g. after client-side nav).
 */
export async function GET(request: NextRequest) {
    const promoCode = request.nextUrl.searchParams.get("promoCode")?.trim()
    if (!promoCode || promoCode.length < 1 || promoCode.length > config.promoCodeMaxLength) {
        return NextResponse.json({ ok: false }, { status: 400 })
    }

    const res = NextResponse.json({ ok: true })
    res.cookies.set(PROMO_COOKIE_NAME, promoCode, {
        path: "/",
        maxAge: PROMO_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60,
        sameSite: "lax",
        httpOnly: true,
        secure: request.nextUrl.protocol === "https:",
    })
    return res
}
