"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Loader2, CheckCircle2, Wallet, ImagePlus, X } from "lucide-react"

function buildWithdrawalSchema(minAmount: number, maxAmount: number) {
    return z.object({
        amount: z
            .string()
            .min(1, "请输入提现金额")
            .refine((v) => !Number.isNaN(parseFloat(v)), "请输入有效金额")
            .refine((v) => parseFloat(v) >= minAmount, `不能低于最低提现额度 ¥${minAmount.toFixed(2)}`)
            .refine((v) => parseFloat(v) <= maxAmount, "不能超过可提现余额"),
    })
}

type FormValues = { amount: string }

export function ApplyWithdrawalForm({
    withdrawableBalance,
    pendingWithdrawalTotal = 0,
    minAmount = 50,
    feePercent = 0,
}: {
    withdrawableBalance: number
    pendingWithdrawalTotal?: number
    minAmount?: number
    feePercent?: number
}) {
    const router = useRouter()
    const [file, setFile] = useState<File | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [submitted, setSubmitted] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const form = useForm<FormValues>({
        resolver: zodResolver(buildWithdrawalSchema(minAmount, withdrawableBalance)),
        defaultValues: { amount: "" },
        mode: "onChange",
    })

    const watchedAmount = form.watch("amount")
    const parsedAmount = parseFloat(watchedAmount)
    const hasValidAmount = !Number.isNaN(parsedAmount) && parsedAmount > 0
    const estimatedFee = hasValidAmount ? Math.round(parsedAmount * feePercent) / 100 : 0
    const estimatedActual = hasValidAmount ? Math.round((parsedAmount - estimatedFee) * 100) / 100 : 0

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const next = e.target.files?.[0] ?? null
        if (previewUrl) URL.revokeObjectURL(previewUrl)
        setPreviewUrl(null)
        setFile(next)
        if (next && next.type.startsWith("image/")) {
            setPreviewUrl(URL.createObjectURL(next))
        }
    }

    const handleRemoveFile = () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl)
        setPreviewUrl(null)
        setFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ""
    }

    const onSubmit = async ({ amount }: FormValues) => {
        if (!file) {
            toast.error("请上传收款码")
            return
        }
        try {
            const formData = new FormData()
            formData.set("amount", amount)
            formData.set("receiptImage", file)
            const res = await fetch("/api/distributor/withdrawals", {
                method: "POST",
                body: formData,
            })
            if (!res.ok) {
                const data = await res.json()
                toast.error(data.error || "申请失败")
                return
            }
            setSubmitted(true)
            form.reset()
            handleRemoveFile()
            router.refresh()
        } catch {
            toast.error("申请失败，请重试")
        }
    }

    if (withdrawableBalance <= 0) {
        return (
            <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center">
                <Wallet className="mx-auto size-10 text-muted-foreground" />
                <p className="mt-2 font-medium">暂无可提现余额</p>
                <p className="mt-1 text-sm text-muted-foreground">
                    {pendingWithdrawalTotal > 0
                        ? `您有 ¥${pendingWithdrawalTotal.toFixed(2)} 正在提现处理中，到账后可继续申请。`
                        : "订单佣金结算后将可申请提现"}
                </p>
                <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 min-h-11 touch-manipulation"
                    asChild
                >
                    <Link href="/distributor/withdrawals">查看提现记录</Link>
                </Button>
            </div>
        )
    }

    if (submitted) {
        return (
            <Alert className="border-success/50 bg-success/5">
                <CheckCircle2 className="size-4 text-success" />
                <AlertTitle>申请已提交</AlertTitle>
                <AlertDescription className="mt-1">
                    管理员将线下打款至您上传的收款码，到账时间以实际为准。
                    <div className="mt-3 flex flex-wrap gap-2">
                        <Button size="sm" className="min-h-11 touch-manipulation" asChild>
                            <Link href="/distributor/withdrawals">查看提现记录</Link>
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="min-h-11 touch-manipulation"
                            onClick={() => setSubmitted(false)}
                        >
                            继续申请
                        </Button>
                    </div>
                </AlertDescription>
            </Alert>
        )
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>提现金额（元）</FormLabel>
                            <div className="flex flex-wrap items-center gap-2">
                                <FormControl>
                                    <Input
                                        type="number"
                                        min={minAmount}
                                        step={0.01}
                                        max={withdrawableBalance}
                                        placeholder="0.00"
                                        className="w-40 font-medium"
                                        {...field}
                                    />
                                </FormControl>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="min-h-11 touch-manipulation"
                                    onClick={() =>
                                        form.setValue("amount", withdrawableBalance.toFixed(2), {
                                            shouldValidate: true,
                                        })
                                    }
                                >
                                    全部提现
                                </Button>
                            </div>
                            <FormDescription>
                                至少 ¥{minAmount.toFixed(2)}，最多可提现 ¥{withdrawableBalance.toFixed(2)}
                            </FormDescription>
                            {feePercent > 0 && hasValidAmount && (
                                <div className="mt-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground space-y-0.5">
                                    <div className="flex justify-between">
                                        <span>服务费（{feePercent}%）</span>
                                        <span aria-label={`服务费 ${estimatedFee.toFixed(2)} 元`}>- ¥{estimatedFee.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between font-medium text-foreground">
                                        <span>预计到账</span>
                                        <span aria-label={`预计到账 ${estimatedActual.toFixed(2)} 元`}>¥{estimatedActual.toFixed(2)}</span>
                                    </div>
                                </div>
                            )}
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="space-y-2">
                    <FormLabel>收款码（必传）</FormLabel>
                    <p className="text-xs text-muted-foreground">
                        上传支付宝或微信收款码，便于管理员打款。JPG/PNG/WebP，不超过 4MB。
                    </p>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        onChange={handleFileChange}
                        aria-label="选择收款码图片"
                    />
                    {!file ? (
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={(e) => {
                                e.preventDefault()
                                e.currentTarget.classList.add("border-primary/50", "bg-muted/50")
                            }}
                            onDragLeave={(e) => {
                                e.preventDefault()
                                e.currentTarget.classList.remove("border-primary/50", "bg-muted/50")
                            }}
                            onDrop={(e) => {
                                e.preventDefault()
                                e.currentTarget.classList.remove("border-primary/50", "bg-muted/50")
                                const f = e.dataTransfer.files[0]
                                if (f && f.type.startsWith("image/")) {
                                    setFile(f)
                                    setPreviewUrl(URL.createObjectURL(f))
                                } else {
                                    toast.error("请选择 JPG/PNG/WebP 图片")
                                }
                            }}
                            className="flex min-h-11 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/30 py-8 text-muted-foreground transition-colors touch-manipulation hover:border-primary/50 hover:bg-muted/50 hover:text-foreground"
                        >
                            <ImagePlus className="size-10" />
                            <span className="text-sm font-medium">点击或拖拽上传</span>
                        </button>
                    ) : (
                        <div className="flex flex-wrap items-start gap-4 rounded-lg border bg-muted/20 p-4">
                            {previewUrl && (
                                <img
                                    src={previewUrl}
                                    alt="收款码预览"
                                    className="h-24 w-24 rounded-md border object-cover"
                                />
                            )}
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{file.name}</p>
                                <p className="text-xs text-muted-foreground">
                                    {(file.size / 1024).toFixed(1)} KB
                                </p>
                                <div className="mt-2 flex gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="min-h-11 touch-manipulation"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        更换
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="min-h-11 touch-manipulation text-muted-foreground"
                                        onClick={handleRemoveFile}
                                    >
                                        <X className="size-4" />
                                        移除
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-3 border-t pt-4">
                    <Button
                        type="submit"
                        disabled={form.formState.isSubmitting || !file}
                        className="min-h-11 touch-manipulation"
                    >
                        {form.formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
                        提交申请
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="min-h-11 touch-manipulation"
                        asChild
                    >
                        <Link href="/distributor/withdrawals">查看提现记录</Link>
                    </Button>
                    <p className="text-xs text-muted-foreground">
                        打款由管理员线下处理，到账时间以实际为准。{feePercent > 0 && `实际到账金额扣除 ${feePercent}% 服务费。`}
                    </p>
                </div>
            </form>
        </Form>
    )
}
