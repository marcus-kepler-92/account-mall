# Commission Tier Edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an edit dialog to the commission tiers admin page so admins can modify existing tier values (minAmount, maxAmount, ratePercent).

**Architecture:** New `EditTierDialog` component (mirrors `AddTierDialog` pattern) renders inline in `CommissionTierRowActions`. Props on `CommissionTierRowActions` are extended to carry tier data; `commission-tiers-columns.tsx` passes full row data. The PATCH API already exists.

**Tech Stack:** React 19, Next.js App Router, react-hook-form + zod, shadcn/ui (ModalForm, Form, Input), TanStack Table, Jest + Testing Library

---

## File Map

| File | Action |
|------|--------|
| `app/admin/(main)/commission-tiers/edit-tier-dialog.tsx` | Create |
| `app/admin/(main)/commission-tiers/commission-tier-row-actions.tsx` | Modify (extend props + add edit button) |
| `app/admin/(main)/commission-tiers/commission-tiers-columns.tsx` | Modify (pass full row to row-actions) |
| `__tests__/components/edit-tier-dialog.test.tsx` | Create |

---

## Task 1: Create `EditTierDialog` component

**Files:**
- Create: `app/admin/(main)/commission-tiers/edit-tier-dialog.tsx`

- [ ] **Step 1: Create the file**

```tsx
// app/admin/(main)/commission-tiers/edit-tier-dialog.tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { DialogFooter } from "@/components/ui/dialog"
import { ModalForm } from "@/app/admin/components"

const schema = z
    .object({
        minAmount: z
            .string()
            .refine((v) => !Number.isNaN(parseFloat(v)), "请输入有效数字")
            .refine((v) => parseFloat(v) >= 0, "不能为负数"),
        maxAmount: z
            .string()
            .refine((v) => !Number.isNaN(parseFloat(v)), "请输入有效数字")
            .refine((v) => parseFloat(v) >= 0, "不能为负数"),
        ratePercent: z
            .string()
            .refine((v) => !Number.isNaN(parseFloat(v)), "请输入有效数字")
            .refine((v) => parseFloat(v) >= 0, "不能为负数")
            .refine((v) => parseFloat(v) <= 100, "最大 100"),
    })
    .refine((d) => parseFloat(d.minAmount) < parseFloat(d.maxAmount), {
        message: "销售额下限必须小于上限",
        path: ["minAmount"],
    })

type FormValues = z.infer<typeof schema>

type Tier = { id: string; minAmount: number; maxAmount: number; ratePercent: number }

export function EditTierDialog({ tier }: { tier: Tier }) {
    const router = useRouter()
    const [open, setOpen] = useState(false)

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            minAmount: String(tier.minAmount),
            maxAmount: String(tier.maxAmount),
            ratePercent: String(tier.ratePercent),
        },
    })

    const onSubmit = async (values: FormValues) => {
        try {
            const res = await fetch(`/api/admin/commission-tiers/${tier.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    minAmount: parseFloat(values.minAmount),
                    maxAmount: parseFloat(values.maxAmount),
                    ratePercent: parseFloat(values.ratePercent),
                }),
            })
            if (!res.ok) {
                const err = await res.json()
                toast.error(err.error || "修改失败")
                return
            }
            toast.success("已修改")
            setOpen(false)
            router.refresh()
        } catch {
            toast.error("修改失败")
        }
    }

    const resetToTierValues = () =>
        form.reset({
            minAmount: String(tier.minAmount),
            maxAmount: String(tier.maxAmount),
            ratePercent: String(tier.ratePercent),
        })

    return (
        <ModalForm
            trigger={
                <Button variant="ghost" size="sm">
                    <Pencil className="size-4" />
                    编辑
                </Button>
            }
            title="编辑阶梯档位"
            description="当周该分销员已完成订单金额落入 [下限, 上限) 时，阶梯佣金 = 订单金额 × 佣金比例%。"
            open={open}
            onOpenChange={(v) => {
                setOpen(v)
                if (!v) resetToTierValues()
            }}
        >
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <FormField
                            control={form.control}
                            name="minAmount"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>当周销售额下限（元）</FormLabel>
                                    <FormControl>
                                        <Input type="number" min={0} step="0.01" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="maxAmount"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>当周销售额上限（元）</FormLabel>
                                    <FormControl>
                                        <Input type="number" min={0} step="0.01" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    <FormField
                        control={form.control}
                        name="ratePercent"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>佣金比例（%）</FormLabel>
                                <FormControl>
                                    <Input type="number" min={0} max={100} step="0.01" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setOpen(false)
                                resetToTierValues()
                            }}
                        >
                            取消
                        </Button>
                        <Button type="submit" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting ? "保存中…" : "保存"}
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </ModalForm>
    )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors in the new file

