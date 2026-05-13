"use client"

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next"

export function AnalyticsClient() {
  return (
    <Analytics
      beforeSend={(event: BeforeSendEvent) => {
        if (event.url.includes("/admin") || event.url.includes("/distributor")) {
          return null
        }
        return event
      }}
    />
  )
}
