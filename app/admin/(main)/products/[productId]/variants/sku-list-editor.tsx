"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Loader2, Plus, Trash2, Check } from "lucide-react"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { cn } from "@/lib/utils"

// Form-level row schema — keeps numeric fields as strings for Input compatibility
// and mirrors the API-side `variantCreateSchema` constraints.
const rowSchema = z.object({
    name: z.string().min(1, "名称必填").max(200, "名称过长"),
    price: z
        .string()
        .refine(
            (v) => v !== "" && !Number.isNaN(parseFloat(v)) && parseFloat(v) >= 0,
            "售价必须是非负数字",
        ),
    unitCost: z
        .string()
        .refine(
            (v) => v === "" || (!Number.isNaN(parseFloat(v)) && parseFloat(v) >= 0),
            "成本必须是非负数字",
        ),
    stockQuantity: z
        .string()
        .refine(
            (v) =>
                v !== "" && Number.isInteger(Number(v)) && Number(v) >= 0,
            "库存必须是非负整数",
        ),
    sortOrder: z
        .string()
        .refine(
            (v) => v === "" || Number.isInteger(Number(v)),
            "排序必须是整数",
        ),
    isActive: z.boolean(),
})

export type VariantDraft = {
    id?: string // server-assigned in edit mode
    name: string
    price: string
    unitCost: string
    stockQuantity: string
    sortOrder: string
    isActive: boolean
    /** create-mode only: stable React key for un-saved rows */
    _localId?: string
}

type RowErrors = Partial<Record<keyof VariantDraft, string>>

type Mode = "create" | "edit"

type Props = {
    value: VariantDraft[]
    onChange?: (next: VariantDraft[]) => void
    mode: Mode
    productId?: string
    onRowSaved?: (id: string) => void
}

type RowMeta = {
    saving?: boolean
    savedAt?: number
    errors?: RowErrors
}

function emptyDraft(): VariantDraft {
    return {
        id: undefined,
        name: "",
        price: "",
        unitCost: "",
        stockQuantity: "0",
        sortOrder: "0",
        isActive: true,
        _localId: makeLocalId(),
    }
}

function makeLocalId() {
    return `local-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`
}

function toPayload(draft: VariantDraft) {
    return {
        name: draft.name.trim(),
        price: draft.price === "" ? 0 : parseFloat(draft.price),
        unitCost:
            draft.unitCost && draft.unitCost !== ""
                ? parseFloat(draft.unitCost)
                : null,
        stockQuantity:
            draft.stockQuantity === "" ? 0 : parseInt(draft.stockQuantity, 10),
        sortOrder:
            draft.sortOrder === "" ? 0 : parseInt(draft.sortOrder, 10),
        isActive: draft.isActive,
    }
}

function validateRow(row: VariantDraft): RowErrors | null {
    const result = rowSchema.safeParse(row)
    if (result.success) return null
    const errors: RowErrors = {}
    for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof VariantDraft
        if (!errors[field]) errors[field] = issue.message
    }
    return errors
}

type ListResponse = { variants: ServerVariant[] }
type ServerVariant = {
    id: string
    name: string
    price: string
    unitCost: string | null
    stockQuantity: number
    sortOrder: number
    isActive: boolean
}

function fromServer(v: ServerVariant): VariantDraft {
    return {
        id: v.id,
        name: v.name,
        price: v.price,
        unitCost: v.unitCost ?? "",
        stockQuantity: String(v.stockQuantity),
        sortOrder: String(v.sortOrder),
        isActive: v.isActive,
    }
}

