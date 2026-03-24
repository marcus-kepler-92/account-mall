"use client"

import dynamic from "next/dynamic"

const DistributorMobileNavInner = dynamic(
    () => import("./distributor-mobile-nav").then((m) => ({ default: m.DistributorMobileNav })),
    { ssr: false }
)

export function DistributorMobileNavWrapper() {
    return <DistributorMobileNavInner />
}
