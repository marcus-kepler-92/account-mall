# Image Management Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 抽出共享 `MediaLibrary` 组件，为商品表单添加从图库选择图片功能，并简化 `/admin/files` 页面。

**Architecture:** 新建 `app/admin/components/media-library.tsx`（`mode: "manage" | "picker"`），`ImagePickerDialog` 封装 picker 模式。商品表单增加"从图库选择"按钮。`files/page.tsx` 替换为 `<MediaLibrary mode="manage" />`。不改动任何 API。

**Tech Stack:** Next.js App Router, React 19, TypeScript, shadcn/ui, Vercel Blob

---

### Task 1: 提取工具函数并写单元测试

**Files:**
- Create: `app/admin/components/media-library.tsx` (仅工具函数 + 类型)
- Create: `__tests__/admin/components/media-library.test.ts`

- [ ] **Step 1: 新建 media-library.tsx，只写工具函数和类型**

```tsx
"use client"

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
```

- [ ] **Step 2: 写失败测试**

新建 `__tests__/admin/components/media-library.test.ts`：

```ts
import { formatSize, fileNameFromPath, isImagePath } from "@/app/admin/components/media-library"

describe("formatSize", () => {
  it("formats bytes", () => expect(formatSize(512)).toBe("512 B"))
  it("formats KB", () => expect(formatSize(1536)).toBe("1.5 KB"))
  it("formats MB", () => expect(formatSize(2 * 1024 * 1024)).toBe("2.00 MB"))
})

describe("fileNameFromPath", () => {
  it("extracts filename from path", () =>
    expect(fileNameFromPath("products/abc-123.jpg")).toBe("abc-123.jpg"))
  it("returns input when no slash", () =>
    expect(fileNameFromPath("filename.jpg")).toBe("filename.jpg"))
})

describe("isImagePath", () => {
  it("returns true for jpg", () => expect(isImagePath("products/photo.jpg")).toBe(true))
  it("returns true for jpeg", () => expect(isImagePath("photo.jpeg")).toBe(true))
  it("returns true for png uppercase", () => expect(isImagePath("photo.PNG")).toBe(true))
  it("returns true for webp", () => expect(isImagePath("photo.webp")).toBe(true))
  it("returns false for pdf", () => expect(isImagePath("document.pdf")).toBe(false))
  it("returns false for no extension", () => expect(isImagePath("noext")).toBe(false))
})
```

- [ ] **Step 3: 运行测试确认失败（文件存在但函数未实现时不会失败 — 但此时函数已实现，应直接通过）**

```bash
npx jest __tests__/admin/components/media-library.test.ts --no-coverage
```

Expected: 7 tests PASS

- [ ] **Step 4: Commit**

```bash
git add app/admin/components/media-library.tsx __tests__/admin/components/media-library.test.ts
git commit -m "feat(media-library): add shared types and utility functions with tests"
```

---

### Task 2: 实现完整 MediaLibrary 组件（manage + picker 双模式）

**Files:**
- Modify: `app/admin/components/media-library.tsx` (添加组件实现)

- [ ] **Step 1: 在 media-library.tsx 中添加完整组件（追加到现有工具函数之后）**

将以下代码追加到 `app/admin/components/media-library.tsx` 的末尾（在现有工具函数之后）：

```tsx
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

type MediaLibraryProps =
  | { mode: "manage" }
  | { mode: "picker"; onSelect: (url: string) => void }

export function MediaLibrary(props: MediaLibraryProps) {
  const isManage = props.mode === "manage"

  // Shared state
  const [prefix, setPrefix] = useState<Prefix>("products")
  const [blobs, setBlobs] = useState<BlobItem[]>([])
  const [loading, setLoading] = useState(true)
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
        const data = (await res.json()) as { blobs: BlobItem[]; nextCursor?: string }
        setBlobs((prev) => (append ? [...prev, ...data.blobs] : data.blobs))
        setNextCursor(data.nextCursor)
      } finally {
        setLoading(false)
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
            <div className="flex aspect-video items-center justify-center bg-muted">
              {isImagePath(b.pathname) ? (
                <img src={b.url} alt="" className="h-full w-full object-cover" />
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
            <div className="flex aspect-video items-center justify-center bg-muted">
              {isImagePath(b.pathname) ? (
                <img src={b.url} alt="" className="h-full w-full object-cover" />
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
                <img src={b.url} alt="" className="size-10 rounded object-cover" />
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
            <Button variant="outline" onClick={loadMore} disabled={loading}>
              加载更多
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
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
```

