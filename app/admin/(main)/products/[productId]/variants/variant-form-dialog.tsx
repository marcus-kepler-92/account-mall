"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { DialogFooter } from "@/components/ui/dialog"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { ModalForm } from "@/app/admin/components"
import { applyFieldErrors } from "@/lib/form-utils"
import type { VariantRow } from "./variants-section"

// Form-level schema: keeps numeric fields as strings for Input compatibility.
const formSchema = z.object({
    name: z.string().min(1, "名称必填").max(200, "名称过长"),
    price: z
        .string()
        .refine(
            (v) => v !== "" && !Number.isNaN(parseFloat(v)) && parseFloat(v) >= 0,
            "售价必须是非负数字"
        ),
    unitCost: z
        .string()
        .refine(
            (v) => v === "" || (!Number.isNaN(parseFloat(v)) && parseFloat(v) >= 0),
            "成本必须是非负数字"
        )
        .optional(),
    stockQuantity: z
        .string()
        .refine(
            (v) =>
                v !== "" &&
                Number.isInteger(Number(v)) &&
                Number(v) >= 0,
            "库存必须是非负整数"
        ),
    sortOrder: z
        .string()
        .refine(
            (v) => v === "" || Number.isInteger(Number(v)),
            "排序必须是整数"
        )
        .optional(),
    isActive: z.boolean(),
})

type FormValues = z.infer<typeof formSchema>

type Props = {
    productId: string
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
} & (
    | { mode: "create"; variant?: undefined }
    | { mode: "edit"; variant: VariantRow }
)

export function VariantFormDialog({
    productId,
    mode,
    variant,
    open,
    onOpenChange,
    onSuccess,
}: Props) {
    const isEditing = mode === "edit"

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: variant?.name ?? "",
            price: variant?.price ?? "",
            unitCost: variant?.unitCost ?? "",
            stockQuantity:
                variant?.stockQuantity != null
                    ? String(variant.stockQuantity)
                    : "0",
            sortOrder:
                variant?.sortOrder != null ? String(variant.sortOrder) : "0",
            isActive: variant?.isActive ?? true,
        },
    })

    // Reset values when opening with a different variant (edit mode).
    useEffect(() => {
        if (open) {
            form.reset({
                name: variant?.name ?? "",
                price: variant?.price ?? "",
                unitCost: variant?.unitCost ?? "",
                stockQuantity:
                    variant?.stockQuantity != null
                        ? String(variant.stockQuantity)
                        : "0",
                sortOrder:
                    variant?.sortOrder != null
                        ? String(variant.sortOrder)
                        : "0",
                isActive: variant?.isActive ?? true,
            })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, variant?.id])

    const onSubmit = async (values: FormValues) => {
        const body = {
            name: values.name.trim(),
            price: parseFloat(values.price),
            unitCost:
                values.unitCost && values.unitCost !== ""
                    ? parseFloat(values.unitCost)
                    : null,
            stockQuantity: parseInt(values.stockQuantity, 10),
            sortOrder:
                values.sortOrder && values.sortOrder !== ""
                    ? parseInt(values.sortOrder, 10)
                    : 0,
            isActive: values.isActive,
        }

        try {
            const url = isEditing
                ? `/api/admin/products/${productId}/variants/${variant.id}`
                : `/api/admin/products/${productId}/variants`
            const method = isEditing ? "PATCH" : "POST"
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            })

            if (!res.ok) {
                const responseData = await res.json().catch(() => ({}))
                applyFieldErrors(responseData, form.setError)
                toast.error(responseData?.error ?? "保存失败")
                return
            }

            toast.success(isEditing ? "SKU 已更新" : "SKU 已创建")
            onOpenChange(false)
            onSuccess?.()
        } catch {
            toast.error("发生未知错误")
        }
    }

    return (
        <ModalForm
            title={isEditing ? "编辑 SKU" : "新建 SKU"}
            description={
                isEditing
                    ? "更新该 SKU 的售价、成本、库存与状态"
                    : "为该手动发货商品新建一个可售规格"
            }
            open={open}
            onOpenChange={onOpenChange}
        >
            <Form {...form}>
                <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-4"
                >
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>
                                    名称{" "}
                                    <span className="text-destructive">*</span>
                                </FormLabel>
                                <FormControl>
                                    <Input
                                        placeholder="如：1 个月 / 3 个月 / 标准版"
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                            control={form.control}
                            name="price"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>
                                        售价 (¥){" "}
                                        <span className="text-destructive">
                                            *
                                        </span>
                                    </FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            placeholder="0.00"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="unitCost"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>采购成本 (¥)</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            placeholder="可选"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                            control={form.control}
                            name="stockQuantity"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>
                                        库存{" "}
                                        <span className="text-destructive">
                                            *
                                        </span>
                                    </FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            min="0"
                                            step="1"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="sortOrder"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>排序</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            step="1"
                                            placeholder="0"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <FormField
                        control={form.control}
                        name="isActive"
                        render={({ field }) => (
                            <FormItem>
                                <div className="flex items-center justify-between rounded-md border p-3">
                                    <div>
                                        <FormLabel>启用该 SKU</FormLabel>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            停用后买家将看不到该规格
                                        </p>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </div>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            取消
                        </Button>
                        <Button
                            type="submit"
                            disabled={form.formState.isSubmitting}
                        >
                            {form.formState.isSubmitting && (
                                <Loader2 className="size-4 animate-spin" />
                            )}
                            {isEditing ? "保存修改" : "创建 SKU"}
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </ModalForm>
    )
}
