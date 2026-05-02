"use client"

import { Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { WithdrawalRow } from "./withdrawals-columns"

interface WithdrawalRowActionsProps {
    row: WithdrawalRow
    onProcess: (row: WithdrawalRow) => void
}

export function WithdrawalRowActions({ row, onProcess }: WithdrawalRowActionsProps) {
    if (row.status !== "PENDING") return null

    return (
        <Button size="sm" variant="outline" onClick={() => onProcess(row)}>
            <Settings2 className="size-4" />
            处理
        </Button>
    )
}
