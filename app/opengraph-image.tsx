import { ImageResponse } from "next/og"
import { config } from "@/lib/config"

// Site-wide Open Graph / Twitter card. Pages without their own OG image (home,
// legal pages, share links) fall back to this branded card. Latin-only text so
// it renders reliably without bundling a CJK font into the edge image route.
export const alt = "VoidLogins — Apple ID Store"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

function siteHost(): string {
  try {
    return new URL(config.siteUrl).host
  } catch {
    return "voidlogins.com"
  }
}

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "96px",
          background: "linear-gradient(160deg, #142339 0%, #0A1424 100%)",
          fontFamily: "sans-serif",
        }}
      >
        {/* Brand mark — the cream chevron + gold dot from icon.svg */}
        <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
          <svg width="92" height="92" viewBox="0 0 256 256">
            <rect width="256" height="256" rx="32" fill="#0E1729" />
            <path d="M56 64L96 64L128 168L160 64L200 64L128 216Z" fill="#F2EBDD" />
            <circle cx="128" cy="168" r="9" fill="#0E1729" />
            <circle cx="128" cy="168" r="5" fill="#C8A06A" />
          </svg>
          <div
            style={{
              display: "flex",
              fontSize: "76px",
              fontWeight: 700,
              color: "#F2EBDD",
              letterSpacing: "-2px",
            }}
          >
            VoidLogins
          </div>
        </div>

        <div
          style={{
            display: "flex",
            marginTop: "44px",
            fontSize: "44px",
            fontWeight: 600,
            color: "#C8A06A",
          }}
        >
          Apple ID Store
        </div>

        <div
          style={{
            display: "flex",
            marginTop: "16px",
            fontSize: "30px",
            color: "#8A97AC",
          }}
        >
          Global Apple IDs · instant delivery
        </div>

        <div
          style={{
            display: "flex",
            marginTop: "auto",
            fontSize: "28px",
            color: "#8A97AC",
          }}
        >
          {siteHost()}
        </div>
      </div>
    ),
    { ...size },
  )
}
