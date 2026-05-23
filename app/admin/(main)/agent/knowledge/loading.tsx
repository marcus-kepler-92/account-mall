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

// Reference: knowledge-columns.tsx
//   title truncated max-280px | tags max-260px | status badge | yyyy/MM/dd HH:mm | actions
const COLS = [
    { header: "w-10", body: "w-64" }, // 标题 (truncated max-280px)
    { header: "w-10", body: "w-44" }, // 标签 (multi badges, max-260px)
    { header: "w-10", body: "w-12" }, // 状态 (badge "已发布")
    { header: "w-16", body: "w-28" }, // 更新时间 (yyyy/MM/dd HH:mm)
    { header: "w-8", body: "w-6" }, // 操作 (icon button)
]

export default function KnowledgeLoading() {
    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
                <div className="space-y-1.5">
                    <Skeleton className="h-7 w-20" />
                    <Skeleton className="h-4 w-72 max-w-full" />
                </div>
                <Skeleton className="h-9 w-20" />
            </div>

            <Card>
                <CardHeader className="pb-4">
                    <Skeleton className="h-5 w-20" />
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap flex-1 items-center gap-2">
                            <Skeleton className="h-8 w-[180px] lg:w-[280px] rounded-md" />
                            <div className="flex items-center gap-1">
                                <Skeleton className="h-6 w-12 rounded-full" />
                                <Skeleton className="h-6 w-12 rounded-full" />
                                <Skeleton className="h-6 w-16 rounded-full" />
                                <Skeleton className="h-6 w-16 rounded-full" />
                            </div>
                        </div>
                        <Skeleton className="h-8 w-20" />
                    </div>
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
