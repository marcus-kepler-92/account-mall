"use client"

import Link from "next/link"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { usePendingWithdrawals } from "@/app/admin/hooks/use-pending-withdrawals"

export function DashboardPendingWithdrawals() {
  const { count, isLoading } = usePendingWithdrawals()

  if (isLoading || count === 0) return null

  return (
    <div className="flex items-center justify-between rounded-md border border-l-4 border-l-destructive bg-destructive/5 px-4 py-3">
      <div className="flex items-center gap-3">
        <AlertCircle className="size-4 shrink-0 text-destructive" />
        <p className="text-sm font-medium text-destructive">
          {count} 笔提现申请待审核
        </p>
      </div>
      <Button size="sm" variant="destructive" asChild>
        <Link href="/admin/withdrawals?status=PENDING">立即审核</Link>
      </Button>
    </div>
  )
}
