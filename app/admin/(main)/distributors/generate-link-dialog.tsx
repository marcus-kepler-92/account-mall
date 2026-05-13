"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Copy, Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { configClient } from "@/lib/config-client"

interface GenerateLinkDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    apiEndpoint: string
}

type DialogState = "config" | "loading" | "done"

const DEFAULT_COUNT = configClient.inviteLinkDefaultCount
const MAX_COUNT = configClient.inviteLinkMaxCount

export function GenerateLinkDialog({ open, onOpenChange, apiEndpoint }: GenerateLinkDialogProps) {
    const [state, setState] = useState<DialogState>("config")
    const [inputStr, setInputStr] = useState(String(DEFAULT_COUNT))
    const [link, setLink] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)

    const maxUses = Math.max(1, Math.min(MAX_COUNT, parseInt(inputStr, 10) || DEFAULT_COUNT))

    useEffect(() => {
        if (!open) {
            setState("config")
            setInputStr(String(DEFAULT_COUNT))
            setLink(null)
            setCopied(false)
        }
    }, [open])

    const handleOpenChange = (next: boolean) => {
        onOpenChange(next)
    }

    const handleGenerate = async () => {
        setState("loading")
        try {
            const res = await fetch(apiEndpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ maxUses }),
            })
            const data = await res.json()
            if (!res.ok) {
                toast.error(data.error || "生成失败，请稍后重试")
                setState("config")
                return
            }
            setLink(data.link)
            setState("done")
        } catch {
            toast.error("生成失败，请稍后重试")
            setState("config")
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

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>生成邀请链接</DialogTitle>
                    <DialogDescription>
                        生成一条多次使用的邀请链接，分享给对方后可多人注册。链接 7 天内有效。
                    </DialogDescription>
                </DialogHeader>

                {state === "config" && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="maxUses">可注册人数（1–{MAX_COUNT}）</Label>
                            <Input
                                id="maxUses"
                                type="number"
                                min={1}
                                max={MAX_COUNT}
                                step={1}
                                value={inputStr}
                                onChange={(e) => setInputStr(e.target.value)}
                                onBlur={() => setInputStr(String(maxUses))}
                            />
                        </div>
                        <Button className="w-full" onClick={handleGenerate}>
                            生成链接
                        </Button>
                    </div>
                )}

                {state === "loading" && (
                    <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        生成中...
                    </div>
                )}

                {state === "done" && link && (
                    <div className="space-y-3">
                        <div className="flex gap-2">
                            <Input value={link} readOnly className="text-xs" />
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={handleCopy}
                                className="shrink-0"
                                aria-label="复制链接"
                            >
                                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            该链接可供 {maxUses} 人注册，复制后通过微信或其他方式发送
                        </p>
                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => { setState("config"); setLink(null); setCopied(false) }}
                        >
                            重新生成
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
