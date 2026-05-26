import { OrderAutoFetchSection } from "@/app/components/order-detail/auto-fetch-section"

type Props = {
    orderNo: string
    expiresAt: string | null
    initialCards: string[]
    token: string
    remainingSwitches: number
}

/**
 * AUTO_FETCH productType card-section slot for SuccessShell. The buyer
 * paid for an auto-fetched account that can be refreshed / switched
 * during the validity window — OrderAutoFetchSection owns that UX.
 */
export function AutoFetchCardsSection(props: Props) {
    return <OrderAutoFetchSection {...props} />
}
