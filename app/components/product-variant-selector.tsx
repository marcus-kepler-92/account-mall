"use client"

import { cn } from "@/lib/utils"

// MANUAL-product variant selector (rendered above the order form).
// Variants are sorted server-side; inactive ones are filtered out here so
// admins can soft-hide a SKU without disturbing existing orders. Out-of-stock
// variants stay visible (disabled + dimmed) to retain price signaling.
export type ProductVariantOption = {
    id: string
    name: string
    price: string          // decimal as string, formatted upstream
    stockQuantity: number
    isActive: boolean
}

type Props = {
    variants: ProductVariantOption[]
    value: string | null
    onChange: (id: string) => void
    disabled?: boolean
}

export function ProductVariantSelector({ variants, value, onChange, disabled }: Props) {
    const visible = variants.filter((v) => v.isActive)
    if (visible.length === 0) return null
    return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {visible.map((v) => {
                const soldOut = v.stockQuantity < 1
                const active = value === v.id
                return (
                    <button
                        key={v.id}
                        type="button"
                        disabled={soldOut || disabled}
                        onClick={() => onChange(v.id)}
                        aria-pressed={active}
                        className={cn(
                            "rounded-md border p-3 text-left transition",
                            active ? "border-primary bg-primary/5" : "border-muted",
                            soldOut && "opacity-50 cursor-not-allowed",
                            !soldOut && !active && "hover:border-primary/50",
                        )}
                    >
                        <div className="font-medium leading-tight">{v.name}</div>
                        <div className="mt-1 text-sm text-muted-foreground tabular-nums">¥{v.price}</div>
                        {soldOut && <div className="mt-1 text-xs text-destructive">已售罄</div>}
                    </button>
                )
            })}
        </div>
    )
}
