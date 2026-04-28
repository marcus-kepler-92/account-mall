import { prisma } from "@/lib/prisma"
import { config } from "@/lib/config"
import { scrapeMultipleUrls } from "@/lib/scrape-shared-accounts"
import { MANUAL_BLACKLIST_REASON } from "@/lib/auto-fetch-card"

export interface RestoreAvailableAccountsResult {
    restored: number
    productsProcessed: number
}

/**
 * For each AUTO_FETCH product, scrape current available accounts from source.
 * Removes any non-manual blacklist entry whose account reappears in the source —
 * the account has been refreshed upstream and is safe to serve again.
 * Order serving already ignores auto-blacklist entries past blacklistExpiryHours at query
 * time, so time-based cleanup is not needed here.
 */
export async function restoreAvailableAccounts(): Promise<RestoreAvailableAccountsResult> {
    const globalFallback = config.autoFetchSourceUrls[0]?.trim() ?? ""

    const products = await prisma.product.findMany({
        where: { productType: "AUTO_FETCH" },
        select: { id: true, sourceUrl: true },
    })

    let restored = 0
    let productsProcessed = 0

    for (const product of products) {
        const sourceUrl = product.sourceUrl?.trim() || globalFallback
        if (!sourceUrl) continue
        try {
            const scraped = await scrapeMultipleUrls(sourceUrl)
            const available = scraped.map((a) => a.account)
            if (available.length === 0) continue

            const { count } = await prisma.accountBlacklist.deleteMany({
                where: {
                    productId: product.id,
                    account: { in: available },
                    OR: [{ reason: null }, { reason: { not: MANUAL_BLACKLIST_REASON } }],
                },
            })
            restored += count
            productsProcessed++
        } catch (err) {
            console.warn("[restore-available-accounts] scrape failed for product", product.id, err)
        }
    }

    return { restored, productsProcessed }
}
