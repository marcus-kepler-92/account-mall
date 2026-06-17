import type { Metadata } from "next"

// Order pages are per-buyer and transactional — they must never enter the
// search index. follow stays on so Google can still traverse any site links.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
}

export default function OrderDetailLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
