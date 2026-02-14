"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Loader2, Upload } from "lucide-react"

const MAX_LINES = 500

type ProductOption = {
    id: string
    name: string
    slug: string
}

export function CardsHeaderActions() {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [products, setProducts] = useState<ProductOption[]>([])
    const [selectedProductId, setSelectedProductId] = useState<string | undefined>()
    const [loading, setLoading] = useState(false)
    const [text, setText] = useState("")
    const [importLoading, setImportLoading] = useState(false)

    const lines = text
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
    const uniqueCount = new Set(lines).size
    const totalCount = lines.length
    const importValid = totalCount > 0 && totalCount <= MAX_LINES

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

                const items: ProductOption[] = (data.data ?? []).map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    slug: p.slug,
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
        if (!next) setText("")
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
                body: JSON.stringify({ contents: lines }),
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
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>批量导入卡密</DialogTitle>
                        <DialogDescription>
                            选择商品后可直接在此粘贴卡密（每行一条，最多 {MAX_LINES} 条），或前往该商品卡密页操作。
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">
                                选择商品（仅展示可用商品）
                            </p>
                            <Select
                                value={selectedProductId}
                                onValueChange={(value) => setSelectedProductId(value)}
                                disabled={loading || products.length === 0}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder={loading ? "加载中..." : "选择商品"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {products.map((product) => (
                                        <SelectItem key={product.id} value={product.id}>
                                            {product.name}（/{product.slug}）
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {products.length === 0 && !loading && (
                                <p className="text-xs text-muted-foreground">
                                    暂无可用商品，请先到商品管理中创建商品。
                                </p>
                            )}
                        </div>

                        {selectedProductId && (
                            <div className="space-y-2">
                                <Textarea
                                    placeholder={`每行一条卡密，例如：\n账号1|密码1\n账号2|密码2`}
                                    value={text}
                                    onChange={(e) => setText(e.target.value)}
                                    className="min-h-[160px] font-mono text-sm"
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

