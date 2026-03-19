"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Download, Loader2, ChevronDown } from "lucide-react"

type CardStatus = "UNSOLD" | "RESERVED" | "SOLD" | "DISABLED"

type StatusCounts = Record<CardStatus, number>

type ExportCardsProps = {
    productId: string
    statusCounts: StatusCounts
}

const STATUS_OPTIONS: { status: CardStatus; label: string }[] = [
    { status: "UNSOLD", label: "导出未售卡密" },
    { status: "SOLD", label: "导出已售卡密" },
    { status: "DISABLED", label: "导出停用卡密" },
]

async function triggerDownload(url: string) {
    const res = await fetch(url)
    if (!res.ok) {
        throw new Error("导出失败")
    }
    const blob = await res.blob()
    const disposition = res.headers.get("Content-Disposition") ?? ""
    const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)["']?/i)
    const filename = match ? decodeURIComponent(match[1]) : "卡密.txt"
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = objectUrl
    a.download = filename
    a.click()
    URL.revokeObjectURL(objectUrl)
}

export function ExportCards({ productId, statusCounts }: ExportCardsProps) {
    const [loading, setLoading] = useState(false)

    const total = Object.values(statusCounts).reduce((sum, n) => sum + n, 0)

    const handleExport = async (status?: CardStatus) => {
        setLoading(true)
        try {
            const url = status
                ? `/api/products/${productId}/cards/export?status=${status}`
                : `/api/products/${productId}/cards/export`
            await triggerDownload(url)
        } catch {
            toast.error("导出失败，请稍后重试")
        } finally {
            setLoading(false)
        }
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={total === 0 || loading}>
                    {loading ? (
                        <Loader2 className="size-4 animate-spin" />
                    ) : (
                        <Download className="size-4" />
                    )}
                    导出卡密
                    <ChevronDown className="size-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {STATUS_OPTIONS.map(({ status, label }) => (
                    <DropdownMenuItem
                        key={status}
                        disabled={statusCounts[status] === 0}
                        onClick={() => handleExport(status)}
                    >
                        {label}
                        <span className="ml-auto pl-4 text-muted-foreground tabular-nums">
                            {statusCounts[status]}
                        </span>
                    </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    disabled={total === 0}
                    onClick={() => handleExport()}
                >
                    导出全部卡密
                    <span className="ml-auto pl-4 text-muted-foreground tabular-nums">
                        {total}
                    </span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
