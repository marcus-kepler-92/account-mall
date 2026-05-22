/**
 * URL parameter helpers for the cross-sell session token (`?cs=<csToken>`).
 *
 * The cs token threads through every storefront page so a user staying within
 * their cross-sell session window continues to see the discounted price after
 * navigating around (logo, categories, other cards). Pure URL — no cookies,
 * no Redis, no server session.
 */

export const CS_PARAM = "cs"

/**
 * Append the cs token to an href if it's safe to forward.
 *
 * Returns `href` unchanged when:
 *  - `cs` is null/empty
 *  - `href` already contains a `cs=` param (don't overwrite)
 *  - `href` is an absolute external URL (different origin)
 *
 * Only intra-storefront paths get the token. Admin / distributor / order
 * detail / API paths are filtered by the calling site (we don't introspect
 * paths here — callers pass only allowlisted hrefs).
 */
export function appendCsParam(
    href: string,
    cs: string | null | undefined,
): string {
    if (!cs) return href
    if (!href) return href
    // External absolute URL → leave alone
    if (/^https?:\/\//i.test(href)) return href
    // Already has cs= → don't double-add
    if (/[?&]cs=/.test(href)) return href

    const [pathAndQuery, hash] = href.split("#", 2)
    const separator = pathAndQuery.includes("?") ? "&" : "?"
    const withCs = `${pathAndQuery}${separator}${CS_PARAM}=${encodeURIComponent(cs)}`
    return hash ? `${withCs}#${hash}` : withCs
}
