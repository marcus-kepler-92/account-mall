"use client"

import { useState } from "react"
import { useFormContext } from "react-hook-form"
import { toast } from "sonner"
import { Loader2, Send } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"

type Props = {
    fallback: string | undefined
}

// Card-internal control: WeCom webhook URL + "send test" button. The webhook
// field is part of the parent form (react-hook-form via useFormContext) so it
// participates in the normal PATCH submission. The test button calls a separate
// admin endpoint that reads the persisted setting — therefore an unsaved value
// won't be tested; we warn the user when the form is dirty so they save first.
export function WecomNotifyCard({ fallback }: Props) {
    const { control, formState } = useFormContext()
    const [sending, setSending] = useState(false)
    const fieldDirty = Boolean(formState.dirtyFields?.wecomWebhookUrl)

    async function onTest() {
        if (fieldDirty) {
            toast.warning("Webhook URL 已修改但尚未保存，请先保存再测试")
            return
        }
        setSending(true)
        try {
            const res = await fetch("/api/admin/site-setting/test-wecom", { method: "POST" })
            const body = await res.json().catch(() => ({}))
            if (res.ok && body?.ok) {
                toast.success("测试消息已发送，请检查群")
            } else {
                toast.error(body?.error || "发送失败，请检查 URL 配置")
            }
        } catch {
            toast.error("发送失败，请稍后重试")
        } finally {
            setSending(false)
        }
    }

    return (
        <FormField
            control={control}
            name="wecomWebhookUrl"
            render={({ field }) => (
                <FormItem>
                    <FormLabel>企微群机器人 Webhook</FormLabel>
                    <div className="flex gap-2">
                        <FormControl>
                            <Input
                                placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."
                                {...field}
                            />
                        </FormControl>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={onTest}
                            disabled={sending || !(field.value || fallback)}
                        >
                            {sending ? (
                                <Loader2 className="size-4 animate-spin" />
                            ) : (
                                <Send className="size-4" />
                            )}
                            发送测试消息
                        </Button>
                    </div>
                    <FormDescription className="break-all">
                        新订单待发货 / 买家催发货时推送到此群。留空则不推送。
                        {fallback ? `未配置时使用环境变量值：${fallback}` : "未配置时不推送。"}
                    </FormDescription>
                    <FormMessage />
                </FormItem>
            )}
        />
    )
}
