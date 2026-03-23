"use client"

import { useState } from "react"
import { OrderRefreshSection } from "./order-refresh-section"
import { OrderSuccessCopySection } from "./order-success-copy-section"
import { OrderSwitchAccountSection } from "./order-switch-account-section"
import type { AutoFetchCardPayload } from "@/lib/auto-fetch-card"
import { toCardContentJson } from "@/lib/auto-fetch-card"

type Props = {
    orderNo: string
    expiresAt: string | null
    initialCards: string[]
    canSwitch: boolean
}

export function OrderSuccessAutoFetchSection({ orderNo, expiresAt, initialCards, canSwitch }: Props) {
    const [cards, setCards] = useState<string[]>(initialCards)
    const [switchUsed, setSwitchUsed] = useState(!canSwitch)

    function handleRefreshed(payload: AutoFetchCardPayload) {
        setCards([toCardContentJson(payload)])
    }

    function handleSwitched(payload: AutoFetchCardPayload) {
        setCards([toCardContentJson(payload)])
        setSwitchUsed(true)
    }

    return (
        <>
            <OrderSuccessCopySection cards={cards} isAutoFetch />
            <OrderRefreshSection
                orderNo={orderNo}
                expiresAt={expiresAt}
                onRefreshed={handleRefreshed}
            />
            {!switchUsed && (
                <OrderSwitchAccountSection orderNo={orderNo} onSwitched={handleSwitched} />
            )}
        </>
    )
}
