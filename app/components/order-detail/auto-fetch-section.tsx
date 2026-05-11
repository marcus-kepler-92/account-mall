"use client"

import { useState } from "react"
import { OrderCardDisplay, type CardDisplayItem } from "./card-display"
import { OrderAutoFetchTroubleshoot } from "./auto-fetch-troubleshoot"
import type { AutoFetchCardPayload } from "@/lib/auto-fetch-card"
import { parseAutoFetchCardContent, toCardContentJson } from "@/lib/auto-fetch-card"

type Props = {
    orderNo: string
    expiresAt: string | null
    initialCards: string[]
    token: string
    remainingSwitches: number
}

function toDisplayItem(content: string): CardDisplayItem {
    const payload = parseAutoFetchCardContent(content)
    if (payload) return { type: "autoFetch", payload }
    return { type: "plain", content }
}

export function OrderAutoFetchSection({ orderNo, expiresAt, initialCards, token, remainingSwitches }: Props) {
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
            <OrderCardDisplay cards={cards.map(toDisplayItem)} />
            <OrderAutoFetchTroubleshoot
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
