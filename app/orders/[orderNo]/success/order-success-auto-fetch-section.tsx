"use client"

import { useState } from "react"
import { OrderRefreshSection } from "./order-refresh-section"
import { OrderSuccessCopySection } from "./order-success-copy-section"
import type { AutoFetchCardPayload } from "@/lib/auto-fetch-card"
import { toCardContentJson } from "@/lib/auto-fetch-card"

type Props = {
    orderNo: string
    expiresAt: string | null
    initialCards: string[]
}

export function OrderSuccessAutoFetchSection({ orderNo, expiresAt, initialCards }: Props) {
    const [cards, setCards] = useState<string[]>(initialCards)

    function handleRefreshed(payload: AutoFetchCardPayload) {
        setCards([toCardContentJson(payload)])
    }

    return (
        <>
            <OrderSuccessCopySection cards={cards} isAutoFetch />
            <OrderRefreshSection
                orderNo={orderNo}
                expiresAt={expiresAt}
                onRefreshed={handleRefreshed}
            />
        </>
    )
}
