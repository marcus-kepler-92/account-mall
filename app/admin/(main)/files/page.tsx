"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
    FolderOpen,
    Upload,
    LayoutGrid,
    List,
    Copy,
    Trash2,
    ImageIcon,
    Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const PREFIX_OPTIONS = [
    { value: "products", label: "商品图片" },
    { value: "guides", label: "指南图片" },
    { value: "announcements", label: "公告图片" },
    { value: "receipts", label: "提现凭证" },
] as const

type Prefix = (typeof PREFIX_OPTIONS)[number]["value"]

interface BlobItem {
    url: string
    pathname: string
    size: number
    uploadedAt: string
}

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function fileNameFromPath(pathname: string): string {
    const parts = pathname.split("/")
    return parts[parts.length - 1] ?? pathname
}

function isImagePath(pathname: string): boolean {
    const ext = pathname.split(".").pop()?.toLowerCase()
    return ["jpg", "jpeg", "png", "gif", "webp"].includes(ext ?? "")
}

export default function AdminFilesPage() {
    const [prefix, setPrefix] = useState<Prefix>("products")
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
    const [blobs, setBlobs] = useState<BlobItem[]>([])
    const [nextCursor, setNextCursor] = useState<string | undefined>(undefined)
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [dragOver, setDragOver] = useState(false)
    const [selectedUrls, setSelectedUrls] = useState<string[]>([])
    const [deleteConfirm, setDeleteConfirm] = useState<{ urls: string[] } | null>(null)
    const [deleting, setDeleting] = useState(false)
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const fetchList = useCallback(
        async (cursor?: string, append = false) => {
            setLoading(true)
            try {
                const params = new URLSearchParams({ prefix, limit: "20" })
                if (cursor) params.set("cursor", cursor)
                const res = await fetch(`/api/admin/files?${params}`)
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}))
                    toast.error(data.error ?? "加载文件列表失败")
                    if (!append) setBlobs([])
                    return
                }
                const data = (await res.json()) as {
                    blobs: BlobItem[]
                    nextCursor?: string
                }
                if (append) {
                    setBlobs((prev) => [...prev, ...data.blobs])
                } else {
                    setBlobs(data.blobs)
                }
                setNextCursor(data.nextCursor)
            } finally {
                setLoading(false)
            }
        },
        [prefix]
    )

    useEffect(() => {
        setSelectedUrls([])
        setNextCursor(undefined)
        fetchList()
    }, [fetchList])

    const loadMore = () => {
        if (nextCursor && !loading) fetchList(nextCursor, true)
    }

    const copyUrl = (url: string) => {
        navigator.clipboard.writeText(url).then(
            () => toast.success("链接已复制"),
            () => toast.error("复制失败")
        )
    }

    const handleDelete = async (urls: string[]) => {
        setDeleting(true)
        try {
            const res = await fetch("/api/admin/files", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ urls }),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                toast.error(data.error ?? "删除失败")
                return
            }
            setBlobs((prev) => prev.filter((b) => !urls.includes(b.url)))
            setSelectedUrls((prev) => prev.filter((u) => !urls.includes(u)))
            setDeleteConfirm(null)
            toast.success("已删除")
        } finally {
            setDeleting(false)
        }
    }

    const toggleSelect = (url: string) => {
        setSelectedUrls((prev) =>
            prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]
        )
    }

    const selectAll = () => {
        if (selectedUrls.length === blobs.length) {
            setSelectedUrls([])
        } else {
            setSelectedUrls(blobs.map((b) => b.url))
        }
    }

    const uploadFiles = async (files: FileList | File[]) => {
        const fileArray = Array.from(files).filter((f) => f.type.startsWith("image/"))
        if (fileArray.length === 0) {
            toast.error("请选择图片文件")
            return
        }
        setUploading(true)
        let success = 0
        for (const file of fileArray) {
            try {
                const form = new FormData()
                form.set("file", file)
                form.set("pathPrefix", prefix)
                const res = await fetch("/api/upload/image", { method: "POST", body: form })
                if (res.ok) {
                    success++
                } else {
                    const data = await res.json().catch(() => ({}))
                    toast.error(data.error ?? `上传失败: ${file.name}`)
                }
            } catch {
                toast.error(`上传失败: ${file.name}`)
            }
        }
        if (success > 0) {
            toast.success(`成功上传 ${success} 个文件`)
            fetchList()
        }
        setUploading(false)
    }

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(false)
        if (uploading) return
        const files = e.dataTransfer.files
        if (files.length) uploadFiles(files)
    }

    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(true)
    }

    const onDragLeave = () => setDragOver(false)

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">文件管理</h2>
                    <p className="text-muted-foreground">
                        按目录查看、上传与删除已上传的图片与凭证，可复制链接用于内容中引用
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                            const files = e.target.files
                            if (files?.length) uploadFiles(files)
                            e.target.value = ""
                        }}
                    />
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
                    >
                        {viewMode === "grid" ? (
                            <List className="size-4" />
                        ) : (
                            <LayoutGrid className="size-4" />
                        )}
                        <span className="ml-1.5">{viewMode === "grid" ? "列表" : "网格"}</span>
                    </Button>
                    <Button
                        size="sm"
                        disabled={uploading}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        {uploading ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            <Upload className="size-4" />
                        )}
                        <span className="ml-1.5">上传</span>
                    </Button>
                </div>
            </div>

            <Tabs value={prefix} onValueChange={(v) => setPrefix(v as Prefix)}>
                <TabsList className="w-full sm:w-auto">
                    {PREFIX_OPTIONS.map((opt) => (
                        <TabsTrigger key={opt.value} value={opt.value}>
                            {opt.label}
                        </TabsTrigger>
                    ))}
                </TabsList>

                {selectedUrls.length > 0 && (
                    <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
                        <span className="text-sm text-muted-foreground">
                            已选 {selectedUrls.length} 项
                        </span>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setDeleteConfirm({ urls: selectedUrls })}
                            disabled={deleting}
                        >
                            <Trash2 className="size-4" />
                            删除选中
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedUrls([])}
                        >
                            取消选择
                        </Button>
                    </div>
                )}

                <div
                    className={cn(
                        "min-h-[320px] rounded-lg border-2 border-dashed p-4 transition-colors",
                        dragOver && "border-primary bg-primary/5"
                    )}
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                >
                    {loading ? (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <Skeleton key={i} className="h-40 rounded-lg" />
                            ))}
                        </div>
                    ) : blobs.length === 0 ? (
                        <Card>
                            <CardContent className="flex flex-col items-center justify-center py-16">
                                <div className="rounded-full bg-muted p-4 mb-4">
                                    <FolderOpen className="size-8 text-muted-foreground" />
                                </div>
                                <p className="text-muted-foreground mb-2">暂无文件</p>
                                <p className="text-sm text-muted-foreground mb-4 text-center">
                                    点击「上传」或拖拽图片到此处上传到当前目录
                                </p>
                                <Button
                                    size="sm"
                                    disabled={uploading}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Upload className="size-4" />
                                    上传
                                </Button>
                            </CardContent>
                        </Card>
                    ) : viewMode === "grid" ? (
                        <div className="space-y-4">
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {blobs.map((b) => (
                                    <Card
                                        key={b.url}
                                        className={cn(
                                            "overflow-hidden transition-shadow",
                                            selectedUrls.includes(b.url) && "ring-2 ring-primary"
                                        )}
                                    >
                                        <div className="flex aspect-video items-center justify-center bg-muted">
                                            {isImagePath(b.pathname) ? (
                                                <img
                                                    src={b.url}
                                                    alt=""
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : (
                                                <ImageIcon className="size-12 text-muted-foreground" />
                                            )}
                                        </div>
                                        <CardContent className="p-2 flex items-center gap-2">
                                            <Checkbox
                                                checked={selectedUrls.includes(b.url)}
                                                onCheckedChange={() => toggleSelect(b.url)}
                                            />
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-xs text-muted-foreground">
                                                    {fileNameFromPath(b.pathname)}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {formatSize(b.size)} ·{" "}
                                                    {new Date(b.uploadedAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <div className="flex shrink-0 gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="size-7"
                                                    onClick={() => copyUrl(b.url)}
                                                >
                                                    <Copy className="size-3.5" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="size-7 text-destructive hover:text-destructive"
                                                    onClick={() => setDeleteConfirm({ urls: [b.url] })}
                                                >
                                                    <Trash2 className="size-3.5" />
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                            {nextCursor && (
                                <div className="flex justify-center">
                                    <Button
                                        variant="outline"
                                        onClick={loadMore}
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <Loader2 className="size-4 animate-spin" />
                                        ) : (
                                            "加载更多"
                                        )}
                                    </Button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-10">
                                            <Checkbox
                                                checked={
                                                    blobs.length > 0 &&
                                                    selectedUrls.length === blobs.length
                                                }
                                                onCheckedChange={selectAll}
                                            />
                                        </TableHead>
                                        <TableHead className="w-16">预览</TableHead>
                                        <TableHead>文件名</TableHead>
                                        <TableHead>大小</TableHead>
                                        <TableHead>上传时间</TableHead>
                                        <TableHead className="w-24">操作</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {blobs.map((b) => (
                                        <TableRow key={b.url}>
                                            <TableCell>
                                                <Checkbox
                                                    checked={selectedUrls.includes(b.url)}
                                                    onCheckedChange={() => toggleSelect(b.url)}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                {isImagePath(b.pathname) ? (
                                                    <img
                                                        src={b.url}
                                                        alt=""
                                                        className="size-10 rounded object-cover"
                                                    />
                                                ) : (
                                                    <div className="flex size-10 items-center justify-center rounded bg-muted">
                                                        <ImageIcon className="size-5 text-muted-foreground" />
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="font-mono text-sm">
                                                {fileNameFromPath(b.pathname)}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {formatSize(b.size)}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {new Date(b.uploadedAt).toLocaleString()}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="size-7"
                                                        onClick={() => copyUrl(b.url)}
                                                    >
                                                        <Copy className="size-3.5" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="size-7 text-destructive hover:text-destructive"
                                                        onClick={() =>
                                                            setDeleteConfirm({ urls: [b.url] })
                                                        }
                                                    >
                                                        <Trash2 className="size-3.5" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            {nextCursor && (
                                <div className="flex justify-center">
                                    <Button
                                        variant="outline"
                                        onClick={loadMore}
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <Loader2 className="size-4 animate-spin" />
                                        ) : (
                                            "加载更多"
                                        )}
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </Tabs>

            <AlertDialog
                open={!!deleteConfirm}
                onOpenChange={(open) => !open && setDeleteConfirm(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>确认删除</AlertDialogTitle>
                        <AlertDialogDescription>
                            {deleteConfirm?.urls.length === 1
                                ? "确定要删除该文件吗？此操作不可恢复。"
                                : `确定要删除选中的 ${deleteConfirm?.urls.length} 个文件吗？此操作不可恢复。`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault()
                                if (deleteConfirm) handleDelete(deleteConfirm.urls)
                            }}
                            disabled={deleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleting ? <Loader2 className="size-4 animate-spin" /> : "删除"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
