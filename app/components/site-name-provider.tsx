"use client"

import { createContext, useContext } from "react"

const defaults = {
    siteName: "Account Mall",
    siteDescription: "卡密自动发卡平台 - 即买即发，安全可靠",
    siteTagline: "数字商品，即买即发",
    siteSubtitle: "安全可靠的卡密自动发卡平台，支持多种数字商品类型",
    adminPanelLabel: "管理后台",
} as const

export type SiteConfigValue = typeof defaults

const SiteConfigContext = createContext<SiteConfigValue>(defaults)

export function SiteNameProvider({
    siteName = defaults.siteName,
    siteDescription = defaults.siteDescription,
    siteTagline = defaults.siteTagline,
    siteSubtitle = defaults.siteSubtitle,
    adminPanelLabel = defaults.adminPanelLabel,
    children,
}: {
    siteName?: string
    siteDescription?: string
    siteTagline?: string
    siteSubtitle?: string
    adminPanelLabel?: string
    children: React.ReactNode
}) {
    const value: SiteConfigValue = {
        siteName,
        siteDescription,
        siteTagline,
        siteSubtitle,
        adminPanelLabel,
    }
    return (
        <SiteConfigContext.Provider value={value}>
            {children}
        </SiteConfigContext.Provider>
    )
}

export function useSiteName(): string {
    return useContext(SiteConfigContext).siteName
}

export function useAdminPanelLabel(): string {
    return useContext(SiteConfigContext).adminPanelLabel
}

export function useSiteTagline(): string {
    return useContext(SiteConfigContext).siteTagline
}

export function useSiteSubtitle(): string {
    return useContext(SiteConfigContext).siteSubtitle
}
