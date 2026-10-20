import type { Metadata } from "next"
import { config } from "@/lib/config"

// page.tsx is a client component and cannot export metadata, so the lookup
// page's title, description and self-canonical live here.
export const metadata: Metadata = {
  title: "订单查询",
  description: "输入订单号或下单邮箱，查询空域账号商城的订单状态，查看已购买的账号与卡密信息。",
  alternates: { canonical: `${config.siteUrl}/orders/lookup` },
}

export default function OrderLookupLayout({ children }: { children: React.ReactNode }) {
  return children
}
