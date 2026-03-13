import {
    generateExitDiscountToken,
    verifyExitDiscountToken,
    type ExitDiscountPayload,
} from "@/lib/exit-discount"

const SECRET = "test-secret-key"
const TTL_MS = 900_000 // 15 minutes

const basePayload: Omit<ExitDiscountPayload, "exp"> = {
    productId: "prod_123",
    visitorId: "visitor-uuid-abc",
    fingerprintHash: "fp-hash-xyz",
    ip: "127.0.0.1",
    discountPercent: 5,
}

describe("generateExitDiscountToken", () => {
    it("generates a token with base64url.signature format", () => {
        const token = generateExitDiscountToken(basePayload, SECRET, TTL_MS)
        expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
        // Should have exactly one dot separating payload and signature
        const parts = token.split(".")
        expect(parts).toHaveLength(2)
        expect(parts[0].length).toBeGreaterThan(0)
        expect(parts[1].length).toBeGreaterThan(0)
    })

    it("payload contains all provided fields and correct exp", () => {
        const before = Date.now()
        const token = generateExitDiscountToken(basePayload, SECRET, TTL_MS)
        const after = Date.now()

        const encoded = token.split(".")[0]
        const decoded = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as ExitDiscountPayload

        expect(decoded.productId).toBe(basePayload.productId)
        expect(decoded.visitorId).toBe(basePayload.visitorId)
        expect(decoded.fingerprintHash).toBe(basePayload.fingerprintHash)
        expect(decoded.ip).toBe(basePayload.ip)
        expect(decoded.discountPercent).toBe(basePayload.discountPercent)
        expect(decoded.exp).toBeGreaterThanOrEqual(before + TTL_MS)
        expect(decoded.exp).toBeLessThanOrEqual(after + TTL_MS)
    })
})

describe("verifyExitDiscountToken", () => {
    it("returns valid:true with correct payload when token is fresh and secret matches", () => {
        const token = generateExitDiscountToken(basePayload, SECRET, TTL_MS)
        const result = verifyExitDiscountToken(token, SECRET)

        expect(result.valid).toBe(true)
        if (result.valid) {
            expect(result.payload.productId).toBe(basePayload.productId)
            expect(result.payload.visitorId).toBe(basePayload.visitorId)
            expect(result.payload.fingerprintHash).toBe(basePayload.fingerprintHash)
            expect(result.payload.ip).toBe(basePayload.ip)
            expect(result.payload.discountPercent).toBe(basePayload.discountPercent)
        }
    })

    it("returns {valid:false, reason:'expired'} when token has passed exp", () => {
        const token = generateExitDiscountToken(basePayload, SECRET, TTL_MS)

        // 快进时间：模拟 exp 已过
        const dateSpy = jest.spyOn(Date, "now").mockReturnValue(Date.now() + TTL_MS + 1000)
        const result = verifyExitDiscountToken(token, SECRET)
        dateSpy.mockRestore()

        expect(result.valid).toBe(false)
        if (!result.valid) {
            expect(result.reason).toBe("expired")
        }
    })

    it("returns {valid:false, reason:'invalid'} when payload is tampered", () => {
        const token = generateExitDiscountToken(basePayload, SECRET, TTL_MS)
        const [encoded, sig] = token.split(".")
        // 修改 payload base64 中的某字符
        const tamperedEncoded = encoded.slice(0, -1) + (encoded.slice(-1) === "A" ? "B" : "A")
        const tamperedToken = `${tamperedEncoded}.${sig}`

        const result = verifyExitDiscountToken(tamperedToken, SECRET)
        expect(result.valid).toBe(false)
        if (!result.valid) {
            expect(result.reason).toBe("invalid")
        }
    })

    it("returns {valid:false, reason:'invalid'} when signature is tampered", () => {
        const token = generateExitDiscountToken(basePayload, SECRET, TTL_MS)
        const [encoded, sig] = token.split(".")
        const tamperedSig = sig.slice(0, -1) + (sig.slice(-1) === "A" ? "B" : "A")
        const tamperedToken = `${encoded}.${tamperedSig}`

        const result = verifyExitDiscountToken(tamperedToken, SECRET)
        expect(result.valid).toBe(false)
        if (!result.valid) {
            expect(result.reason).toBe("invalid")
        }
    })

    it("returns {valid:false, reason:'invalid'} when token has no dot separator", () => {
        const result = verifyExitDiscountToken("nodotinhere", SECRET)
        expect(result.valid).toBe(false)
        if (!result.valid) {
            expect(result.reason).toBe("invalid")
        }
    })

    it("returns {valid:false, reason:'invalid'} for empty string", () => {
        const result = verifyExitDiscountToken("", SECRET)
        expect(result.valid).toBe(false)
        if (!result.valid) {
            expect(result.reason).toBe("invalid")
        }
    })

    it("returns {valid:false, reason:'invalid'} when verified with wrong secret", () => {
        const token = generateExitDiscountToken(basePayload, SECRET, TTL_MS)
        const result = verifyExitDiscountToken(token, "wrong-secret")
        expect(result.valid).toBe(false)
        if (!result.valid) {
            expect(result.reason).toBe("invalid")
        }
    })

    it("returns {valid:false, reason:'invalid'} when payload is not valid JSON after decoding", () => {
        // Construct a token where encoded part is valid base64url but not JSON
        const { createHmac } = require("crypto")
        const encoded = Buffer.from("not-json!!!").toString("base64url")
        const sig = createHmac("sha256", SECRET).update(encoded).digest("base64url")
        const token = `${encoded}.${sig}`

        const result = verifyExitDiscountToken(token, SECRET)
        expect(result.valid).toBe(false)
        if (!result.valid) {
            expect(result.reason).toBe("invalid")
        }
    })

    it("different secrets produce different tokens", () => {
        const token1 = generateExitDiscountToken(basePayload, "secret-A", TTL_MS)
        const token2 = generateExitDiscountToken(basePayload, "secret-B", TTL_MS)
        expect(token1).not.toBe(token2)
    })
})
