import { parseConvFilters } from "@/app/admin/(main)/agent/conversations/conversations-filters"

describe("parseConvFilters", () => {
    it("returns sensible defaults for empty input", () => {
        const r = parseConvFilters({})
        expect(r.q).toBe("")
        expect(r.orderNo).toBe("")
        expect(r.from).toBeUndefined()
        expect(r.to).toBeUndefined()
        expect(r.escalated).toBeUndefined()
        expect(r.page).toBe(1)
        expect(r.pageSize).toBe(20)
    })

    it("trims q whitespace", () => {
        expect(parseConvFilters({ q: "  refund  " }).q).toBe("refund")
    })

    describe("orderNo dedicated input", () => {
        it("accepts a normal order number (8 chars)", () => {
            expect(parseConvFilters({ orderNo: "OD123456" }).orderNo).toBe("OD123456")
        })

        it("trims whitespace before length-checking", () => {
            expect(parseConvFilters({ orderNo: "   OD20260521   " }).orderNo).toBe(
                "OD20260521",
            )
        })

        it("drops too-short input — prevents wide ILIKE on a stray search term", () => {
            // ops accidentally pasting "ab" into the orderNo box should
            // silently disable the orderNo filter, not run a runaway scan.
            expect(parseConvFilters({ orderNo: "ab" }).orderNo).toBe("")
            expect(parseConvFilters({ orderNo: "12345" }).orderNo).toBe("") // 5 < 6
        })

        it("drops too-long input — orderNo never exceeds 40 chars in this codebase", () => {
            expect(parseConvFilters({ orderNo: "a".repeat(41) }).orderNo).toBe("")
        })

        it("treats empty / undefined as 'no filter'", () => {
            expect(parseConvFilters({ orderNo: "" }).orderNo).toBe("")
            expect(parseConvFilters({ orderNo: undefined }).orderNo).toBe("")
        })
    })

    it("only treats escalated=true as the truthy filter (no string coercion surprises)", () => {
        expect(parseConvFilters({ escalated: "true" }).escalated).toBe(true)
        expect(parseConvFilters({ escalated: "TRUE" }).escalated).toBeUndefined()
        expect(parseConvFilters({ escalated: "false" }).escalated).toBeUndefined()
        expect(parseConvFilters({ escalated: "1" }).escalated).toBeUndefined()
    })

    it("clamps page and pageSize to safe ranges", () => {
        expect(parseConvFilters({ page: "-3" }).page).toBe(1)
        expect(parseConvFilters({ page: "abc" }).page).toBe(1)
        expect(parseConvFilters({ pageSize: "0" }).pageSize).toBe(20) // falsy → default
        expect(parseConvFilters({ pageSize: "5000" }).pageSize).toBe(100)
        expect(parseConvFilters({ pageSize: "50" }).pageSize).toBe(50)
    })

    it("parses ISO date strings into from/to", () => {
        const r = parseConvFilters({
            from: "2026-05-01T00:00:00Z",
            to: "2026-05-31T23:59:59Z",
        })
        expect(r.from?.toISOString()).toBe("2026-05-01T00:00:00.000Z")
        expect(r.to?.toISOString()).toBe("2026-05-31T23:59:59.000Z")
    })

    it("drops invalid date strings (no NaN dates leak through)", () => {
        const r = parseConvFilters({ from: "not-a-date", to: "also-not" })
        expect(r.from).toBeUndefined()
        expect(r.to).toBeUndefined()
    })
})
