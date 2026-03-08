"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

type ListPaginationProps = {
    page: number
    totalPages: number
    total: number
    buildPageUrl: (page: number) => string
}

export function ListPagination({
    page,
    totalPages,
    total,
    buildPageUrl,
}: ListPaginationProps) {
    return (
        <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">共 {total} 条</p>
            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" asChild disabled={page <= 1}>
                    <Link href={buildPageUrl(page - 1)}>
                        <ChevronLeft className="size-4" />
                        上一页
                    </Link>
                </Button>
                <span className="text-sm">
                    {page} / {totalPages}
                </span>
                <Button variant="outline" size="sm" asChild disabled={page >= totalPages}>
                    <Link href={buildPageUrl(page + 1)}>
                        下一页
                        <ChevronRight className="size-4" />
                    </Link>
                </Button>
            </div>
        </div>
    )
}
