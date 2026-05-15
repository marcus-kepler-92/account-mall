"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
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
} from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import { cn } from "@/lib/utils"
import { Check, ChevronsUpDown, Loader2, Upload } from "lucide-react"

const MAX_LINES = 500

type ProductOption = {
    id: string
    name: string
    slug: string
    productType?: string
    price?: number
    costPerUnit?: number | null
}

export function CardsHeaderActions() {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [productSelectOpen, setProductSelectOpen] = useState(false)
    const [products, setProducts] = useState<ProductOption[]>([])
    const [selectedProductId, setSelectedProductId] = useState<string | undefined>()
    const [loading, setLoading] = useState(false)
    const [text, setText] = useState("")
    const [unitCostInput, setUnitCostInput] = useState("")
    const [unitCostTouched, setUnitCostTouched] = useState(false)
    const [importLoading, setImportLoading] = useState(false)

    const selectedProduct = products.find((p) => p.id === selectedProductId)

    // Reset touched flag whenever the user switches product, so the next prefill kicks in.
    useEffect(() => {
        setUnitCostTouched(false)
    }, [selectedProductId])

    // Prefill unitCost from the selected product's costPerUnit until the user edits the field.
    useEffect(() => {
        if (unitCostTouched) return
        const cost = selectedProduct?.costPerUnit
        setUnitCostInput(cost == null ? "" : cost.toString())
    }, [selectedProduct, unitCostTouched])

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
    const importValid =
        totalCount > 0 && totalCount <= MAX_LINES && unitCostValid

    useEffect(() => {
        if (!open) return

        let cancelled = false

        const fetchProducts = async () => {
            setLoading(true)
            try {
                const res = await fetch("/api/products?admin=true&status=ACTIVE&pageSize=100")
                if (!res.ok) return

                const data = await res.json()
                if (cancelled) return

                const items: ProductOption[] = (data.data ?? [])
                    .filter((p: ProductOption) => p.productType !== "AUTO_FETCH")
                    .map((p: ProductOption) => ({
                        id: p.id,
                        name: p.name,
                        slug: p.slug,
                        costPerUnit: p.costPerUnit ?? null,
                    }))

                setProducts(items)
                if (!selectedProductId && items.length > 0) {
                    setSelectedProductId(items[0].id)
                }
            } catch {
                // Swallow errors, user can retry by reopening dialog
            } finally {
                if (!cancelled) {
                    setLoading(false)
                }
            }
        }

        fetchProducts()

        return () => {
            cancelled = true
        }
    }, [open, selectedProductId])

    const handleOpenChange = (next: boolean) => {
        if (!next) {
            setText("")
            setUnitCostInput("")
            setUnitCostTouched(false)
        }
        setOpen(next)
    }

    const handleGoToProductCards = () => {
        if (!selectedProductId) return
        setOpen(false)
        router.push(`/admin/products/${selectedProductId}/cards?action=import`)
    }

    const handleImport = async () => {
        if (!selectedProductId || !importValid) return
        setImportLoading(true)
        try {
            const res = await fetch(`/api/products/${selectedProductId}/cards`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: lines,
                    unitCost: parsedUnitCost,
                }),
            })
            const data = await res.json()
            if (!res.ok) {
                toast.error(data.error || "导入失败")
                return
            }
            const imported = data.imported ?? totalCount
            toast.success(`成功导入 ${imported} 条卡密`, {
                action: {
                    label: "前往该商品卡密页",
                    onClick: () => router.push(`/admin/products/${selectedProductId}/cards`),
                },
            })
            setText("")
            setUnitCostInput("")
            setUnitCostTouched(false)
            setOpen(false)
            router.refresh()
        } catch {
            toast.error("导入失败")
        } finally {
            setImportLoading(false)
        }
    }

    return (
        <>
            <div className="flex items-center gap-2">
                <Button onClick={() => setOpen(true)}>
                    <Upload className="size-4" />
                    批量导入
                </Button>
            </div>

            <Dialog open={open} onOpenChange={handleOpenChange}>
                <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>批量导入卡密</DialogTitle>
                        <DialogDescription>
                            选择商品后可直接在此粘贴卡密（每行一条，最多 {MAX_LINES} 条），或前往该商品卡密页操作。
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 flex-1 overflow-y-auto min-h-0">
                        <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">
                                选择商品（仅展示可用商品）
                            </p>
                            <Popover open={productSelectOpen} onOpenChange={setProductSelectOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        role="combobox"
                                        disabled={loading || products.length === 0}
                                        className={cn(
                                            "w-full justify-between font-normal",
                                            !selectedProductId && "text-muted-foreground"
                                        )}
                                    >
                                        <span className="truncate">
                                            {loading
                                                ? "加载中..."
                                                : selectedProductId
                                                  ? products.find((p) => p.id === selectedProductId)?.name
                                                  : "选择商品"}
                                        </span>
                                        <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                                    <Command>
                                        <CommandInput placeholder="搜索商品..." />
                                        <CommandList>
                                            <CommandEmpty>未找到匹配商品</CommandEmpty>
                                            <CommandGroup>
                                                {products.map((product) => (
                                                    <CommandItem
                                                        key={product.id}
                                                        value={product.name}
                                                        onSelect={() => {
                                                            setSelectedProductId(product.id)
                                                            setProductSelectOpen(false)
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 size-4",
                                                                selectedProductId === product.id ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        <span className="truncate">{product.name}</span>
                                                        <span className="ml-auto pl-2 text-xs text-muted-foreground shrink-0">
                                                            /{product.slug}
                                                        </span>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                            {products.length === 0 && !loading && (
                                <p className="text-xs text-muted-foreground">
                                    暂无可用商品，请先到商品管理中创建商品。
                                </p>
                            )}
                        </div>

                        {selectedProductId && (
                            <>
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
                                        onChange={(e) => {
                                            setUnitCostInput(e.target.value)
                                            setUnitCostTouched(true)
                                        }}
                                        disabled={importLoading}
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
                                        placeholder={`每行一条卡密，例如：\n账号1|密码1\n账号2|密码2`}
                                        value={text}
                                        onChange={(e) => setText(e.target.value)}
                                        className="min-h-[160px] font-mono text-sm max-h-[50vh]"
                                        disabled={importLoading}
                                    />
                                    <div className="flex justify-between text-sm text-muted-foreground">
                                        <span>共 {totalCount} 条，去重后 {uniqueCount} 条</span>
                                        {totalCount > MAX_LINES && (
                                            <span className="text-destructive">
                                                请减少至 {MAX_LINES} 条以内
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            取消
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handleGoToProductCards}
                            disabled={!selectedProductId || loading || products.length === 0}
                        >
                            前往该商品卡密页
                        </Button>
                        <Button
                            onClick={handleImport}
                            disabled={!selectedProductId || !importValid || importLoading}
                        >
                            {importLoading && <Loader2 className="size-4 animate-spin" />}
                            导入
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}

