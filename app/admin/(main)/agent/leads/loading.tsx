import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

// Match real cell text widths so <table> auto-layout produces the same
// column distribution. Reference: leads-columns.tsx
//   状态 badge | 紧急度 badge | wechat mono≤14ch | UUID 36ch | reason max-24ch | yyyy/MM/dd HH:mm | 8ch+badge | actions
const COLS = [
    { header: "w-8", body: "w-12" }, // 状态 (badge "待跟进")
    { header: "w-10", body: "w-6" }, // 紧急度 (badge "中")
    { header: "w-10", body: "w-4" }, // 微信号 (often "—")
    { header: "w-12", body: "w-56" }, // 订单号 (UUID ~250px)
    { header: "w-8", body: "w-40" }, // 原因 (max-24ch ~170px)
    { header: "w-16", body: "w-28" }, // 创建时间 (16ch ~112px)
    { header: "w-8", body: "w-20" }, // 会话 (8 mono chars)
    { header: "w-8", body: "w-6" }, // 操作 (icon button)
]

export default function LeadsLoading() {
    return (
        <div className="space-y-6">
            <div className="space-y-1.5">
                <Skeleton className="h-7 w-24" />
                <Skeleton className="h-4 w-[26rem] max-w-full" />
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-6 w-44 rounded-full" />
                <Skeleton className="h-6 w-28 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
            </div>

            <Card>
                <CardHeader className="pb-4">
                    <Skeleton className="h-5 w-20" />
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                    <Separator />
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {COLS.map((c, i) => (
                                        <TableHead key={i}>
                                            <Skeleton className={`h-4 ${c.header}`} />
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Array.from({ length: 10 }).map((_, ri) => (
                                    <TableRow key={ri}>
                                        {COLS.map((c, ci) => (
                                            <TableCell key={ci}>
                                                <Skeleton className={`h-4 ${c.body}`} />
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                        <Skeleton className="h-4 w-24" />
                        <div className="flex flex-wrap items-center gap-4">
                            <Skeleton className="h-8 w-20" />
                            <Skeleton className="h-4 w-20" />
                            <div className="flex items-center gap-1">
                                <Skeleton className="size-8" />
                                <Skeleton className="size-8" />
                                <Skeleton className="size-8" />
                                <Skeleton className="size-8" />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