---

## Task 2: Write and run tests for `EditTierDialog`

**Files:**
- Create: `__tests__/components/edit-tier-dialog.test.tsx`

- [ ] **Step 1: Write the test file**

```tsx
/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { EditTierDialog } from "@/app/admin/(main)/commission-tiers/edit-tier-dialog"

const mockRefresh = jest.fn()

jest.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: mockRefresh }),
}))

jest.mock("sonner", () => ({
    toast: { error: jest.fn(), success: jest.fn() },
}))

const defaultTier = { id: "tier-1", minAmount: 0, maxAmount: 1000, ratePercent: 5 }

function openDialog() {
    fireEvent.click(screen.getByRole("button", { name: /编辑/ }))
}

describe("EditTierDialog", () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it("renders the edit trigger button", () => {
        render(<EditTierDialog tier={defaultTier} />)
        expect(screen.getByRole("button", { name: /编辑/ })).toBeInTheDocument()
    })

    it("pre-fills form fields with current tier values", async () => {
        render(<EditTierDialog tier={defaultTier} />)
        openDialog()
        await waitFor(() => {
            expect(screen.getByLabelText(/当周销售额下限/)).toHaveValue(0)
            expect(screen.getByLabelText(/当周销售额上限/)).toHaveValue(1000)
            expect(screen.getByLabelText(/佣金比例/)).toHaveValue(5)
        })
    })

    it("shows validation error when minAmount >= maxAmount", async () => {
        render(<EditTierDialog tier={defaultTier} />)
        openDialog()
        await waitFor(() => screen.getByLabelText(/当周销售额下限/))

        fireEvent.change(screen.getByLabelText(/当周销售额下限/), { target: { value: "2000" } })
        fireEvent.click(screen.getByRole("button", { name: /^保存$/ }))

        await waitFor(() => {
            expect(screen.getByText("销售额下限必须小于上限")).toBeInTheDocument()
        })
    })

    it("shows validation error when ratePercent > 100", async () => {
        render(<EditTierDialog tier={defaultTier} />)
        openDialog()
        await waitFor(() => screen.getByLabelText(/佣金比例/))

        fireEvent.change(screen.getByLabelText(/佣金比例/), { target: { value: "101" } })
        fireEvent.click(screen.getByRole("button", { name: /^保存$/ }))

        await waitFor(() => {
            expect(screen.getByText("最大 100")).toBeInTheDocument()
        })
    })

    it("calls PATCH and shows success toast on valid submit", async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
            ok: true,
            json: async () => ({}),
        } as Response)

        render(<EditTierDialog tier={defaultTier} />)
        openDialog()
        await waitFor(() => screen.getByLabelText(/当周销售额上限/))

        fireEvent.change(screen.getByLabelText(/当周销售额上限/), { target: { value: "2000" } })
        fireEvent.click(screen.getByRole("button", { name: /^保存$/ }))

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                "/api/admin/commission-tiers/tier-1",
                expect.objectContaining({ method: "PATCH" })
            )
            expect(require("sonner").toast.success).toHaveBeenCalledWith("已修改")
            expect(mockRefresh).toHaveBeenCalled()
        })
    })

    it("shows error toast when PATCH fails", async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
            ok: false,
            json: async () => ({ error: "服务器错误" }),
        } as Response)

        render(<EditTierDialog tier={defaultTier} />)
        openDialog()
        await waitFor(() => screen.getByLabelText(/当周销售额上限/))

        fireEvent.click(screen.getByRole("button", { name: /^保存$/ }))

        await waitFor(() => {
            expect(require("sonner").toast.error).toHaveBeenCalledWith("服务器错误")
        })
    })
})
```

