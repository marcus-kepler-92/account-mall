"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
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
import { Loader2, Plus, Upload } from "lucide-react"

type ProductOption = {
    id: string
    name: string
    slug: string
}

type DialogMode = "add" | "import"

export function CardsHeaderActions() {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [mode, setMode] = useState<DialogMode>("add")
    const [products, setProducts] = useState<ProductOption[]>([])
    const [selectedProductId, setSelectedProductId] = useState<string | undefined>()
    const [loading, setLoading] = useState(false)

    const openDialog = (m: DialogMode) => {
        setMode(m)
        setOpen(true)
    }

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

    const handleConfirm = () => {
        if (!selectedProductId) return
        setOpen(false)
        const action = mode === "add" ? "add" : "import"
        router.push(`/admin/products/${selectedProductId}/cards?action=${action}`)
    }

    const title = mode === "add" ? "添加卡密 - 选择商品" : "批量导入 - 选择商品"
    const confirmLabel = mode === "add" ? "前往添加卡密" : "前往批量导入"

    return (
        <>
            <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => openDialog("import")}>
                    <Upload className="size-4" />
                    批量导入
                </Button>
                <Button onClick={() => openDialog("add")}>
                    <Plus className="size-4" />
                    添加卡密
                </Button>
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{title}</DialogTitle>
                        <DialogDescription>
                            请选择要管理卡密的商品，系统会跳转到该商品的卡密管理页面，在那里可以新增、删除或批量导入卡密。
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                            仅展示当前可用商品（ACTIVE）。
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
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            取消
                        </Button>
                        <Button
                            onClick={handleConfirm}
                            disabled={!selectedProductId || loading || products.length === 0}
                        >
                            {loading && <Loader2 className="size-4 animate-spin" />}
                            {confirmLabel}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}