注意：该文件最终的 import 语句需要放在文件顶部。完成后，文件结构为：
1. `"use client"` 指令
2. 所有 import 语句（原有 + 新增）
3. 工具函数和类型（PREFIX_OPTIONS, Prefix, BlobItem, formatSize, fileNameFromPath, isImagePath）
4. MediaLibraryProps 类型
5. MediaLibrary 组件

- [ ] **Step 2: 整理文件，确保 import 语句都在顶部**

最终 `app/admin/components/media-library.tsx` 完整结构：

```tsx
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
  // ... (paste the full component body from Step 1 of this task)
}
```

使用上面 Step 1 中的完整组件实现替换 `// ... (paste ...)` 注释。

- [ ] **Step 3: 运行测试确认仍通过**

```bash
npx jest __tests__/admin/components/media-library.test.ts --no-coverage
```

Expected: 7 tests PASS

- [ ] **Step 4: Commit**

```bash
git add app/admin/components/media-library.tsx
git commit -m "feat(media-library): implement MediaLibrary component with manage and picker modes"
```

---

### Task 3: 简化 files/page.tsx

**Files:**
- Modify: `app/admin/(main)/files/page.tsx`

- [ ] **Step 1: 替换整个文件内容**

将 `app/admin/(main)/files/page.tsx` 的全部内容替换为：

```tsx
import { PageHeader } from "@/app/admin/components"
import { MediaLibrary } from "@/app/admin/components/media-library"

export default function AdminFilesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="文件管理"
        description="按目录查看、上传与删除已上传的图片与凭证，可复制链接用于内容中引用"
      />
      <MediaLibrary mode="manage" />
    </div>
  )
}
```

注意：`"use client"` 指令不再需要，因为 `MediaLibrary` 内部已声明。

- [ ] **Step 2: 运行 lint 确认无报错**

```bash
npm run lint
```

Expected: 无 error（可能有关于其他文件的 warning，忽略即可）

- [ ] **Step 3: Commit**

```bash
git add app/admin/(main)/files/page.tsx
git commit -m "refactor(files): replace inline state with MediaLibrary component"
```

---

### Task 4: 新建 ImagePickerDialog 组件

**Files:**
- Create: `app/admin/components/image-picker-dialog.tsx`

- [ ] **Step 1: 新建文件**

```tsx
"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { MediaLibrary } from "./media-library"

interface ImagePickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (url: string) => void
}

export function ImagePickerDialog({
  open,
  onOpenChange,
  onSelect,
}: ImagePickerDialogProps) {
  const handleSelect = (url: string) => {
    onSelect(url)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle>选择图片</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <MediaLibrary mode="picker" onSelect={handleSelect} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: 导出到 barrel**

在 `app/admin/components/index.ts` 末尾追加：

```ts
export { MediaLibrary } from "./media-library"
export { ImagePickerDialog } from "./image-picker-dialog"
```

- [ ] **Step 3: 运行 lint**

```bash
npm run lint
```

Expected: 无 error

- [ ] **Step 4: Commit**

```bash
git add app/admin/components/image-picker-dialog.tsx app/admin/components/index.ts
git commit -m "feat(image-picker): add ImagePickerDialog and export MediaLibrary from barrel"
```

---

### Task 5: 在商品表单中集成图片选择器

**Files:**
- Modify: `app/components/product-form-basic-fields.tsx`

- [ ] **Step 1: 修改 product-form-basic-fields.tsx**

将文件完整替换为：

```tsx
"use client"

import { useState } from "react"
import { useFormContext } from "react-hook-form"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { ImageIcon, Loader2, Upload, Trash2 } from "lucide-react"
import type { ProductFormSchema } from "@/lib/validations/product"
import { ImagePickerDialog } from "@/app/admin/components/image-picker-dialog"

