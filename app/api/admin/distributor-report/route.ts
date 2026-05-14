import { NextResponse } from "next/server"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, badRequest } from "@/lib/api-response"
import { fromZonedTime } from "date-fns-tz"
import { getDistributorReport } from "@/lib/domains/distributors"

export type DistributorReportResponse = {
  summary: {
    /** 全局待支付余额 = 所有 SETTLED 佣金 + 奖金 - 已审批提现 - 待审提现 */
    unpaidBalance: number
    /** 期间已结佣金（含里程碑奖金） */
    settledCommission: number
    distributorCount: number
    newDistributorCount: number
  }
  leaderboard: Array<{
    distributorId: string
    name: string | null
    email: string
    revenue: number
    orderCount: number
    /** 期间产生的佣金（不含已取消） */
    periodCommission: number
  }>
  newDistributors: Array<{
    id: string
    name: string | null
    email: string
    inviterName: string | null
    inviterEmail: string | null
    createdAt: string
  }>
}

const HKT = "Asia/Hong_Kong"
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isValidCalendarDate(y: number, m: number, d: number): boolean {
  const date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
}

export async function GET(request: Request): Promise<NextResponse> {
  const session = await getAdminSession()
  if (!session) return unauthorized()
  const { searchParams } = new URL(request.url)
  const from = searchParams.get("from") ?? ""
  const to = searchParams.get("to") ?? ""
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) return badRequest("from and to must be YYYY-MM-DD")
  if (from > to) return badRequest("from must not be after to")
  const [fy, fm, fd] = from.split("-").map(Number)
  const [ty, tm, td] = to.split("-").map(Number)
  if (!isValidCalendarDate(fy, fm, fd) || !isValidCalendarDate(ty, tm, td)) return badRequest("from and to must be valid calendar dates")
  const startUTC = fromZonedTime(new Date(fy, fm - 1, fd, 0, 0, 0, 0), HKT)
  const endUTC = fromZonedTime(new Date(ty, tm - 1, td + 1, 0, 0, 0, 0), HKT)
  const data = await getDistributorReport(startUTC, endUTC)
  return NextResponse.json<DistributorReportResponse>(data)
}

export const runtime = "nodejs"
