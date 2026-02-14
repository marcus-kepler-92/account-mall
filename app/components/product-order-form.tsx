"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import { addOrUpdateOrder } from "@/lib/order-history-storage"

type ProductOrderFormProps = {
    productId: string
    productName?: string
    maxQuantity: number
    price: number
    inStock: boolean
    formId?: string
}

export function ProductOrderForm({
    productId,
    productName,
    maxQuantity,
    price,
    inStock,
    formId = "product-order-form",
}: ProductOrderFormProps) {
    const [email, setEmail] = useState("")
    const [orderPassword, setOrderPassword] = useState("")
    const [quantity, setQuantity] = useState(1)
    const [loading, setLoading] = useState(false)

    const router = useRouter()

    const totalPrice = (price * quantity).toFixed(2)

    const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = parseInt(e.target.value, 10)
        if (Number.isNaN(v) || v < 1) setQuantity(1)
        else if (v > maxQuantity) setQuantity(maxQuantity)
        else setQuantity(v)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!inStock) return

        setLoading(true)
        try {
            const res = await fetch("/api/orders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    productId,
                    email: email.trim(),
                    orderPassword,
                    quantity,
                }),
            })

            const data = await res.json()

            if (res.ok) {
                toast.success("订单创建成功")
                addOrUpdateOrder({
                    orderNo: data.orderNo,
                    productName: productName ?? "商品",
                    amount: data.amount,
                    createdAt: new Date().toISOString(),
                    status: "PENDING",
                })
                if (data.paymentUrl) {
                    window.location.href = data.paymentUrl
                } else if (data.orderNo) {
                    toast.success(`订单号: ${data.orderNo}，请妥善保管订单号和密码`)
                    router.push(`/orders/lookup?orderNo=${encodeURIComponent(data.orderNo)}`)
                }
                return
            }

            toast.error(data.error || "下单失败")
        } catch {
            toast.error("下单失败，请稍后重试")
        } finally {
            setLoading(false)
        }
    }

    return (
        <form
            id={formId}
            onSubmit={handleSubmit}
            className="space-y-4 rounded-xl border bg-card p-4 shadow-sm sm:p-5"
        >
            <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">立即购买</h3>
                <p className="text-xs text-muted-foreground">
                    支持邮箱接收卡密，请妥善保管订单密码以便后续查询。
                </p>
            </div>

            <div className="space-y-2">
                <Label htmlFor="email">邮箱</Label>
                <Input
                    id="email"
                    type="email"
                    placeholder="用于接收卡密"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={!inStock}
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="orderPassword">订单密码</Label>
                <Input
                    id="orderPassword"
                    type="password"
                    placeholder="用于查询订单，请妥善保管"
                    value={orderPassword}
                    onChange={(e) => setOrderPassword(e.target.value)}
                    required
                    minLength={6}
                    disabled={!inStock}
                />
                <p className="text-xs text-muted-foreground">
                    6 位以上，用于后续查询订单和卡密
                </p>
            </div>

            <div className="space-y-2">
                <Label htmlFor="quantity">购买数量</Label>
                <Input
                    id="quantity"
                    type="number"
                    min={1}
                    max={maxQuantity}
                    value={quantity}
                    onChange={handleQuantityChange}
                    disabled={!inStock}
                />
            </div>

            <div className="flex items-center justify-between pt-2">
                <span className="text-lg font-bold">合计: ¥{totalPrice}</span>
                <Button
                    type="submit"
                    disabled={!inStock || loading}
                    className="hidden lg:flex"
                >
                    {loading && <Loader2 className="size-4 animate-spin" />}
                    {inStock ? "立即购买" : "售罄"}
                </Button>
            </div>
        </form>
    )
}
