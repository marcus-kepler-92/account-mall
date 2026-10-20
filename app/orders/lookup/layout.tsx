import type { Metadata } from "next"
import { config } from "@/lib/config"

// page.tsx is a client component and cannot export metadata, so the lookup
// page's title, description and self-canonical live here.
const title = "订单查询"
const description = "输入订单号或下单邮箱，查询空域账号商城的订单状态，查看已购买的账号与卡密信息。"
const url = `${config.siteUrl}/orders/lookup`

// openGraph / twitter replace the root layout's objects wholesale (Next.js
// merges metadata shallowly), so the shared fields are restated here.
export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: url },
  openGraph: {
    title: `${title} | ${config.siteName}`,
    description,
    url,
    siteName: config.siteName,
    locale: "zh_CN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${title} | ${config.siteName}`,
    description,
  },
}

export default function OrderLookupLayout({ children }: { children: React.ReactNode }) {
  return children
}
