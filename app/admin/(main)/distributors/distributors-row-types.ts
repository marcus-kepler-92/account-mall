export type DistributorRow = {
    id: string
    email: string | null
    username: string | null
    name: string
    distributorCode: string | null
    discountCodeEnabled: boolean
    discountPercent: number | null
    disabledAt: string | null
    createdAt: string
    completedOrderCount: number
    salesTotal: number
    weeklySalesTotal: number
    totalCommission: number
    level1CommissionTotal: number
    level2CommissionTotal: number
    level1Settled: number
    level2Settled: number
    paidTotal: number
    pendingTotal: number
    withdrawableBalance: number
    inviteeCount: number
    invitees: { id: string; name: string; distributorCode: string | null }[]
    inviter: { id: string; name: string; distributorCode: string | null } | null
    milestoneSummary: {
        triggeredCount: number
        nextMilestone: { thresholdAmount: number; thresholdCount: number; bonusAmount: number } | null
    } | null
}