- [ ] **Step 2: Run tests — expect them to pass**

Run: `npx jest __tests__/components/edit-tier-dialog.test.tsx --no-coverage`
Expected: all 6 tests PASS

- [ ] **Step 3: Commit**

```bash
git add app/admin/\(main\)/commission-tiers/edit-tier-dialog.tsx __tests__/components/edit-tier-dialog.test.tsx
git commit -m "feat(commission-tiers): add EditTierDialog component with tests"
```

---

## Task 3: Update `CommissionTierRowActions` to include edit button

**Files:**
- Modify: `app/admin/(main)/commission-tiers/commission-tier-row-actions.tsx`

- [ ] **Step 1: Replace file contents**

Replace `commission-tier-row-actions.tsx` with:

```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
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
import { Loader2, Trash2 } from "lucide-react"
import { EditTierDialog } from "./edit-tier-dialog"

type Props = {
    id: string
    minAmount: number
    maxAmount: number
    ratePercent: number
}

export function CommissionTierRowActions({ id, minAmount, maxAmount, ratePercent }: Props) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [deleting, setDeleting] = useState(false)

    const handleDelete = async () => {
        setDeleting(true)
        try {
            const res = await fetch(`/api/admin/commission-tiers/${id}`, { method: "DELETE" })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                toast.error(err?.error ?? "删除失败")
                return
            }
            setOpen(false)
            toast.success("已删除")
            router.refresh()
        } catch {
            toast.error("删除失败")
        } finally {
            setDeleting(false)
        }
    }

    return (
        <>
            <div className="flex items-center gap-1">
                <EditTierDialog tier={{ id, minAmount, maxAmount, ratePercent }} />
                <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setOpen(true)}
                >
                    <Trash2 className="size-4" />
                    删除
                </Button>
            </div>
            <AlertDialog open={open} onOpenChange={setOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>确认删除</AlertDialogTitle>
                        <AlertDialogDescription>
                            确定要删除该阶梯档位吗？删除后不可恢复。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={deleting}
                            onClick={(e) => {
                                e.preventDefault()
                                handleDelete()
                            }}
                        >
                            {deleting && <Loader2 className="size-4 animate-spin" />}
                            删除
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

---

## Task 4: Update `commission-tiers-columns.tsx` to pass full row data

**Files:**
- Modify: `app/admin/(main)/commission-tiers/commission-tiers-columns.tsx`

- [ ] **Step 1: Update the `actions` cell**

Find the `actions` column definition (line 48-51):

```tsx
    {
        id: "actions",
        header: () => <div className="w-[80px]">操作</div>,
        cell: ({ row }) => <CommissionTierRowActions id={row.original.id} />,
    },
```

Replace with:

```tsx
    {
        id: "actions",
        header: () => <div className="w-[80px]">操作</div>,
        cell: ({ row }) => (
            <CommissionTierRowActions
                id={row.original.id}
                minAmount={row.original.minAmount}
                maxAmount={row.original.maxAmount}
                ratePercent={row.original.ratePercent}
            />
        ),
    },
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Run all tests**

Run: `npm test -- --no-coverage`
Expected: all tests PASS

- [ ] **Step 4: Commit**

```bash
git add app/admin/\(main\)/commission-tiers/commission-tier-row-actions.tsx app/admin/\(main\)/commission-tiers/commission-tiers-columns.tsx
git commit -m "feat(commission-tiers): wire edit button into row actions and columns"
```