export function ProductFormBasicFields({
  isEditing,
  onSlugManualEdit,
}: {
  isEditing: boolean
  onSlugManualEdit: () => void
}) {
  const { control, setValue } = useFormContext<ProductFormSchema>()
  const [imageUploading, setImageUploading] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("请上传图片文件")
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("图片大小不能超过 2MB")
      return
    }
    setImageUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("pathPrefix", "products")
      const res = await fetch("/api/upload/image", {
        method: "POST",
        body: formData,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || "图片上传失败")
        return
      }
      const { url } = await res.json()
      if (url) setValue("image", url)
    } catch {
      toast.error("图片上传失败")
    } finally {
      setImageUploading(false)
      e.target.value = ""
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>基本信息</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField
          control={control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                商品名称 <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input placeholder="例如：ChatGPT Plus 账号" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                URL 别名 <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="chatgpt-plus-account"
                  {...field}
                  onChange={(e) => {
                    field.onChange(e)
                    if (!isEditing) onSlugManualEdit()
                  }}
                />
              </FormControl>
              <FormDescription>用于商品 URL，仅支持小写字母、数字和连字符</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="image"
          render={({ field }) => (
            <FormItem>
              <FormLabel>商品图片</FormLabel>
              <div className="space-y-2">
                {field.value ? (
                  <>
                    <div className="relative inline-block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={field.value}
                        alt="商品图片预览"
                        className="size-32 sm:size-50 rounded-md border object-cover"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute -right-2 -top-2 size-6"
                        onClick={() => field.onChange("")}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <label htmlFor="image-upload">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={imageUploading}
                          asChild
                        >
                          <span>
                            {imageUploading ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Upload className="size-4" />
                            )}
                            <span className="ml-1.5">重新上传</span>
                          </span>
                        </Button>
                      </label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPickerOpen(true)}
                      >
                        <ImageIcon className="size-4" />
                        <span className="ml-1.5">从图库选择</span>
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <label
                      htmlFor="image-upload"
                      className={`flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed p-6 transition-colors hover:border-foreground/30 hover:bg-accent/50 ${imageUploading ? "pointer-events-none opacity-60" : ""}`}
                    >
                      {imageUploading ? (
                        <Loader2 className="mb-2 size-6 animate-spin text-muted-foreground" />
                      ) : (
                        <Upload className="mb-2 size-6 text-muted-foreground" />
                      )}
                      <span className="text-sm text-muted-foreground">
                        {imageUploading ? "上传中…" : "点击上传图片"}
                      </span>
                      <span className="mt-1 text-xs text-muted-foreground">
                        支持 JPG、PNG、GIF，最大 2MB
                      </span>
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPickerOpen(true)}
                    >
                      <ImageIcon className="size-4" />
                      <span className="ml-1.5">从图库选择</span>
                    </Button>
                  </>
                )}
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={imageUploading}
                  onChange={handleImageUpload}
                />
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>

      <ImagePickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(url) => setValue("image", url)}
      />
    </Card>
  )
}
```

注意与原文件的差异：
1. 新增 `pickerOpen` state
2. 新增 `ImageIcon` import
3. 新增 `ImagePickerDialog` import
4. `handleImageUpload` 中加了 `formData.append("pathPrefix", "products")` （原文件缺少此参数，本次一并修复）
5. 有图片时新增「重新上传」+「从图库选择」两个按钮
6. 无图片时在上传区下方新增「从图库选择」按钮
7. 渲染 `<ImagePickerDialog>` 在 Card 内

- [ ] **Step 2: 运行 lint**

```bash
npm run lint
```

Expected: 无 error

- [ ] **Step 3: 运行所有测试**

```bash
npm test -- --no-coverage
```

Expected: 所有现有测试通过，无新失败

- [ ] **Step 4: Commit**

```bash
git add app/components/product-form-basic-fields.tsx
git commit -m "feat(product-form): add image picker button to select from existing uploads"
```

---

## 验收清单

- [ ] `/admin/files` 页面功能与改前一致（上传、删除、批量操作、网格/列表切换、分页）
- [ ] 商品创建页：无图片时可以点「从图库选择」打开 Dialog
- [ ] 商品创建页：选中图片点「确认选择」后 Dialog 关闭，图片回填到表单
- [ ] 商品编辑页：有图片时显示「重新上传」和「从图库选择」两个按钮
- [ ] Dialog 中可切换 4 个分类 Tab
- [ ] Dialog 中可翻页（超过 20 张时）
- [ ] 所有单元测试通过：`npm test -- --no-coverage`
