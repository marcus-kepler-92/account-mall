"use client"

import Image from "next/image"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { formatCurrency } from "@/lib/utils"

type ReceiptCellProps = {
    url: string | null
    distributorName: string
    actualAmount: number
    amount: number
    feeAmount: number
    feePercent: number
}

export function ReceiptCell({ url, distributorName, actualAmount, amount, feeAmount, feePercent }: ReceiptCellProps) {
    const [open, setOpen] = useState(false)
    if (!url) return <span className="text-muted-foreground text-sm">—</span>
    return (
        <>
            <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-primary hover:underline"
                onClick={() => setOpen(true)}
            >
                查看
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-[90vw] sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>收款码 · {distributorName}</DialogTitle>
                    </DialogHeader>

                    {/* Amount banner — the number you need to type when paying */}
                    <div className="rounded-lg bg-primary/10 px-4 py-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">打款金额</p>
                        <p className="text-3xl font-bold tabular-nums text-primary">
                            {formatCurrency(actualAmount)}
                        </p>
                        {feeAmount > 0 && (
                            <p className="mt-1 text-xs text-muted-foreground">
                                申请 {formatCurrency(amount)} · 手续费 {feePercent}% = -{formatCurrency(feeAmount)}
                            </p>
                        )}
                    </div>

                    <div className="flex justify-center overflow-hidden rounded-md border bg-muted/30 p-4">
                        <Image
                            src={url}
                            alt="收款码"
                            width={600}
                            height={600}
                            className="max-h-[55vh] max-w-full object-contain"
                        />
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setOpen(false)}>关闭</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
