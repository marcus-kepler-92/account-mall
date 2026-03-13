"use client"

import { useState } from "react"
import { ProductOrderForm } from "@/app/components/product-order-form"
import { ExitIntentDialog } from "./exit-intent-dialog"

type ProductOrderSectionProps = {
    productId: string
    productName: string
    maxQuantity: number
    price: number
    inStock: boolean
    formId?: string
    productType?: "NORMAL" | "FREE_SHARED"
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

    return (
        <>
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
            {productType !== "FREE_SHARED" && (
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
