"use client"

import { Headset } from "lucide-react"
import { Button } from "@/components/ui/button"

// Tiny client island that programmatically opens the global CustomerServiceFab
// by dispatching `open-customer-service`. Use wherever a buyer-side surface
// needs an inline "联系客服" CTA without duplicating the FAB's popover/sheet.
//
// Keep this component dependency-free (only Button + icon) so it can be
// dropped into RSC pages and rendered in the unavailable-product placeholder.
export function ContactCustomerServiceButton({
    label = "联系客服",
    variant = "default",
    size = "sm",
    className,
}: {
    label?: string
    variant?: "default" | "secondary" | "outline"
    size?: "sm" | "default" | "lg"
    className?: string
}) {
    return (
        <Button
            type="button"
            variant={variant}
            size={size}
            className={className}
            onClick={() => document.dispatchEvent(new CustomEvent("open-customer-service"))}
        >
            <Headset className="size-4" />
            {label}
        </Button>
    )
}
