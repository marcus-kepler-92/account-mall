import { parseLeadFilters } from "@/app/admin/(main)/agent/leads/leads-filters"

describe("parseLeadFilters — status / urgency / sessionId / q normalization", () => {
    it("returns all undefined defaults on empty input", () => {
        const r = parseLeadFilters({})
        expect(r.status).toBeUndefined()
        expect(r.urgency).toBeUndefined()
        expect(r.sessionId).toBeUndefined()
        expect(r.q).toBe("")
        expect(r.page).toBe(1)
        expect(r.pageSize).toBe(20)
    })

    it("whitelists status values", () => {
        for (const s of ["PENDING_CONTACT", "NEW", "CONTACTED", "RESOLVED", "DROPPED"]) {
            expect(parseLeadFilters({ status: s }).status).toBe(s)
        }
        expect(parseLeadFilters({ status: "BOGUS" }).status).toBeUndefined()
    })

    it("whitelists urgency values", () => {
        for (const u of ["LOW", "MED", "HIGH"]) {
            expect(parseLeadFilters({ urgency: u }).urgency).toBe(u)
        }
        expect(parseLeadFilters({ urgency: "EXTREME" }).urgency).toBeUndefined()
    })

    it("clamps page and pageSize to safe ranges", () => {
        expect(parseLeadFilters({ page: "-5" }).page).toBe(1)
        expect(parseLeadFilters({ page: "abc" }).page).toBe(1)
        expect(parseLeadFilters({ pageSize: "0" }).pageSize).toBe(20) // falsy → default
        expect(parseLeadFilters({ pageSize: "999" }).pageSize).toBe(100)
        expect(parseLeadFilters({ pageSize: "50" }).pageSize).toBe(50)
    })

    it("trims q whitespace", () => {
        expect(parseLeadFilters({ q: "   foo  " }).q).toBe("foo")
        expect(parseLeadFilters({ q: undefined }).q).toBe("")
    })

    describe("sessionId filter (drives 回头客 N 次 drill-down)", () => {
        it("accepts a ULID-length string (26 chars)", () => {
            const id = "01HXXXXXXXXXXXXXXXXXXXXXXX"
            expect(parseLeadFilters({ sessionId: id }).sessionId).toBe(id)
        })

        it("accepts the documented bounds (20-40 chars)", () => {
            const minLen = "a".repeat(20)
            const maxLen = "a".repeat(40)
            expect(parseLeadFilters({ sessionId: minLen }).sessionId).toBe(minLen)
            expect(parseLeadFilters({ sessionId: maxLen }).sessionId).toBe(maxLen)
        })

        it("rejects strings outside bounds — silent drop so a bad URL just shows default view", () => {
            expect(parseLeadFilters({ sessionId: "short" }).sessionId).toBeUndefined()
            expect(parseLeadFilters({ sessionId: "a".repeat(41) }).sessionId).toBeUndefined()
            expect(parseLeadFilters({ sessionId: "" }).sessionId).toBeUndefined()
        })

        it("trims whitespace", () => {
            const id = "01HXXXXXXXXXXXXXXXXXXXXXXX"
            expect(parseLeadFilters({ sessionId: `  ${id}  ` }).sessionId).toBe(id)
        })
    })
})