export function SkuListEditor({
    value,
    onChange,
    mode,
    productId,
    onRowSaved,
}: Props) {
    const isEdit = mode === "edit"
    if (isEdit && !productId) {
        throw new Error("SkuListEditor: productId is required in edit mode")
    }

    // Edit mode owns the row state internally; create mode is fully controlled.
    const [editRows, setEditRows] = useState<VariantDraft[]>([])
    const [loading, setLoading] = useState(isEdit)
    const [rowMeta, setRowMeta] = useState<Record<string, RowMeta>>({})
    const [confirmDelete, setConfirmDelete] = useState<{
        key: string
        name: string
    } | null>(null)
    const [deleting, setDeleting] = useState(false)

    const rows = isEdit ? editRows : value

    // ─── Initial load (edit mode only) ────────────────────────────────────────
    useEffect(() => {
        if (!isEdit) return
        let cancelled = false
        ;(async () => {
            try {
                const res = await fetch(
                    `/api/admin/products/${productId}/variants`,
                )
                if (!res.ok) throw new Error("Failed to load variants")
                const data = (await res.json()) as ListResponse
                if (!cancelled) setEditRows(data.variants.map(fromServer))
            } catch {
                if (!cancelled) toast.error("加载 SKU 列表失败")
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [isEdit, productId])

    // ─── Row key (id in edit mode, _localId before save) ──────────────────────
    const keyOf = (row: VariantDraft) => row.id ?? row._localId ?? ""

    // ─── Mutators that work for both modes ────────────────────────────────────
    const updateRow = useCallback(
        (idx: number, patch: Partial<VariantDraft>) => {
            if (isEdit) {
                setEditRows((prev) => {
                    const next = [...prev]
                    next[idx] = { ...next[idx], ...patch }
                    return next
                })
            } else {
                const next = [...value]
                next[idx] = { ...next[idx], ...patch }
                onChange?.(next)
            }
        },
        [isEdit, value, onChange],
    )

    const appendRow = useCallback(() => {
        const draft = emptyDraft()
        if (isEdit) {
            setEditRows((prev) => [...prev, draft])
        } else {
            onChange?.([...value, draft])
        }
    }, [isEdit, value, onChange])

    const removeRowAt = useCallback(
        (idx: number) => {
            if (isEdit) {
                setEditRows((prev) => prev.filter((_, i) => i !== idx))
            } else {
                onChange?.(value.filter((_, i) => i !== idx))
            }
        },
        [isEdit, value, onChange],
    )

    // ─── Edit-mode autosave on blur ───────────────────────────────────────────
    const savingRef = useRef(new Set<string>())

    const persistRow = useCallback(
        async (idx: number, override?: Partial<VariantDraft>) => {
            if (!isEdit) return
            const current = { ...editRows[idx], ...(override ?? {}) }
            const key = keyOf(current)
            if (!key || savingRef.current.has(key)) return

            const errors = validateRow(current)
            if (errors) {
                setRowMeta((m) => ({
                    ...m,
                    [key]: { ...m[key], errors, saving: false },
                }))
                return
            }

            savingRef.current.add(key)
            setRowMeta((m) => ({
                ...m,
                [key]: { ...m[key], saving: true, errors: undefined },
            }))

            try {
                if (current.id) {
                    // Existing row → PATCH all fields (idempotent)
                    const res = await fetch(
                        `/api/admin/products/${productId}/variants/${current.id}`,
                        {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(toPayload(current)),
                        },
                    )
                    if (!res.ok) {
                        const data = await res.json().catch(() => ({}))
                        toast.error(data?.error ?? "保存失败")
                        setRowMeta((m) => ({
                            ...m,
                            [key]: {
                                ...m[key],
                                saving: false,
                                errors: extractFieldErrors(data),
                            },
                        }))
                        return
                    }
                    const saved = (await res.json()) as ServerVariant
                    setEditRows((prev) => {
                        const next = [...prev]
                        // Find the row we updated (its id is stable).
                        const i = next.findIndex((r) => r.id === current.id)
                        if (i >= 0) next[i] = fromServer(saved)
                        return next
                    })
                    setRowMeta((m) => ({
                        ...m,
                        [key]: { saving: false, savedAt: Date.now() },
                    }))
                    onRowSaved?.(saved.id)
                } else {
                    // New row → POST, back-fill id
                    const res = await fetch(
                        `/api/admin/products/${productId}/variants`,
                        {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(toPayload(current)),
                        },
                    )
                    if (!res.ok) {
                        const data = await res.json().catch(() => ({}))
                        toast.error(data?.error ?? "创建失败")
                        setRowMeta((m) => ({
                            ...m,
                            [key]: {
                                ...m[key],
                                saving: false,
                                errors: extractFieldErrors(data),
                            },
                        }))
                        return
                    }
                    const saved = (await res.json()) as ServerVariant
                    const localId = current._localId
                    setEditRows((prev) => {
                        const next = [...prev]
                        const i = next.findIndex(
                            (r) => !r.id && r._localId === localId,
                        )
                        if (i >= 0) next[i] = fromServer(saved)
                        return next
                    })
                    // Move row meta from local key to server key.
                    setRowMeta((m) => {
                        const nextMeta = { ...m }
                        delete nextMeta[key]
                        nextMeta[saved.id] = {
                            saving: false,
                            savedAt: Date.now(),
                        }
                        return nextMeta
                    })
                    onRowSaved?.(saved.id)
                }
            } catch {
                toast.error("网络错误")
                setRowMeta((m) => ({
                    ...m,
                    [key]: { ...m[key], saving: false },
                }))
            } finally {
                savingRef.current.delete(key)
            }
        },
        [isEdit, editRows, productId, onRowSaved],
    )

    // ─── Switch toggle in edit mode → immediate PATCH ─────────────────────────
    const toggleActive = useCallback(
        async (idx: number, nextValue: boolean) => {
            updateRow(idx, { isActive: nextValue })
            if (!isEdit) return
            const row = editRows[idx]
            // Only PATCH if row has been created. Otherwise it's just local state
            // until the user fills in the rest.
            if (!row?.id) return
            try {
                const res = await fetch(
                    `/api/admin/products/${productId}/variants/${row.id}`,
                    {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ isActive: nextValue }),
                    },
                )
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}))
                    toast.error(data?.error ?? "操作失败")
                    // Revert
                    updateRow(idx, { isActive: !nextValue })
                    return
                }
                toast.success(nextValue ? "已启用" : "已停用")
            } catch {
                toast.error("操作失败")
                updateRow(idx, { isActive: !nextValue })
            }
        },
        [isEdit, editRows, productId, updateRow],
    )

    // ─── Delete row ───────────────────────────────────────────────────────────
    const handleRequestDelete = (row: VariantDraft) => {
        setConfirmDelete({ key: keyOf(row), name: row.name || "未命名 SKU" })
    }

    const handleConfirmDelete = async () => {
        if (!confirmDelete) return
        const idx = rows.findIndex((r) => keyOf(r) === confirmDelete.key)
        if (idx < 0) {
            setConfirmDelete(null)
            return
        }
        const row = rows[idx]

        // Un-saved row in edit mode (or any row in create mode) → just remove locally
        if (!isEdit || !row.id) {
            removeRowAt(idx)
            setConfirmDelete(null)
            return
        }

        setDeleting(true)
        try {
            const res = await fetch(
                `/api/admin/products/${productId}/variants/${row.id}`,
                { method: "DELETE" },
            )
            if (res.ok) {
                removeRowAt(idx)
                toast.success("SKU 已删除")
                setConfirmDelete(null)
                return
            }
            if (res.status === 409) {
                toast.error("存在关联订单，请改为停用")
            } else {
                const data = await res.json().catch(() => ({}))
                toast.error(data?.error ?? "删除失败")
            }
            setConfirmDelete(null)
        } catch {
            toast.error("删除失败")
        } finally {
            setDeleting(false)
        }
    }

    // ─── Render ───────────────────────────────────────────────────────────────
    const showEmpty = !loading && rows.length === 0

    const table = (
        <div className="rounded-md border">
            <table className="w-full caption-bottom text-sm">
                <thead className="[&_tr]:border-b">
                    <tr className="border-b">
                        <th className="text-foreground h-10 px-2 text-left align-middle font-medium">
                            名称<span className="text-destructive"> *</span>
                        </th>
                        <th className="text-foreground h-10 px-2 text-left align-middle font-medium w-[120px]">
                            售价 (¥)<span className="text-destructive"> *</span>
                        </th>
                        <th className="text-foreground h-10 px-2 text-left align-middle font-medium w-[120px]">
                            成本 (¥)
                        </th>
                        <th className="text-foreground h-10 px-2 text-left align-middle font-medium w-[100px]">
                            库存
                        </th>
                        <th className="text-foreground h-10 px-2 text-left align-middle font-medium w-[80px]">
                            排序
                        </th>
                        <th className="text-foreground h-10 px-2 text-center align-middle font-medium w-[80px]">
                            启用
                        </th>
                        <th className="text-foreground h-10 px-2 text-right align-middle font-medium w-[60px]">
                            操作
                        </th>
                    </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                    {showEmpty ? (
                        <tr>
                            <td
                                colSpan={7}
                                className="h-20 text-center text-muted-foreground p-2"
                            >
                                暂无 SKU，请点击下方按钮新建
                            </td>
                        </tr>
                    ) : null}
                    {loading ? (
                        <tr>
                            <td
                                colSpan={7}
                                className="h-20 text-center text-muted-foreground p-2"
                            >
                                加载中…
                            </td>
                        </tr>
                    ) : null}
                    {rows.map((row, idx) => {
                        const key = keyOf(row)
                        const meta = rowMeta[key] ?? {}
                        const errors = meta.errors ?? {}
                        const justSaved =
                            meta.savedAt != null &&
                            Date.now() - meta.savedAt < 4000

                        return (
                            <tr
                                key={key || idx}
                                className="hover:bg-muted/30 border-b transition-colors"
                            >
                                <td className="p-2 align-top">
                                    <Input
                                        aria-label={`SKU 名称 ${idx + 1}`}
                                        placeholder="如：1 个月 / 标准版"
                                        value={row.name}
                                        onChange={(e) =>
                                            updateRow(idx, {
                                                name: e.target.value,
                                            })
                                        }
                                        onBlur={() => persistRow(idx)}
                                        className={cn(
                                            errors.name && "border-destructive",
                                        )}
                                    />
                                    {errors.name && (
                                        <p className="text-xs text-destructive mt-1">
                                            {errors.name}
                                        </p>
                                    )}
                                </td>
                                <td className="p-2 align-top">
                                    <Input
                                        aria-label={`SKU 售价 ${idx + 1}`}
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={row.price}
                                        onChange={(e) =>
                                            updateRow(idx, {
                                                price: e.target.value,
                                            })
                                        }
                                        onBlur={() => persistRow(idx)}
                                        className={cn(
                                            errors.price &&
                                                "border-destructive",
                                        )}
                                    />
                                    {errors.price && (
                                        <p className="text-xs text-destructive mt-1">
                                            {errors.price}
                                        </p>
                                    )}
                                </td>
                                <td className="p-2 align-top">
                                    <Input
                                        aria-label={`SKU 成本 ${idx + 1}`}
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        placeholder="可选"
                                        value={row.unitCost}
                                        onChange={(e) =>
                                            updateRow(idx, {
                                                unitCost: e.target.value,
                                            })
                                        }
                                        onBlur={() => persistRow(idx)}
                                        className={cn(
                                            errors.unitCost &&
                                                "border-destructive",
                                        )}
                                    />
                                    {errors.unitCost && (
                                        <p className="text-xs text-destructive mt-1">
                                            {errors.unitCost}
                                        </p>
                                    )}
                                </td>
                                <td className="p-2 align-top">
                                    <Input
                                        aria-label={`SKU 库存 ${idx + 1}`}
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={row.stockQuantity}
                                        onChange={(e) =>
                                            updateRow(idx, {
                                                stockQuantity: e.target.value,
                                            })
                                        }
                                        onBlur={() => persistRow(idx)}
                                        className={cn(
                                            errors.stockQuantity &&
                                                "border-destructive",
                                        )}
                                    />
                                    {errors.stockQuantity && (
                                        <p className="text-xs text-destructive mt-1">
                                            {errors.stockQuantity}
                                        </p>
                                    )}
                                </td>
                                <td className="p-2 align-top">
                                    <Input
                                        aria-label={`SKU 排序 ${idx + 1}`}
                                        type="number"
                                        step="1"
                                        value={row.sortOrder}
                                        onChange={(e) =>
                                            updateRow(idx, {
                                                sortOrder: e.target.value,
                                            })
                                        }
                                        onBlur={() => persistRow(idx)}
                                        className={cn(
                                            errors.sortOrder &&
                                                "border-destructive",
                                        )}
                                    />
                                    {errors.sortOrder && (
                                        <p className="text-xs text-destructive mt-1">
                                            {errors.sortOrder}
                                        </p>
                                    )}
                                </td>
                                <td className="p-2 text-center align-middle">
                                    <div className="flex items-center justify-center gap-2">
                                        <Switch
                                            aria-label={`启用 SKU ${idx + 1}`}
                                            checked={row.isActive}
                                            onCheckedChange={(checked) =>
                                                toggleActive(idx, checked)
                                            }
                                        />
                                        {meta.saving && (
                                            <Loader2 className="size-3 animate-spin text-muted-foreground" />
                                        )}
                                        {!meta.saving && justSaved && (
                                            <Check className="size-3 text-emerald-600" />
                                        )}
                                    </div>
                                </td>
                                <td className="p-2 text-right align-middle">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="size-8"
                                        aria-label={`删除 SKU ${idx + 1}`}
                                        onClick={() => handleRequestDelete(row)}
                                    >
                                        <Trash2 className="size-4 text-destructive" />
                                    </Button>
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )

    const addButton = (
        <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={appendRow}
            disabled={loading}
        >
            <Plus className="size-4" />
            新增 SKU
        </Button>
    )

    const body = (
        <div className="space-y-3">
            {table}
            <div>{addButton}</div>
        </div>
    )

    const wrapped = isEdit ? (
        <Card>
            <CardHeader>
                <CardTitle>SKU 管理</CardTitle>
                <p className="text-sm text-muted-foreground">
                    手动发货商品的可售规格；每个 SKU 独立计价与库存。修改后自动保存。
                </p>
            </CardHeader>
            <CardContent>{body}</CardContent>
        </Card>
    ) : (
        body
    )

    return (
        <>
            {wrapped}
            <AlertDialog
                open={confirmDelete != null}
                onOpenChange={(open) => {
                    if (!open) setConfirmDelete(null)
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>删除 SKU</AlertDialogTitle>
                        <AlertDialogDescription>
                            确定要删除「{confirmDelete?.name}」吗？此操作不可恢复。
                            如果该 SKU 已有关联订单，将无法删除——可改为停用。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>
                            取消
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault()
                                handleConfirmDelete()
                            }}
                            disabled={deleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleting && (
                                <Loader2 className="size-4 animate-spin" />
                            )}
                            删除
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}

function extractFieldErrors(data: {
    code?: string
    details?: { fieldErrors?: Record<string, string[]> }
}): RowErrors | undefined {
    if (data?.code !== "VALIDATION_FAILED" || !data?.details?.fieldErrors) {
        return undefined
    }
    const errors: RowErrors = {}
    for (const [field, messages] of Object.entries(data.details.fieldErrors)) {
        const msg = Array.isArray(messages) ? messages[0] : String(messages)
        if (msg && field in ({ name: 1, price: 1, unitCost: 1, stockQuantity: 1, sortOrder: 1, isActive: 1 })) {
            errors[field as keyof VariantDraft] = msg
        }
    }
    return Object.keys(errors).length ? errors : undefined
}
