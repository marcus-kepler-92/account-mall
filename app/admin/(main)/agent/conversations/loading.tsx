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

// No explicit TableHead width — that fights <table> auto-layout and causes
// layout shift when real data arrives. Instead, size each Skeleton to
// approximate the real text width per column; <table> auto-layout will
// then size columns the same way it does with real text.
// Reference: conversations-columns.tsx (visible text in each cell):
//   ID slice(0,8) | fp slice(0,6) | num | num | "是" badge | ✓ | "yyyy/MM/dd HH:mm"
const COLS = [
    { header: "w-12", body: "w-16" }, // 会话 ID (8 mono chars)
    { header: "w-8", body: "w-12" }, // 指纹 (6 mono chars)
    { header: "w-10", body: "w-6" }, // 消息数 (1-3 digits)
    { header: "w-12", body: "w-12" }, // Tokens (1-6 digits)
    { header: "w-8", body: "w-8" }, // 升级 (badge)
    { header: "w-10", body: "w-4" }, // 跟进单 (✓)
    { header: "w-16", body: "w-28" }, // 开始时间 (yyyy/MM/dd HH:mm)
]

export default function ConversationsLoading() {
    return (
        <div className="space-y-6">
            <div className="space-y-1.5">
                <Skeleton className="h-7 w-24" />
                <Skeleton className="h-4 w-80 max-w-full" />
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-8 w-[200px] lg:w-[300px] rounded-md" />
                <Skeleton className="h-8 w-[200px] rounded-md" />
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
