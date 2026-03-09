import { NextRequest } from "next/server"
import { GET } from "@/app/api/set-promo-cookie/route"

jest.mock("@/lib/config", () => ({
    config: { promoCodeMaxLength: 64 },
}))

describe("GET /api/set-promo-cookie", () => {
    it("returns 200 and sets distributor_promo_code cookie when promoCode is valid", async () => {
        const req = new NextRequest("http://localhost:3000/api/set-promo-cookie?promoCode=ABC")
        const res = await GET(req)
        expect(res.status).toBe(200)
        const setCookie = res.headers.get("set-cookie")
        expect(setCookie).toBeTruthy()
        expect(setCookie).toContain("distributor_promo_code=ABC")
        expect(setCookie).toMatch(/Max-Age=\d+/)
    })

    it("returns 400 when promoCode is missing", async () => {
        const req = new NextRequest("http://localhost:3000/api/set-promo-cookie")
        const res = await GET(req)
        expect(res.status).toBe(400)
    })

    it("returns 400 when promoCode is empty after trim", async () => {
        const req = new NextRequest("http://localhost:3000/api/set-promo-cookie?promoCode=%20%20")
        const res = await GET(req)
        expect(res.status).toBe(400)
    })

    it("returns 400 when promoCode exceeds 64 chars", async () => {
        const long = "a".repeat(65)
        const req = new NextRequest(`http://localhost:3000/api/set-promo-cookie?promoCode=${encodeURIComponent(long)}`)
        const res = await GET(req)
        expect(res.status).toBe(400)
    })

    it("returns 200 and sets cookie when promoCode is exactly 64 chars", async () => {
        const code = "a".repeat(64)
        const req = new NextRequest(`http://localhost:3000/api/set-promo-cookie?promoCode=${encodeURIComponent(code)}`)
        const res = await GET(req)
        expect(res.status).toBe(200)
        const setCookie = res.headers.get("set-cookie")
        expect(setCookie).toContain(`distributor_promo_code=${code}`)
    })
})
