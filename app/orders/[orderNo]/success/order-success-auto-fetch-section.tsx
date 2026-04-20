"use client"

import { useState } from "react"
import { OrderSuccessCopySection } from "./order-success-copy-section"
import { OrderTroubleshootSection } from "./order-troubleshoot-section"
import type { AutoFetchCardPayload } from "@/lib/auto-fetch-card"
import { toCardContentJson } from "@/lib/auto-fetch-card"
import { resolveCardFields } from "@/lib/card-format"

type Props = {
    orderNo: string
    expiresAt: string | null
    initialCards: string[]
    token: string
    remainingSwitches: number
}

export function OrderSuccessAutoFetchSection({ orderNo, expiresAt, initialCards, token, remainingSwitches }: Props) {
    const [cards, setCards] = useState<string[]>(initialCards)
    const [remaining, setRemaining] = useState(remainingSwitches)

    function handleRefreshed(payload: AutoFetchCardPayload) {
        setCards([toCardContentJson(payload)])
    }

    function handleSwitched(payload: AutoFetchCardPayload) {
        setCards([toCardContentJson(payload)])
        setRemaining((c) => Math.max(0, c - 1))
    }

    return (
        <>
            <OrderSuccessCopySection cards={cards.map((c) => resolveCardFields(c, []))} />
            <OrderTroubleshootSection
                orderNo={orderNo}
                expiresAt={expiresAt}
                token={token}
                remainingSwitches={remaining}
                onRefreshed={handleRefreshed}
                onSwitched={handleSwitched}
            />
        </>
    )
}
