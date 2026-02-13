"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ProductBottomBarProps = {
    price: number
    inStock: boolean
    orderSectionId: string
    restockSectionId?: string
}

export function ProductBottomBar({
    price,
    inStock,
    orderSectionId,
    restockSectionId,
}: ProductBottomBarProps) {
    const handleClick = () => {
        const targetId = inStock ? orderSectionId : restockSectionId ?? orderSectionId
        if (!targetId) return

        const el = document.getElementById(targetId)
        if (!el) return

        el.scrollIntoView({ behavior: "smooth", block: "start" })
    }

    return (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur lg:hidden">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 2xl:max-w-7xl">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-col">
                        <span className="text-[11px] text-muted-foreground">
                            {inStock ? "到手价" : "当前状态"}
                        </span>
                        <span
                            className={cn(
                                "text-lg font-bold tabular-nums",
                                !inStock && "text-muted-foreground line-through"
                            )}
                        >
                            ¥{price.toFixed(2)}
                        </span>
                        {!inStock && (
                            <span className="mt-0.5 text-[11px] text-muted-foreground">
                                已售罄，可订阅到货提醒
                            </span>
                        )}
                    </div>
                </div>
                <Button
                    type="button"
                    size="lg"
                    className="min-w-[112px]"
                    onClick={handleClick}
                    disabled={!inStock && !restockSectionId}
                >
                    {inStock ? "立即购买" : "到货提醒"}
                </Button>
            </div>
        </div>
    )
}

