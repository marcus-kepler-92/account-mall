"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronUp, ChevronDown, X } from "lucide-react"

type ProductOption = { id: string; name: string }

type Props = {
    productId: string
    initialTargets: ProductOption[]
    allProducts: ProductOption[]
}

export function CrossSellTargetsForm({ productId, initialTargets, allProducts }: Props) {
    const router = useRouter()
    const [targets, setTargets] = useState<ProductOption[]>(initialTargets)
    const [loading, setLoading] = useState(false)

    const available = allProducts.filter((p) => !targets.some((t) => t.id === p.id))

    const addTarget = (id: string) => {
        if (targets.length >= 3) return
        const product = allProducts.find((p) => p.id === id)
        if (!product) return
        setTargets([...targets, product])
    }

    const removeTarget = (id: string) => {
        setTargets(targets.filter((t) => t.id !== id))
    }

    const moveUp = (index: number) => {
        if (index === 0) return
        const next = [...targets]
        ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
        setTargets(next)
    }

    const moveDown = (index: number) => {
        if (index === targets.length - 1) return
        const next = [...targets]
        ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
        setTargets(next)
    }

    const save = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/admin/products/${productId}/cross-sell`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ targetProductIds: targets.map((t) => t.id) }),
            })
            if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                toast.error(body.error || "保存失败")
                return
            }
            toast.success("联推商品已保存")
            router.refresh()
        } catch {
            toast.error("保存失败，请稍后重试")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">联推商品</CardTitle>
                <CardDescription>
                    用户购买本商品后，成功页会推荐以下商品并附带限时折扣（最多 3 个，顺序即展示顺序）
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {targets.length > 0 && (
                    <ul className="space-y-2">
                        {targets.map((target, index) => (
                            <li
                                key={target.id}
                                className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm"
                            >
                                <span className="flex-1 min-w-0 truncate">{target.name}</span>
                                <div className="flex items-center gap-1 shrink-0">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="size-7"
                                        onClick={() => moveUp(index)}
                                        disabled={index === 0}
                                    >
                                        <ChevronUp className="size-4" />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="size-7"
                                        onClick={() => moveDown(index)}
                                        disabled={index === targets.length - 1}
                                    >
                                        <ChevronDown className="size-4" />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="size-7 text-destructive hover:text-destructive"
                                        onClick={() => removeTarget(target.id)}
                                    >
                                        <X className="size-4" />
                                    </Button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}

                {targets.length < 3 && available.length > 0 && (
                    <Select onValueChange={addTarget} value="">
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="添加推荐商品…" />
                        </SelectTrigger>
                        <SelectContent>
                            {available.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                    {p.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}

                {targets.length === 0 && available.length === 0 && (
                    <p className="text-xs text-muted-foreground">暂无其他在售商品可添加</p>
                )}

                <Button type="button" onClick={save} disabled={loading} size="sm">
                    {loading ? "保存中…" : "保存联推商品"}
                </Button>
            </CardContent>
        </Card>
    )
}
