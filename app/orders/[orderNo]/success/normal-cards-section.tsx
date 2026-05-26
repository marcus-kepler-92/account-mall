import { OrderCardDisplay, type CardDisplayItem } from "@/app/components/order-detail/card-display"

type Props = {
    cards: CardDisplayItem[]
}

/**
 * NORMAL productType card-section slot for SuccessShell. The buyer paid
 * for static card content; we just render the resolved cards inline.
 */
export function NormalCardsSection({ cards }: Props) {
    return <OrderCardDisplay cards={cards} />
}
