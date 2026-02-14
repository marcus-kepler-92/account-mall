import {
    getDateRange,
    getDaysForTrend,
    isInDay,
} from "@/app/admin/(main)/dashboard/dashboard-utils"
import { ORDER_STATUS_LABEL } from "@/app/admin/(main)/dashboard/types"

describe("dashboard-utils", () => {
    describe("getDateRange", () => {
        it("returns start and end for given offset and span", () => {
            const { start, end } = getDateRange(0, 7)
            expect(start).toBeInstanceOf(Date)
            expect(end).toBeInstanceOf(Date)
            expect(end.getTime()).toBeGreaterThan(start.getTime())
        })

        it("end is exclusive of next day when span is 7", () => {
            const { start, end } = getDateRange(6, 7)
            const diffDays = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
            expect(diffDays).toBe(7)
        })
    })

    describe("getDaysForTrend", () => {
        it("returns array of length equal to days", () => {
            expect(getDaysForTrend(7)).toHaveLength(7)
            expect(getDaysForTrend(30)).toHaveLength(30)
        })

        it("each element is a Date at midnight", () => {
            const days = getDaysForTrend(3)
            days.forEach((d) => {
                expect(d.getHours()).toBe(0)
                expect(d.getMinutes()).toBe(0)
                expect(d.getSeconds()).toBe(0)
            })
        })

        it("returns consecutive days", () => {
            const days = getDaysForTrend(3)
            const msPerDay = 24 * 60 * 60 * 1000
            expect(days[1].getTime() - days[0].getTime()).toBe(msPerDay)
            expect(days[2].getTime() - days[1].getTime()).toBe(msPerDay)
        })
    })

    describe("isInDay", () => {
        it("returns true when ts is within dayStart and next day", () => {
            const dayStart = new Date("2024-02-14T00:00:00.000Z")
            const noon = new Date("2024-02-14T12:00:00.000Z")
            expect(isInDay(noon, dayStart)).toBe(true)
        })

        it("returns false when ts is before dayStart", () => {
            const dayStart = new Date("2024-02-14T00:00:00.000Z")
            const before = new Date("2024-02-13T23:59:59.000Z")
            expect(isInDay(before, dayStart)).toBe(false)
        })

        it("returns false when ts is on or after next day", () => {
            const dayStart = new Date("2024-02-14T00:00:00.000Z")
            const nextDay = new Date("2024-02-15T00:00:00.000Z")
            expect(isInDay(nextDay, dayStart)).toBe(false)
        })
    })
})

describe("ORDER_STATUS_LABEL", () => {
    it("maps all order statuses to Chinese labels", () => {
        expect(ORDER_STATUS_LABEL.PENDING).toBe("待支付")
        expect(ORDER_STATUS_LABEL.COMPLETED).toBe("已完成")
        expect(ORDER_STATUS_LABEL.CLOSED).toBe("已关闭")
    })
})
