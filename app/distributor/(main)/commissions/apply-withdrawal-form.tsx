"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, CheckCircle2, Wallet, ImagePlus, X } from "lucide-react"

export function ApplyWithdrawalForm({
    withdrawableBalance,
    pendingWithdrawalTotal = 0,
    minAmount = 50,
}: {
    withdrawableBalance: number
    /** 提现中金额，用于在余额为 0 时提示用户 */
    pendingWithdrawalTotal?: number
    /** 单笔最低提现金额（元），默认 50 */
    minAmount?: number
}) {
    const router = useRouter()
    const [amount, setAmount] = useState("")
    const [file, setFile] = useState<File | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const numAmount = parseFloat(amount)
    const amountValid =
        !Number.isNaN(numAmount) &&
        numAmount >= minAmount &&
        numAmount <= withdrawableBalance
    const canSubmit = amountValid && !!file && !loading

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!amountValid || !file) return
        setLoading(true)
        try {
            const formData = new FormData()
            formData.set("amount", String(numAmount))
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
            setAmount("")
            handleRemoveFile()
            router.refresh()
        } catch {
            toast.error("申请失败，请重试")
        } finally {
            setLoading(false)
        }
    }

    const setMaxAmount = () => {
        setAmount(withdrawableBalance.toFixed(2))
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
                <Button variant="outline" size="sm" className="mt-4 min-h-11 touch-manipulation" asChild>
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
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="withdrawal-amount">提现金额（元）</Label>
                <div className="flex flex-wrap items-center gap-2">
                    <Input
                        id="withdrawal-amount"
                        type="number"
                        min={minAmount}
                        step={0.01}
                        max={withdrawableBalance}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-40 font-medium"
                        aria-invalid={amount !== "" && !amountValid}
                    />
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-11 touch-manipulation"
                        onClick={setMaxAmount}
                    >
                        全部提现
                    </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                    至少 ¥{minAmount.toFixed(2)}，最多可提现 ¥{withdrawableBalance.toFixed(2)}
                </p>
                {amount !== "" && !Number.isNaN(numAmount) && numAmount < minAmount && (
                    <p className="text-xs text-destructive">
                        不能低于最低提现额度 ¥{minAmount.toFixed(2)}
                    </p>
                )}
                {amount !== "" && !Number.isNaN(numAmount) && numAmount >= minAmount && numAmount > withdrawableBalance && (
                    <p className="text-xs text-destructive">
                        不能超过可提现余额
                    </p>
                )}
            </div>

            <div className="space-y-2">
                <Label>收款码（必传）</Label>
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
                <Button type="submit" disabled={!canSubmit} className="min-h-11 touch-manipulation">
                    {loading ? (
                        <Loader2 className="size-4 animate-spin" />
                    ) : (
                        "提交申请"
                    )}
                </Button>
                <Button type="button" variant="ghost" size="sm" className="min-h-11 touch-manipulation" asChild>
                    <Link href="/distributor/withdrawals">查看提现记录</Link>
                </Button>
                <p className="text-xs text-muted-foreground">
                    打款由管理员线下处理，到账时间以实际为准。
                </p>
            </div>
        </form>
    )
}
