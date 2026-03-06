"use client"

import dynamic from "next/dynamic"

type ProductDescriptionViewClientProps = {
    description: string
}

const ProductDescriptionView = dynamic(
    () => import("@/app/components/product-description-view").then((mod) => mod.ProductDescriptionView),
    { ssr: false }
)

export function ProductDescriptionViewClient({ description }: ProductDescriptionViewClientProps) {
    return <ProductDescriptionView description={description} />
}
