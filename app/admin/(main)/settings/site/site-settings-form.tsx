"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Upload, Loader2, RotateCcw, ChevronDown, QrCode } from "lucide-react"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { SiteSettings } from "@/lib/site-settings"
import { TimezoneCombobox } from "./timezone-combobox"
import { WecomNotifyCard } from "./wecom-notify-card"
import { BusinessHoursWeekdayPicker } from "./business-hours-weekday-picker"

// Empty string semantically means "use env fallback" on submit (server schema
// coerces "" → null). Hour fields are stringified for stable RHF typing.
const hourString = z
    .string()
    .refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) >= 0 && Number(v) <= 23), "需为 0-23 的整数")

// Minute fields: empty string means "use env fallback"; otherwise an integer
// within the given inclusive range. Stringified for stable RHF typing.
const minuteString = (max: number) =>
    z
        .string()
        .refine(
            (v) => v === "" || (/^\d+$/.test(v) && Number(v) >= 0 && Number(v) <= max),
            `需为 0-${max} 的整数`,
        )

// businessHoursWeekdays is stored as a JSON-array string. Empty string means
// "use env fallback / all days"; "[]" means "explicitly no business days".
const weekdaysString = z.string().refine((v) => {
    if (v === "") return true
    try {
        const arr = JSON.parse(v)
        return Array.isArray(arr) && arr.every((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    } catch {
        return false
    }
}, "工作日字段需为 0-6 整数 JSON 数组")

const formSchema = z
    .object({
        wechatQrUrl: z.string().refine((v) => v === "" || /^https?:\/\//.test(v), "必须是 http(s) URL"),
        wechatId: z.string().max(64),
        businessHoursStart: hourString,
        businessHoursEnd: hourString,
        businessHoursTimezone: z.string().max(64),
        businessHoursWeekdays: weekdaysString,
        businessName: z.string().max(128),
        businessLicenseNo: z.string().max(64),
        contactEmail: z.string().refine((v) => v === "" || /\S+@\S+\.\S+/.test(v), "邮箱格式无效"),
        escalateWebhookUrl: z.string().refine((v) => v === "" || /^https?:\/\//.test(v), "必须是 http(s) URL"),
        wecomWebhookUrl: z.string().refine((v) => v === "" || /^https?:\/\//.test(v), "必须是 http(s) URL"),
        dunCooldownMinutes: minuteString(1440),
        dunMinAgeMinutes: minuteString(60),
    })
    .refine(
        (d) =>
            d.businessHoursStart === "" ||
            d.businessHoursEnd === "" ||
            d.businessHoursStart !== d.businessHoursEnd,
        { message: "开始与结束不能相同", path: ["businessHoursEnd"] },
    )

type FormValues = z.infer<typeof formSchema>

type SiteSettingRow = {
    wechatQrUrl: string | null
    wechatId: string | null
    businessHoursStart: number | null
    businessHoursEnd: number | null
    businessHoursTimezone: string | null
    businessHoursWeekdays: string | null
    businessName: string | null
    businessLicenseNo: string | null
    contactEmail: string | null
    escalateWebhookUrl: string | null
    wecomWebhookUrl: string | null
    dunCooldownMinutes: number | null
    dunMinAgeMinutes: number | null
} | null

type Props = {
    row: SiteSettingRow
    effective: SiteSettings
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const pad = (n: number) => String(n).padStart(2, "0")

function describeWindow(start: string, end: string, fallback: { start: number; end: number }): string | null {
    const s = start === "" ? fallback.start : Number(start)
    const e = end === "" ? fallback.end : Number(end)
    if (Number.isNaN(s) || Number.isNaN(e) || s === e) return null
    if (s < e) return `营业窗口：${pad(s)}:00 – ${pad(e)}:00（${e - s} 小时）`
    return `跨夜窗口：${pad(s)}:00 – 次日 ${pad(e)}:00（${24 - s + e} 小时）`
}

function defaultHint(effectiveValue: string | number | undefined): string {
    if (effectiveValue === undefined || effectiveValue === "" || effectiveValue === null) {
        return "未配置时不展示。"
    }
    return `未配置时使用环境变量值：${effectiveValue}`
}

// Small "↺ 使用默认" link that resets the field to "" (env fallback).
// Visible only when the field currently has a custom value.
function ResetToDefault({
    isCustom,
    onReset,
}: {
    isCustom: boolean
    onReset: () => void
}) {
    if (!isCustom) return null
    return (
        <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
            <RotateCcw className="size-3" />
            恢复环境变量默认
        </button>
    )
}

export function SiteSettingsForm({ row, effective }: Props) {
    const router = useRouter()
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [showQrUrlInput, setShowQrUrlInput] = useState(false)

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            wechatQrUrl: row?.wechatQrUrl ?? "",
            wechatId: row?.wechatId ?? "",
            businessHoursStart: row?.businessHoursStart != null ? String(row.businessHoursStart) : "",
            businessHoursEnd: row?.businessHoursEnd != null ? String(row.businessHoursEnd) : "",
            businessHoursTimezone: row?.businessHoursTimezone ?? "",
            businessHoursWeekdays: row?.businessHoursWeekdays ?? "",
            businessName: row?.businessName ?? "",
            businessLicenseNo: row?.businessLicenseNo ?? "",
            contactEmail: row?.contactEmail ?? "",
            escalateWebhookUrl: row?.escalateWebhookUrl ?? "",
            wecomWebhookUrl: row?.wecomWebhookUrl ?? "",
            dunCooldownMinutes:
                row?.dunCooldownMinutes != null ? String(row.dunCooldownMinutes) : "",
            dunMinAgeMinutes:
                row?.dunMinAgeMinutes != null ? String(row.dunMinAgeMinutes) : "",
        },
    })

    const isDirty = form.formState.isDirty
    const qrUrlValue = form.watch("wechatQrUrl")
    const qrPreview = qrUrlValue || effective.wechatQrUrl
    const [qrLoadError, setQrLoadError] = useState(false)
    // Reset error when the URL changes so the user can retry a different upload
    useEffect(() => {
        setQrLoadError(false)
    }, [qrPreview])
    const qrValid = Boolean(qrPreview) && !qrLoadError
    const startValue = form.watch("businessHoursStart")
    const endValue = form.watch("businessHoursEnd")
    const windowHint = describeWindow(startValue, endValue, {
        start: effective.businessHoursStart,
        end: effective.businessHoursEnd,
    })

    async function handleQrUpload(file: File) {
        if (file.size > 2 * 1024 * 1024) {
            toast.error("二维码图片不能超过 2MB")
            return
        }
        setUploading(true)
        try {
            const fd = new FormData()
            fd.append("file", file)
            fd.append("pathPrefix", "site-qr")
            const res = await fetch("/api/upload/image", { method: "POST", body: fd })
            if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                toast.error(body.error || "上传失败")
                return
            }
            const { url } = await res.json()
            form.setValue("wechatQrUrl", url, { shouldDirty: true })
            toast.success("二维码已上传，记得保存")
        } catch {
            toast.error("上传失败，请稍后重试")
        } finally {
            setUploading(false)
        }
    }

    async function onSubmit(data: FormValues) {
        setSaving(true)
        try {
            const res = await fetch("/api/admin/site-setting", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            })
            if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                toast.error(body.details?.formErrors?.[0] || body.error || "保存失败")
                return
            }
            toast.success("设置已保存")
            router.refresh()
            // Reset dirty flag against the new server state on next render
            form.reset(data)
        } catch {
            toast.error("保存失败，请稍后重试")
        } finally {
            setSaving(false)
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pb-20">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">客服联系方式</CardTitle>
                        <CardDescription>
                            AI 客服无法解决时展示的人工二维码与微信号。
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <FormField
                            control={form.control}
                            name="wechatQrUrl"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>企微/微信二维码</FormLabel>
                                    <div className="flex items-start gap-4">
                                        <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted">
                                            {qrValid ? (
                                                <Image
                                                    src={qrPreview}
                                                    alt="QR"
                                                    width={128}
                                                    height={128}
                                                    unoptimized
                                                    onError={() => setQrLoadError(true)}
                                                />
                                            ) : (
                                                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                                                    <QrCode className="size-10" />
                                                    <span className="text-[10px]">尚未配置</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 space-y-2">
                                            <input
                                                id="qr-upload"
                                                type="file"
                                                accept="image/png,image/jpeg,image/webp"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const f = e.target.files?.[0]
                                                    if (f) handleQrUpload(f)
                                                    e.target.value = ""
                                                }}
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                disabled={uploading}
                                                onClick={() => document.getElementById("qr-upload")?.click()}
                                            >
                                                {uploading ? (
                                                    <Loader2 className="size-4 animate-spin" />
                                                ) : (
                                                    <Upload className="size-4" />
                                                )}
                                                {uploading ? "上传中…" : "上传图片"}
                                            </Button>
                                            <FormDescription className="break-all">
                                                上传 PNG/JPG/WebP，≤ 2MB。{defaultHint(effective.wechatQrUrl)}
                                            </FormDescription>
                                            <div className="flex flex-col items-start gap-2 pt-1">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowQrUrlInput((v) => !v)}
                                                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                                >
                                                    <ChevronDown className={cn("size-3 transition-transform", showQrUrlInput && "rotate-180")} />
                                                    高级：直接粘贴 URL
                                                </button>
                                                {showQrUrlInput && (
                                                    <FormControl>
                                                        <Input placeholder="https://..." {...field} />
                                                    </FormControl>
                                                )}
                                                <ResetToDefault
                                                    isCustom={field.value !== ""}
                                                    onReset={() => field.onChange("")}
                                                />
                                            </div>
                                            <FormMessage />
                                        </div>
                                    </div>
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="wechatId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>微信号（文字）</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormDescription>{defaultHint(effective.wechatId)}</FormDescription>
                                    <ResetToDefault
                                        isCustom={field.value !== ""}
                                        onReset={() => field.onChange("")}
                                    />
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">营业时间</CardTitle>
                        <CardDescription>
                            非营业时间，AI 转人工时会提示用户休息时间与重新上线时间。
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="businessHoursStart"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>开始时刻</FormLabel>
                                        <FormControl>
                                            <Select
                                                value={field.value || undefined}
                                                onValueChange={field.onChange}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder={`默认 ${pad(effective.businessHoursStart)}:00`} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {HOURS.map((h) => (
                                                        <SelectItem key={h} value={String(h)}>
                                                            {pad(h)}:00
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </FormControl>
                                        <ResetToDefault
                                            isCustom={field.value !== ""}
                                            onReset={() => field.onChange("")}
                                        />
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="businessHoursEnd"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>结束时刻</FormLabel>
                                        <FormControl>
                                            <Select
                                                value={field.value || undefined}
                                                onValueChange={field.onChange}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder={`默认 ${pad(effective.businessHoursEnd)}:00`} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {HOURS.map((h) => (
                                                        <SelectItem key={h} value={String(h)}>
                                                            {pad(h)}:00
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </FormControl>
                                        <ResetToDefault
                                            isCustom={field.value !== ""}
                                            onReset={() => field.onChange("")}
                                        />
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {windowHint && (
                            <p className="rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                                {windowHint}
                            </p>
                        )}

                        <FormField
                            control={form.control}
                            name="businessHoursTimezone"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>时区</FormLabel>
                                    <FormControl>
                                        <TimezoneCombobox
                                            value={field.value}
                                            onChange={field.onChange}
                                            placeholder={`默认 ${effective.businessHoursTimezone}`}
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        {defaultHint(effective.businessHoursTimezone)}
                                    </FormDescription>
                                    <ResetToDefault
                                        isCustom={field.value !== ""}
                                        onReset={() => field.onChange("")}
                                    />
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="businessHoursWeekdays"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>营业日</FormLabel>
                                    <FormControl>
                                        <BusinessHoursWeekdayPicker
                                            value={field.value || null}
                                            onChange={field.onChange}
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        选中即视为该日营业。留空使用环境变量默认（缺省全周）。
                                    </FormDescription>
                                    <ResetToDefault
                                        isCustom={field.value !== ""}
                                        onReset={() => field.onChange("")}
                                    />
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">订单通知</CardTitle>
                        <CardDescription>
                            新订单待发货 / 买家催发货推送到企微群机器人；可调整催发货频控阈值。
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <WecomNotifyCard fallback={effective.wecomWebhookUrl} />

                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="dunCooldownMinutes"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>催发货冷却（分钟）</FormLabel>
                                        <FormControl>
                                            <Input
                                                inputMode="numeric"
                                                placeholder={`默认 ${effective.dunCooldownMinutes}`}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            两次催发货之间的最小间隔，0–1440。
                                        </FormDescription>
                                        <ResetToDefault
                                            isCustom={field.value !== ""}
                                            onReset={() => field.onChange("")}
                                        />
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="dunMinAgeMinutes"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>下单后多久可催（分钟）</FormLabel>
                                        <FormControl>
                                            <Input
                                                inputMode="numeric"
                                                placeholder={`默认 ${effective.dunMinAgeMinutes}`}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            订单存在 ≥ 此分钟数后买家才能催发货，0–60。
                                        </FormDescription>
                                        <ResetToDefault
                                            isCustom={field.value !== ""}
                                            onReset={() => field.onChange("")}
                                        />
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">合规与告警</CardTitle>
                        <CardDescription>
                            页脚展示的经营信息（留空则不展示）、紧急 Lead 推送 Webhook。
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <FormField
                            control={form.control}
                            name="businessName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>经营者名称</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormDescription>{defaultHint(effective.businessName)}</FormDescription>
                                    <ResetToDefault
                                        isCustom={field.value !== ""}
                                        onReset={() => field.onChange("")}
                                    />
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="businessLicenseNo"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>统一社会信用代码</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormDescription>{defaultHint(effective.businessLicenseNo)}</FormDescription>
                                    <ResetToDefault
                                        isCustom={field.value !== ""}
                                        onReset={() => field.onChange("")}
                                    />
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="contactEmail"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>对外联系邮箱</FormLabel>
                                    <FormControl>
                                        <Input type="email" {...field} />
                                    </FormControl>
                                    <FormDescription>
                                        用户协议、隐私政策页面的联系入口。{defaultHint(effective.contactEmail)}
                                    </FormDescription>
                                    <ResetToDefault
                                        isCustom={field.value !== ""}
                                        onReset={() => field.onChange("")}
                                    />
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="escalateWebhookUrl"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>紧急 Lead Webhook</FormLabel>
                                    <FormControl>
                                        <Input placeholder="https://hooks.example.com/..." {...field} />
                                    </FormControl>
                                    <FormDescription className="break-all">
                                        AI 客服判定 HIGH 紧急度时调用，可用 Bark、企微机器人等。POST JSON {`{ text }`}。
                                        {defaultHint(effective.escalateWebhookUrl)}
                                    </FormDescription>
                                    <ResetToDefault
                                        isCustom={field.value !== ""}
                                        onReset={() => field.onChange("")}
                                    />
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                </Card>
            </form>

            {/* Sticky save bar. Right-side padding leaves room for the floating
                customer-service FAB (and any user-installed browser-extension
                widgets that anchor bottom-right). Keeping buttons left of that
                gutter avoids visual collision regardless of overlay z-index. */}
            <div
                className={cn(
                    "sticky bottom-0 left-0 right-0 -mx-3 mt-6 border-t bg-background/95 backdrop-blur px-3 py-3 sm:-mx-6 sm:px-6 flex items-center justify-between gap-3 transition-colors",
                    isDirty && "bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900",
                )}
            >
                <p className="text-sm text-muted-foreground">
                    {isDirty ? "有未保存的修改" : "所有改动已保存"}
                </p>
                <div className="flex items-center gap-2 pr-2 sm:pr-20">
                    {isDirty && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => form.reset()}
                            disabled={saving}
                        >
                            放弃修改
                        </Button>
                    )}
                    <Button
                        type="button"
                        size="sm"
                        disabled={saving || !isDirty}
                        onClick={form.handleSubmit(onSubmit)}
                    >
                        {saving ? "保存中…" : "保存设置"}
                    </Button>
                </div>
            </div>
        </Form>
    )
}
