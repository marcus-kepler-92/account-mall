"use client"

import { useState } from "react"
import { Info } from "lucide-react"
import { ProductOrderForm } from "@/app/components/product-order-form"
import { ExitIntentDialog } from "./exit-intent-dialog"

type ProductOrderSectionProps = {
    productId: string
    productName: string
    maxQuantity: number
    price: number
    inStock: boolean
    formId?: string
    productType?: "NORMAL" | "AUTO_FETCH"
    /** AUTO_FETCH 商品的账号有效时长（小时），用于展示限领规则 */
    validityHours?: number | null
}

/**
 * 商品详情页的下单区域客户端包装：
 * 管理 exit intent 折扣 token 状态，将 ExitIntentDialog 和 ProductOrderForm 关联起来。
 */
export function ProductOrderSection({
    productId,
    productName,
    maxQuantity,
    price,
    inStock,
    formId = "product-order-form",
    productType = "NORMAL",
    validityHours,
}: ProductOrderSectionProps) {
    const [exitDiscountToken, setExitDiscountToken] = useState<string | null>(null)
    const [exitDiscountPercent, setExitDiscountPercent] = useState<number | null>(null)

    const handleDiscount = (token: string, discountPercent: number) => {
        setExitDiscountToken(token)
        setExitDiscountPercent(discountPercent)
    }

    const handleConsumed = () => {
        setExitDiscountToken(null)
        setExitDiscountPercent(null)
    }

    const isFreeAutoFetch = productType === "AUTO_FETCH" && price === 0
    const displayValidityHours = validityHours ?? 24

    return (
        <>
            {/* 免费 AUTO_FETCH 限领规则提示 */}
            {isFreeAutoFetch && (
                <div className="mb-3 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
                    <Info className="size-3.5 mt-0.5 shrink-0" aria-hidden />
                    <p className="leading-relaxed">
                        每人每天限领 1 次 · 同一邮箱、设备或网络每 {displayValidityHours} 小时仅可领取一次，领取后账号在此期间内持续有效
                    </p>
                </div>
            )}
            <ProductOrderForm
                productId={productId}
                productName={productName}
                maxQuantity={maxQuantity}
                price={price}
                inStock={inStock}
                formId={formId}
                productType={productType}
                exitDiscountToken={exitDiscountToken}
                exitDiscountPercent={exitDiscountPercent}
                onExitDiscountConsumed={handleConsumed}
            />
            {productType !== "AUTO_FETCH" && (
                <ExitIntentDialog
                    productId={productId}
                    productName={productName}
                    price={price}
                    inStock={inStock}
                    onDiscount={handleDiscount}
                />
            )}
        </>
    )
}
