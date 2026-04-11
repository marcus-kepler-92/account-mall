"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Link2, Loader2, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

interface GenerateLinkDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    apiEndpoint: string
}

export function GenerateLinkDialog({ open, onOpenChange, apiEndpoint }: GenerateLinkDialogProps) {
    const [loading, setLoading] = useState(false)
    const [link, setLink] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)

    const handleGenerate = async () => {
        setLoading(true)
        try {
            const res = await fetch(apiEndpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            })
            const data = await res.json()
            if (!res.ok) {
                toast.error(data.error || "生成失败，请稍后重试")
                return
            }
            setLink(data.link)
        } catch {
            toast.error("生成失败，请稍后重试")
        } finally {
            setLoading(false)
        }
    }

    const handleCopy = async () => {
        if (!link) return
        try {
            await navigator.clipboard.writeText(link)
            setCopied(true)
            toast.success("链接已复制")
            setTimeout(() => setCopied(false), 2000)
        } catch {
            toast.error("复制失败，请手动复制")
        }
    }

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            setLink(null)
            setCopied(false)
        }
        onOpenChange(open)
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>生成邀请链接</DialogTitle>
                    <DialogDescription>
                        生成一次性邀请链接，将链接发给对方，对方点击后可设置用户名和密码加入。链接 7 天内有效，仅限一人使用。
                    </DialogDescription>
                </DialogHeader>
                {!link ? (
                    <Button onClick={handleGenerate} disabled={loading} className="w-full">
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 size-4 animate-spin" />
                                生成中...
                            </>
                        ) : (
                            <>
                                <Link2 className="mr-2 size-4" />
                                生成邀请链接
                            </>
                        )}
                    </Button>
                ) : (
                    <div className="space-y-3">
                        <div className="flex gap-2">
                            <Input value={link} readOnly className="text-xs" />
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={handleCopy}
                                className="shrink-0"
                            >
                                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">复制后通过微信或其他方式发给对方</p>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
