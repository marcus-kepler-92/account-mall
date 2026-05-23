"use client"

import { useFormContext } from "react-hook-form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    SkuListEditor,
    type VariantDraft,
} from "@/app/admin/(main)/products/[productId]/variants/sku-list-editor"
import type { ProductFormSchema } from "@/lib/validations/product"

/**
 * Bridge between the create-product form and the reusable SkuListEditor.
 *
 * The form holds variants in its values (under "variants"); the editor is fully
 * controlled in "create" mode and round-trips via setValue. We render the
 * surrounding Card here so the editor stays mode-agnostic.
 */
export function ProductFormVariantsField() {
    const { watch, setValue, formState } = useFormContext<ProductFormSchema>()
    const variants = (watch("variants") ?? []) as VariantDraft[]
    const trackInventory = watch("inventoryTracked") ?? false
    const error = formState.errors.variants?.message as string | undefined

    return (
        <Card>
            <CardHeader>
                <CardTitle>SKU 管理</CardTitle>
                <p className="text-sm text-muted-foreground">
                    {trackInventory
                        ? "手动发货商品的可售规格；每个 SKU 独立计价与库存。商品创建时会一并保存。"
                        : "手动发货商品的可售规格；每个 SKU 独立计价。商品创建时会一并保存。"}
                </p>
            </CardHeader>
            <CardContent className="space-y-3">
                <SkuListEditor
                    mode="create"
                    value={variants}
                    onChange={(next) =>
                        setValue("variants", next, {
                            shouldValidate: true,
                            shouldDirty: true,
                        })
                    }
                    trackInventory={trackInventory}
                />
                {error && (
                    <p className="text-sm text-destructive">{error}</p>
                )}
            </CardContent>
        </Card>
    )
}
