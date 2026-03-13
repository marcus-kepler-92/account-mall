"use client"

import { useFormContext } from "react-hook-form"
import { Input } from "@/components/ui/input"
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { configClient } from "@/lib/config-client"
import type { OrderFormSchema } from "@/lib/validations/order"

type PromoValidation = {
    valid: boolean
    discountPercent: number | null
} | null

type Props = {
    isFreeShared: boolean
    maxQuantity: number
    inStock: boolean
    discountCode: string
    onDiscountCodeChange: (v: string) => void
    promoValidating: boolean
    promoValidation: PromoValidation
}

function isValidDiscountCodeFormat(code: string): boolean {
    const t = code.trim()
    return t.length >= 1 && t.length <= configClient.promoCodeMaxLength
}

export function ProductOrderQuantityPicker({
    isFreeShared,
    maxQuantity,
    inStock,
    discountCode,
    onDiscountCodeChange,
    promoValidating,
    promoValidation,
}: Props) {
    const { control } = useFormContext<OrderFormSchema>()

    if (isFreeShared) return null

    return (
        <>
            <FormField
                control={control}
                name="quantity"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>购买数量</FormLabel>
                        <FormControl>
                            <Input
                                type="number"
                                min={1}
                                max={maxQuantity}
                                disabled={!inStock}
                                {...field}
                                onChange={(e) => {
                                    const v = parseInt(e.target.value, 10)
                                    if (Number.isNaN(v) || v < 1) field.onChange(1)
                                    else if (v > maxQuantity) field.onChange(maxQuantity)
                                    else field.onChange(v)
                                }}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <div className="space-y-2">
                <label className="text-sm font-medium leading-none">优惠码</label>
                <Input
                    type="text"
                    placeholder={`选填，1–${configClient.promoCodeMaxLength} 字符`}
                    disabled={!inStock}
                    maxLength={configClient.promoCodeMaxLength}
                    value={discountCode}
                    onChange={(e) => onDiscountCodeChange(e.target.value)}
                    className="font-mono"
                />
                {discountCode.trim() !== "" && !isValidDiscountCodeFormat(discountCode) && (
                    <p className="text-xs text-destructive">
                        优惠码格式：1–{configClient.promoCodeMaxLength} 个字符
                    </p>
                )}
                {isValidDiscountCodeFormat(discountCode) && discountCode.trim() !== "" && (
                    <p className="text-xs text-muted-foreground">
                        {promoValidating
                            ? "校验中…"
                            : promoValidation?.valid && promoValidation.discountPercent != null
                              ? `已享 ${promoValidation.discountPercent}% 优惠`
                              : promoValidation?.valid
                                ? "推荐码有效，但未开通折扣"
                                : promoValidation && !promoValidation.valid
                                  ? "推荐码无效"
                                  : "校验中…"}
                    </p>
                )}
            </div>
        </>
    )
}
