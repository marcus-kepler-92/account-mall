"use client"

import Image from "next/image"
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
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { cn, formatDateTime } from "@/lib/utils"

// ── Types & constants ──────────────────────────────────────────────────────

export const PREFIX_OPTIONS = [
  { value: "products", label: "商品图片" },
  { value: "guides", label: "指南图片" },
  { value: "announcements", label: "公告图片" },
  { value: "receipts", label: "提现凭证" },
] as const

export type Prefix = (typeof PREFIX_OPTIONS)[number]["value"]

export interface BlobItem {
  url: string
  pathname: string
  size: number
  uploadedAt: string
}

// ── Utility functions ──────────────────────────────────────────────────────

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function fileNameFromPath(pathname: string): string {
  const parts = pathname.split("/")
  return parts[parts.length - 1] ?? pathname
}

export function isImagePath(pathname: string): boolean {
  const ext = pathname.split(".").pop()?.toLowerCase()
  return ["jpg", "jpeg", "png", "gif", "webp"].includes(ext ?? "")
}

// ── Component ──────────────────────────────────────────────────────────────

type MediaLibraryProps =
  | { mode: "manage" }
  | { mode: "picker"; onSelect: (url: string) => void }

export function MediaLibrary(props: MediaLibraryProps) {
  const isManage = props.mode === "manage"

  // Shared state
  const [prefix, setPrefix] = useState<Prefix>("products")
  const [blobs, setBlobs] = useState<BlobItem[]>([])
  const [loading, setLoading] = useState(true)
  const [appending, setAppending] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | undefined>()

  // Manage-only state
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [selectedUrls, setSelectedUrls] = useState<string[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState<{ urls: string[] } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Picker-only state
  const [pickedUrl, setPickedUrl] = useState<string | null>(null)

  const fetchList = useCallback(
    async (cursor?: string, append = false) => {
      if (append) setAppending(true)
      else setLoading(true)
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
        const data = (await res.json()) as { blobs: BlobItem[]; nextCursor?: string }
        setBlobs((prev) => (append ? [...prev, ...data.blobs] : data.blobs))
        setNextCursor(data.nextCursor)
      } finally {
        if (append) setAppending(false)
        else setLoading(false)
      }
    },
    [prefix]
  )

  useEffect(() => {
    setSelectedUrls([])
    setPickedUrl(null)
    setNextCursor(undefined)
    fetchList()
  }, [fetchList])

  const loadMore = () => {
    if (nextCursor && !loading && !appending) fetchList(nextCursor, true)
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
    setSelectedUrls((prev) => (prev.length === blobs.length ? [] : blobs.map((b) => b.url)))
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
    if (!uploading) uploadFiles(e.dataTransfer.files)
  }

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const onDragLeave = () => setDragOver(false)

  const loadingGrid = (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-40 rounded-lg" />
      ))}
    </div>
  )

  const emptyState = (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16">
        <div className="rounded-full bg-muted p-4 mb-4">
          <FolderOpen className="size-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground mb-2">暂无文件</p>
        {isManage && (
          <>
            <p className="text-sm text-muted-foreground mb-4 text-center">
              点击「上传」或拖拽图片到此处上传到当前目录
            </p>
            <Button size="sm" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
              <Upload className="size-4" />
              上传
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )

  const gridContent = (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {blobs.map((b) =>
        isManage ? (
          <Card
            key={b.url}
            className={cn(
              "overflow-hidden transition-shadow",
              selectedUrls.includes(b.url) && "ring-2 ring-primary"
            )}
          >
            <div className="relative flex aspect-video items-center justify-center overflow-hidden bg-muted">
              {isImagePath(b.pathname) ? (
                <Image src={b.url} alt="" fill className="object-cover" />
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
                  {formatSize(b.size)} · {new Date(b.uploadedAt).toLocaleDateString()}
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
        ) : (
          <button
            key={b.url}
            type="button"
            onClick={() => setPickedUrl((prev) => (prev === b.url ? null : b.url))}
            className={cn(
              "group relative overflow-hidden rounded-lg border-2 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              pickedUrl === b.url
                ? "border-primary"
                : "border-transparent hover:border-muted-foreground/30"
            )}
          >
            <div className="relative flex aspect-video items-center justify-center overflow-hidden bg-muted">
              {isImagePath(b.pathname) ? (
                <Image src={b.url} alt="" fill className="object-cover" />
              ) : (
                <ImageIcon className="size-12 text-muted-foreground" />
              )}
            </div>
            {pickedUrl === b.url && (
              <div className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-primary">
                <Check className="size-3 text-primary-foreground" />
              </div>
            )}
            <div className="p-2">
              <p className="truncate text-xs text-muted-foreground">
                {fileNameFromPath(b.pathname)}
              </p>
            </div>
          </button>
        )
      )}
    </div>
  )

  const listContent = (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <Checkbox
              checked={blobs.length > 0 && selectedUrls.length === blobs.length}
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
                <Image src={b.url} alt="" width={40} height={40} className="size-10 rounded object-cover" />
              ) : (
                <div className="flex size-10 items-center justify-center rounded bg-muted">
                  <ImageIcon className="size-5 text-muted-foreground" />
                </div>
              )}
            </TableCell>
            <TableCell className="font-mono text-sm">{fileNameFromPath(b.pathname)}</TableCell>
            <TableCell className="text-muted-foreground">{formatSize(b.size)}</TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {formatDateTime(b.uploadedAt)}
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
                  onClick={() => setDeleteConfirm({ urls: [b.url] })}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Manage toolbar */}
      {isManage && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {selectedUrls.length > 0 ? (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
              <span className="text-sm text-muted-foreground">已选 {selectedUrls.length} 项</span>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteConfirm({ urls: selectedUrls })}
                disabled={deleting}
              >
                <Trash2 className="size-4" />
                删除选中
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedUrls([])}>
                取消选择
              </Button>
            </div>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode((v) => (v === "grid" ? "list" : "grid"))}
            >
              {viewMode === "grid" ? (
                <List className="size-4" />
              ) : (
                <LayoutGrid className="size-4" />
              )}
              <span className="ml-1.5">{viewMode === "grid" ? "列表" : "网格"}</span>
            </Button>
            <Button size="sm" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
              {uploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              <span className="ml-1.5">上传</span>
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) uploadFiles(e.target.files)
                e.target.value = ""
              }}
            />
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={prefix} onValueChange={(v) => setPrefix(v as Prefix)}>
        <TabsList className="w-full sm:w-auto">
          {PREFIX_OPTIONS.map((opt) => (
            <TabsTrigger key={opt.value} value={opt.value}>
              {opt.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Content area */}
      <div
        className={cn(
          "rounded-lg transition-colors",
          isManage && "min-h-[320px] border-2 border-dashed p-4",
          isManage && dragOver && "border-primary bg-primary/5",
          !isManage && "min-h-[300px]"
        )}
        {...(isManage && { onDrop, onDragOver, onDragLeave })}
      >
        {loading
          ? loadingGrid
          : blobs.length === 0
            ? emptyState
            : isManage && viewMode === "list"
              ? listContent
              : gridContent}
        {nextCursor && !loading && (
          <div className="flex justify-center pt-4">
            <Button variant="outline" onClick={loadMore} disabled={appending}>
              {appending ? <Loader2 className="size-4 animate-spin" /> : "加载更多"}
            </Button>
          </div>
        )}
      </div>

      {/* Picker confirm footer */}
      {!isManage && (
        <div className="flex justify-end">
          <Button
            disabled={!pickedUrl}
            onClick={() => {
              if (pickedUrl && props.mode === "picker") props.onSelect(pickedUrl)
            }}
          >
            确认选择
          </Button>
        </div>
      )}

      {/* Delete confirmation dialog (manage only) */}
      {isManage && (
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
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                {deleting ? <Loader2 className="size-4 animate-spin" /> : "删除"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
