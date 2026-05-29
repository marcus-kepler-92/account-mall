"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
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
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { configClient } from "@/lib/config-client"

const DEFAULT_COUNT = configClient.inviteLinkDefaultCount
const MAX_COUNT = configClient.inviteLinkMaxCount

const formSchema = z.object({
    maxUses: z
        .number()
        .finite("请输入有效数字")
        .int("请输入整数")
        .min(1, "最小为 1")
        .max(MAX_COUNT, `最大为 ${MAX_COUNT}`),
})

type FormValues = z.infer<typeof formSchema>

interface GenerateLinkDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    apiEndpoint: string
}

type DialogState = "config" | "loading" | "done"

export function GenerateLinkDialog({ open, onOpenChange, apiEndpoint }: GenerateLinkDialogProps) {
    const [state, setState] = useState<DialogState>("config")
    const [link, setLink] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)
    const [generatedMaxUses, setGeneratedMaxUses] = useState(DEFAULT_COUNT)

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: { maxUses: DEFAULT_COUNT },
        mode: "onBlur",
    })

    useEffect(() => {
        if (!open) {
            // Clear dialog state when it closes — responds to the `open` prop,
            // intentional set-state-in-effect.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setState("config")
            form.reset()
            setLink(null)
            setCopied(false)
        }
    }, [open, form])

    const handleGenerate = form.handleSubmit(async ({ maxUses }) => {
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
            setGeneratedMaxUses(maxUses)
            setLink(data.link)
            setState("done")
        } catch {
            toast.error("生成失败，请稍后重试")
            setState("config")
        }
    })

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
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>生成邀请链接</DialogTitle>
                    <DialogDescription>
                        生成一条多次使用的邀请链接，分享给对方后可多人注册。链接 7 天内有效。
                    </DialogDescription>
                </DialogHeader>

                {state === "config" && (
                    <Form {...form}>
                        <form onSubmit={handleGenerate} className="space-y-4">
                            <FormField
                                control={form.control}
                                name="maxUses"
                                render={({ field: { onChange, onBlur, value, ref } }) => (
                                    <FormItem>
                                        <FormLabel>可注册人数（1–{MAX_COUNT}）</FormLabel>
                                        <FormControl>
                                            <Input
                                                ref={ref}
                                                name="maxUses"
                                                type="number"
                                                min={1}
                                                max={MAX_COUNT}
                                                step={1}
                                                value={isNaN(value) ? "" : value}
                                                onChange={(e) => onChange(e.target.valueAsNumber)}
                                                onBlur={onBlur}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button type="submit" className="w-full">生成链接</Button>
                        </form>
                    </Form>
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
                            该链接可供 {generatedMaxUses} 人注册，复制后通过微信或其他方式发送
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
