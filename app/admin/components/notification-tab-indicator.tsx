"use client"

import { useEffect, useRef } from "react"
import { useDocumentVisibility } from "ahooks"
import { useSiteName } from "@/app/components/site-name-provider"
import { useAdminNotifications } from "@/app/admin/hooks/use-admin-notifications"

// Telegram-style unread indicator on the browser tab. Two independent signals:
//
//  • Title — always prefixed with "(N)" while there are unread items, on the
//    current page and away alike. Written imperatively (Next metadata is
//    server-only and can't read a client count) and guarded by a MutationObserver
//    on <head>, so any external write (soft navigation, router.refresh() from
//    VisibilityRefresh, etc.) that resets the title is immediately re-prefixed.
//
//  • Favicon — an "away" alert only. While the tab is hidden AND something is
//    pending, the favicon flashes a red count badge (badge ⇄ brand icon, ~1.2s).
//    On the current page it stays the plain brand icon — you're already here.
//
// The favicon links are file-convention managed by Next, which can REPLACE those
// <link> nodes on a router.refresh() (VisibilityRefresh fires one every time the
// tab regains focus). So we re-query the live icon links at the start of each
// flash session rather than caching node refs at mount — caching went stale
// after the first tab switch and the flash silently stopped. We only mutate
// href/type in place (never add/remove/move nodes), which avoids React's head
// reconciliation throwing removeChild on a detached node.

const BADGE_CAP = 99
const FAVICON_SIZE = 64
const FLASH_INTERVAL_MS = 1200

function formatBadge(count: number): string {
  return count > BADGE_CAP ? `${BADGE_CAP}+` : String(count)
}

// A solid red disc filling the favicon with the unread count in bold white —
// maximally legible at the 16px tab size.
function buildBadgeDataUrl(count: number): string | null {
  try {
    const canvas = document.createElement("canvas")
    canvas.width = FAVICON_SIZE
    canvas.height = FAVICON_SIZE
    const ctx = canvas.getContext("2d")
    if (!ctx) return null
    const center = FAVICON_SIZE / 2
    ctx.beginPath()
    ctx.arc(center, center, center, 0, Math.PI * 2)
    ctx.fillStyle = "#ef4444"
    ctx.fill()

    const text = formatBadge(count)
    ctx.fillStyle = "#ffffff"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    // Size to digit count, then shrink to fit ~80% of the disc for wide glyphs.
    let fontSize =
      FAVICON_SIZE * (text.length >= 3 ? 0.42 : text.length === 2 ? 0.56 : 0.72)
    const maxWidth = FAVICON_SIZE * 0.8
    ctx.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`
    while (ctx.measureText(text).width > maxWidth && fontSize > 8) {
      fontSize -= 2
      ctx.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`
    }
    ctx.fillText(text, center, center + fontSize * 0.06)
    return canvas.toDataURL("image/png")
  } catch {
    return null
  }
}

export function NotificationTabIndicator() {
  const { totalCount } = useAdminNotifications()
  const siteName = useSiteName()
  const visibility = useDocumentVisibility()

  const desiredTitleRef = useRef(siteName)
  const siteNameRef = useRef(siteName)

  // ── Title: imperative write + <head> observer guard ──────────────────────
  useEffect(() => {
    const prefix = totalCount > 0 ? `(${formatBadge(totalCount)}) ` : ""
    const desired = `${prefix}${siteName}`
    desiredTitleRef.current = desired
    siteNameRef.current = siteName
    document.title = desired
  }, [totalCount, siteName])

  useEffect(() => {
    const observer = new MutationObserver(() => {
      // Re-assert our title if anything (Next nav/refresh) overwrote it. The
      // equality guard makes our own write a no-op, so there is no loop.
      if (document.title !== desiredTitleRef.current) {
        document.title = desiredTitleRef.current
      }
    })
    observer.observe(document.head, {
      childList: true,
      subtree: true,
      characterData: true,
    })
    return () => {
      observer.disconnect()
      document.title = siteNameRef.current
    }
  }, [])

  // ── Favicon: red count badge flashing while hidden, brand icon otherwise ─
  useEffect(() => {
    if (visibility !== "hidden" || totalCount <= 0) return
    const badgeHref = buildBadgeDataUrl(totalCount)
    if (!badgeHref) return

    // Snapshot the CURRENT live icon links for this session — re-queried here,
    // not cached at mount, because router.refresh() can swap these nodes.
    const links = Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'),
    )
    if (links.length === 0) return
    const originals = links.map((el) => ({
      el,
      href: el.getAttribute("href"),
      type: el.getAttribute("type"),
    }))

    const restore = () => {
      for (const { el, href, type } of originals) {
        if (href === null) el.removeAttribute("href")
        else el.setAttribute("href", href)
        if (type === null) el.removeAttribute("type")
        else el.setAttribute("type", type)
      }
    }
    const show = () => {
      for (const { el } of originals) {
        el.setAttribute("href", badgeHref)
        el.setAttribute("type", "image/png")
      }
    }

    let on = false
    const tick = () => {
      on = !on
      if (on) show()
      else restore()
    }
    tick() // start on the red badge immediately
    const id = window.setInterval(tick, FLASH_INTERVAL_MS)
    return () => {
      window.clearInterval(id)
      restore()
    }
  }, [visibility, totalCount])

  return null
}
