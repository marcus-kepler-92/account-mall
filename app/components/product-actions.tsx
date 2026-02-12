"use client"

import { useState } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Loader2, Archive, RotateCcw } from "lucide-react"

export function DeactivateProductButton({
    productId,
    currentStatus,
}: {
    productId: string
    currentStatus: string
}) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const isActive = currentStatus === "ACTIVE"

    const handleToggle = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/products/${productId}`, {
                method: isActive ? "DELETE" : "PUT",
                ...(isActive
                    ? {}
                    : {
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ status: "ACTIVE" }),
                      }),
            })

            if (res.ok) {
                setOpen(false)
                toast.success(isActive ? "商品已下架" : "商品已上架")
                router.push("/admin/products")
                router.refresh()
            }
        } catch {
            toast.error("操作失败")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant={isActive ? "destructive" : "default"}
                    size="sm"
                >
                    {isActive ? (
                        <>
                            <Archive className="size-4" />
                            下架
                        </>
                    ) : (
                        <>
                            <RotateCcw className="size-4" />
                            上架
                        </>
                    )}
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {isActive ? "下架商品" : "上架商品"}
                    </DialogTitle>
                    <DialogDescription>
                        {isActive
                            ? "商品将从前台隐藏，已有订单不受影响。"
                            : "商品将重新在前台展示。"}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => setOpen(false)}
                    >
                        取消
                    </Button>
                    <Button
                        variant={isActive ? "destructive" : "default"}
                        onClick={handleToggle}
                        disabled={loading}
                    >
                        {loading && (
                            <Loader2 className="size-4 animate-spin" />
                        )}
                        {isActive ? "下架" : "上架"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
