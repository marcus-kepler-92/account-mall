import { create } from "zustand"

type Display = {
    totalPrice: string
    isFreeShared: boolean
    discountPercent: number | null
}

export const useProductPriceSyncStore = create<{
    display: Display | null
    setDisplay: (totalPrice: string, isFree: boolean, discountPercent: number | null) => void
}>((set) => ({
    display: null,
    setDisplay: (totalPrice, isFree, discountPercent) =>
        set((prev) =>
            prev.display &&
            prev.display.totalPrice === totalPrice &&
            prev.display.isFreeShared === isFree &&
            prev.display.discountPercent === discountPercent
                ? prev
                : { display: { totalPrice, isFreeShared: isFree, discountPercent } }
        ),
}))
