"use client"

import { useState } from "react"
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
    DialogTrigger,
} from "@/components/ui/dialog"
import { Upload, Loader2 } from "lucide-react"

type BulkImportCardsProps = {
    productId: string
    trigger?: React.ReactNode
}

const MAX_LINES = 500

export function BulkImportCards({ productId, trigger }: BulkImportCardsProps) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [text, setText] = useState("")
    const [loading, setLoading] = useState(false)

    const lines = text
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
    const uniqueCount = new Set(lines).size
    const totalCount = lines.length
    const isValid = totalCount > 0 && totalCount <= MAX_LINES

    const handleSubmit = async () => {
        if (!isValid) return
        setLoading(true)
        try {
            const res = await fetch(`/api/products/${productId}/cards`, {
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
            toast.success(`成功导入 ${imported} 条卡密`)
            setOpen(false)
            setText("")
            router.refresh()
        } catch {
            toast.error("导入失败")
        } finally {
            setLoading(false)
        }
    }

    const handleOpenChange = (next: boolean) => {
        if (!next) setText("")
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
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>批量导入卡密</DialogTitle>
                    <DialogDescription>
                        每行输入一条卡密内容，支持最多 {MAX_LINES} 条。重复行将在导入时去重。
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                    <Textarea
                        placeholder={`例如：
账号1|密码1
账号2|密码2
...`}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        className="min-h-[180px] font-mono text-sm"
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
