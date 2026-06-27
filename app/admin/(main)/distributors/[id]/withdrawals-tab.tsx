import Link from "next/link"
import { listDistributorWithdrawals } from "@/lib/domains/distributors"
import { parseDetailPaging } from "./data"
import { DistributorWithdrawalsDataTable } from "./withdrawals-data-table"
import type { DistributorWithdrawalRow } from "./withdrawals-columns"

export async function WithdrawalsTab({
    distributorId,
    searchParams,
}: {
    distributorId: string
    searchParams: Record<string, string | undefined>
}) {
    const { page, pageSize } = parseDetailPaging(searchParams)
    const result = await listDistributorWithdrawals(distributorId, page, pageSize)

    const data: DistributorWithdrawalRow[] = result.data.map((w) => ({
        id: w.id,
        amount: w.amount,
        feePercent: w.feePercent,
        feeAmount: w.feeAmount,
        actualAmount: w.actualAmount,
        status: w.status as DistributorWithdrawalRow["status"],
        receiptImageUrl: w.receiptImageUrl,
        note: w.note,
        processedAt: w.processedAt ? w.processedAt.toISOString() : null,
        createdAt: w.createdAt.toISOString(),
    }))

    return (
        <div className="space-y-3">
            <DistributorWithdrawalsDataTable data={data} total={result.meta.total} />
            <p className="text-xs text-muted-foreground">
                提现的打款 / 拒绝操作请在{" "}
                <Link href="/admin/withdrawals" className="text-primary hover:underline">
                    提现管理
                </Link>{" "}
                中处理。
            </p>
        </div>
    )
}
