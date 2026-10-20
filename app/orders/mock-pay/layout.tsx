import type { Metadata } from "next"

// Test-payment page: reachable in production but must never be indexed.
export const metadata: Metadata = {
  title: "模拟支付",
  robots: { index: false, follow: false },
}

export default function MockPayLayout({ children }: { children: React.ReactNode }) {
  return children
}
