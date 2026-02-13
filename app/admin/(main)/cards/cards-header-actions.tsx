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

export function CardsHeaderActions() {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [products, setProducts] = useState<ProductOption[]>([])
    const [selectedProductId, setSelectedProductId] = useState<string | undefined>()
    const [loading, setLoading] = useState(false)

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
        router.push(`/admin/products/${selectedProductId}/cards`)
    }

    return (
        <>
            <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setOpen(true)}>
                    <Upload className="size-4" />
                    批量导入
                </Button>
                <Button onClick={() => setOpen(true)}>
                    <Plus className="size-4" />
                    添加卡密
                </Button>
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>选择商品</DialogTitle>
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
                            前往管理卡密
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}

