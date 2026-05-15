"use client"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Upload, Loader2 } from "lucide-react"

type BulkImportCardsProps = {
    productId: string
    /** Prefilled into the unit cost input; user can override. */
    defaultUnitCost?: number | null
    trigger?: React.ReactNode
    /** When true, dialog opens on mount (e.g. when landing with ?action=import). Clears action from URL after open. */
    defaultOpen?: boolean
}

const MAX_LINES = 500

export function BulkImportCards({ productId, defaultUnitCost = null, trigger, defaultOpen = false }: BulkImportCardsProps) {
    const router = useRouter()
    const pathname = usePathname()
    const [open, setOpen] = useState(defaultOpen)

    useEffect(() => {
        if (!defaultOpen) return
        setOpen(true)
        router.replace(pathname)
    }, [defaultOpen, pathname, router])
    const [text, setText] = useState("")
    const [unitCostInput, setUnitCostInput] = useState<string>(
        defaultUnitCost == null ? "" : defaultUnitCost.toString(),
    )
    const [loading, setLoading] = useState(false)

    const lines = text
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
    const uniqueCount = new Set(lines).size
    const totalCount = lines.length
    const parsedUnitCost =
        unitCostInput.trim() === "" ? null : Number(unitCostInput)
    const unitCostValid =
        parsedUnitCost === null ||
        (Number.isFinite(parsedUnitCost) &&
            parsedUnitCost >= 0 &&
            Math.round(parsedUnitCost * 100) / 100 === parsedUnitCost)
    const isValid = totalCount > 0 && totalCount <= MAX_LINES && unitCostValid

    const resetUnitCost = () => {
        setUnitCostInput(defaultUnitCost == null ? "" : defaultUnitCost.toString())
    }

    const handleSubmit = async () => {
        if (!isValid) return
        setLoading(true)
        try {
            const res = await fetch(`/api/products/${productId}/cards`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents: lines, unitCost: parsedUnitCost }),
            })

            const data = await res.json()
            if (!res.ok) {
                toast.error(data.error || "导入失败")
                return
            }

            const imported = data.imported ?? totalCount
            toast.success(`成功导入 ${imported} 条卡密`)
            setOpen(false)
            setText("")
            resetUnitCost()
            router.refresh()
        } catch {
            toast.error("导入失败")
        } finally {
            setLoading(false)
        }
    }

    const handleOpenChange = (next: boolean) => {
        if (!next) {
            setText("")
            resetUnitCost()
        }
        setOpen(next)
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                {trigger ?? (
                    <Button>
                        <Upload className="size-4" />
                        批量导入
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>批量导入卡密</DialogTitle>
                    <DialogDescription>
                        每行输入一条卡密内容，支持最多 {MAX_LINES} 条。重复行将在导入时去重。
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 flex-1 overflow-y-auto min-h-0">
                    <div className="space-y-1.5">
                        <Label htmlFor="bulk-import-unit-cost">
                            采购成本（每张，可选）
                        </Label>
                        <Input
                            id="bulk-import-unit-cost"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="留空表示不记录成本（按 0 计入利润）"
                            value={unitCostInput}
                            onChange={(e) => setUnitCostInput(e.target.value)}
                            disabled={loading}
                        />
                        <p className="text-xs text-muted-foreground">
                            本批卡密统一进货成本，订单完成后计入利润快照。默认带出商品配置的采购成本。
                        </p>
                        {!unitCostValid && (
                            <p className="text-xs text-destructive">
                                请输入非负数且最多 2 位小数
                            </p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Textarea
                            placeholder={`例如：
账号1|密码1
账号2|密码2
...`}
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            className="min-h-[180px] font-mono text-sm max-h-[50vh]"
                            disabled={loading}
                        />
                        <div className="flex justify-between text-sm text-muted-foreground">
                            <span>共 {totalCount} 条，去重后 {uniqueCount} 条</span>
                            {totalCount > MAX_LINES && (
                                <span className="text-destructive">
                                    超出上限，请减少至 {MAX_LINES} 条以内
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        取消
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!isValid || loading}
                    >
                        {loading && <Loader2 className="size-4 animate-spin" />}
                        导入
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
