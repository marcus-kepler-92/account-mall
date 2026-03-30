"use client"

import { useState, useMemo } from "react"
import { toast } from "sonner"
import { FlaskConical, Loader2, Copy, Check, AlertCircle, Search, Ban, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

type Product = {
    id: string
    name: string
    slug: string
    sourceUrl: string | null
}

type Account = {
    account: string
    password: string
    region: string
    isBlacklisted: boolean
}

type FetchMeta = {
    sourceUrl: string
    total: number
}

type Props = {
    products: Product[]
}

export function AutoFetchClient({ products }: Props) {
    const [selectedId, setSelectedId] = useState<string>("")
    const [loading, setLoading] = useState(false)
    const [meta, setMeta] = useState<FetchMeta | null>(null)
    const [accounts, setAccounts] = useState<Account[]>([])
    const [error, setError] = useState<string | null>(null)
    const [copied, setCopied] = useState<string | null>(null)
    const [filter, setFilter] = useState("")

    const handleFetch = async () => {
        if (!selectedId) { toast.error("请先选择商品"); return }
        setLoading(true)
        setMeta(null)
        setAccounts([])
        setError(null)
        setFilter("")
        try {
            const res = await fetch(`/api/admin/products/${selectedId}/test-fetch`, {
                method: "POST",
            })
            const data = await res.json() as {
                sourceUrl: string
                total: number
                availableCount: number
                blacklistedCount: number
                accounts: Account[]
                error?: string
            }
            if (!res.ok) { setError(data.error ?? "拉取失败"); return }
            setMeta({ sourceUrl: data.sourceUrl, total: data.total })
            setAccounts(data.accounts)
        } catch {
            setError("网络异常，请重试")
        } finally {
            setLoading(false)
        }
    }

    const handleCopy = async (text: string, key: string) => {
        try {
            await navigator.clipboard.writeText(text)
            setCopied(key)
            setTimeout(() => setCopied(null), 1500)
        } catch {
            toast.error("复制失败")
        }
    }

    const handleToggle = async (acc: Account) => {
        if (!selectedId) return
        const prev = acc.isBlacklisted
        // Optimistic update
        setAccounts((cur) =>
            cur.map((a) => a.account === acc.account ? { ...a, isBlacklisted: !prev } : a)
        )
        try {
            const res = await fetch(`/api/admin/products/${selectedId}/blacklist/toggle`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ account: acc.account }),
            })
            const data = await res.json() as { isBlacklisted?: boolean; error?: string }
            if (!res.ok) {
                setAccounts((cur) =>
                    cur.map((a) => a.account === acc.account ? { ...a, isBlacklisted: prev } : a)
                )
                toast.error(data.error ?? "操作失败")
            } else {
                toast.success(data.isBlacklisted ? "已拉黑" : "已解除拉黑")
            }
        } catch {
            setAccounts((cur) =>
                cur.map((a) => a.account === acc.account ? { ...a, isBlacklisted: prev } : a)
            )
            toast.error("网络异常")
        }
    }

    const availableCount = accounts.filter((a) => !a.isBlacklisted).length
    const blacklistedCount = accounts.filter((a) => a.isBlacklisted).length

    const rows = useMemo(() => {
        const sorted = [...accounts].sort(
            (a, b) => Number(a.isBlacklisted) - Number(b.isBlacklisted)
        )
        if (!filter.trim()) return sorted
        const q = filter.trim().toLowerCase()
        return sorted.filter((a) => a.account.toLowerCase().includes(q))
    }, [accounts, filter])

    const visibleAvailable = rows.filter((r) => !r.isBlacklisted).length

    return (
        <TooltipProvider delayDuration={0}>
            <div className="space-y-4">
                {/* Controls */}
                <div className="flex gap-2 flex-wrap">
                    <Select value={selectedId} onValueChange={setSelectedId}>
                        <SelectTrigger className="w-64">
                            <SelectValue placeholder="选择 AUTO_FETCH 商品" />
                        </SelectTrigger>
                        <SelectContent>
                            {products.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                    {p.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button
                        onClick={handleFetch}
                        disabled={loading || !selectedId}
                        className="gap-1.5"
                    >
                        {loading ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            <FlaskConical className="size-4" />
                        )}
                        {loading ? "拉取中…" : "拉取账号"}
                    </Button>
                </div>

                {/* Error */}
                {error && (
                    <Alert variant="destructive" className="max-w-lg">
                        <AlertCircle className="size-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {/* Results */}
                {meta && (
                    <div className="space-y-3">
                        {/* Summary + filter */}
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex gap-2 items-center">
                                <Badge variant="outline">共 {meta.total}</Badge>
                                <Badge
                                    variant="outline"
                                    className="border-success/50 bg-success/10 text-success"
                                >
                                    可用 {availableCount}
                                </Badge>
                                {blacklistedCount > 0 && (
                                    <Badge
                                        variant="outline"
                                        className="border-destructive/50 bg-destructive/10 text-destructive"
                                    >
                                        已拉黑 {blacklistedCount}
                                    </Badge>
                                )}
                            </div>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                                <Input
                                    placeholder="按账号筛选…"
                                    value={filter}
                                    onChange={(e) => setFilter(e.target.value)}
                                    className="pl-8 h-8 w-52 text-sm"
                                />
                            </div>
                            {filter && (
                                <span className="text-xs text-muted-foreground">
                                    显示 {rows.length} 条（可用 {visibleAvailable}）
                                </span>
                            )}
                        </div>

                        {/* Table */}
                        <div className="rounded-md border overflow-hidden">
                            <div className="grid grid-cols-[1fr_1fr_4rem_8rem_2.5rem] bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground border-b">
                                <span>账号</span>
                                <span>密码</span>
                                <span>地区</span>
                                <span className="text-center">发给客户</span>
                                <span />
                            </div>

                            <div className="divide-y max-h-[calc(100vh-320px)] overflow-y-auto">
                                {rows.length > 0 ? rows.map((acc, i) => (
                                    <AccountRow
                                        key={acc.account}
                                        acc={acc}
                                        rowIndex={i}
                                        copied={copied}
                                        onCopy={handleCopy}
                                        onToggle={handleToggle}
                                    />
                                )) : (
                                    <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                                        无匹配账号
                                    </div>
                                )}
                            </div>
                        </div>

                        <p className="text-xs text-muted-foreground font-mono break-all">
                            来源：{meta.sourceUrl}
                        </p>
                    </div>
                )}

                {/* Empty state */}
                {!loading && !meta && !error && (
                    <p className="text-sm text-muted-foreground">
                        选择商品后点击「拉取账号」验证来源是否正常
                    </p>
                )}
            </div>
        </TooltipProvider>
    )
}

// ── Account Row ────────────────────────────────────────────────────────────

function CopyIconButton({
    text,
    copyKey,
    copied,
    onCopy,
}: {
    text: string
    copyKey: string
    copied: string | null
    onCopy: (text: string, key: string) => void
}) {
    return (
        <button
            onClick={() => onCopy(text, copyKey)}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
        >
            {copied === copyKey ? (
                <Check className="size-3 text-green-500" />
            ) : (
                <Copy className="size-3" />
            )}
        </button>
    )
}

function AccountRow({
    acc,
    rowIndex,
    copied,
    onCopy,
    onToggle,
}: {
    acc: Account
    rowIndex: number
    copied: string | null
    onCopy: (text: string, key: string) => void
    onToggle: (acc: Account) => void
}) {
    const accKey = `acc-${rowIndex}`
    const pwKey = `pw-${rowIndex}`
    const combinedKey = `all-${rowIndex}`
    const combinedText = `账号：${acc.account}\n密码：${acc.password}`

    return (
        <div
            className={`grid grid-cols-[1fr_1fr_4rem_8rem_2.5rem] items-center gap-x-2 px-3 py-2 text-xs transition-colors ${
                acc.isBlacklisted ? "opacity-40 bg-muted/20" : "hover:bg-muted/20"
            }`}
        >
            {/* Account */}
            <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-mono break-all leading-snug">{acc.account}</span>
                <CopyIconButton text={acc.account} copyKey={accKey} copied={copied} onCopy={onCopy} />
            </div>

            {/* Password */}
            <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-mono break-all leading-snug">{acc.password}</span>
                <CopyIconButton text={acc.password} copyKey={pwKey} copied={copied} onCopy={onCopy} />
            </div>

            {/* Region */}
            <span className="text-muted-foreground">{acc.region || "—"}</span>

            {/* Combined copy */}
            <div className="flex justify-center">
                <Button
                    variant={copied === combinedKey ? "secondary" : "outline"}
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs"
                    onClick={() => onCopy(combinedText, combinedKey)}
                >
                    {copied === combinedKey ? (
                        <Check className="size-3 text-green-500" />
                    ) : (
                        <Copy className="size-3" />
                    )}
                    {copied === combinedKey ? "已复制" : "发给客户"}
                </Button>
            </div>

            {/* Blacklist toggle */}
            <div className="flex justify-center">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => onToggle(acc)}
                        >
                            {acc.isBlacklisted ? (
                                <Undo2 className="size-3.5 text-muted-foreground" />
                            ) : (
                                <Ban className="size-3.5 text-muted-foreground hover:text-destructive" />
                            )}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                        {acc.isBlacklisted ? "解除拉黑" : "拉黑"}
                    </TooltipContent>
                </Tooltip>
            </div>
        </div>
    )
}
