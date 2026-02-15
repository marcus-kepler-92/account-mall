import Link from "next/link"
import { Suspense } from "react"
import { Zap } from "lucide-react"
import { ProductCatalog } from "@/app/components/product-catalog"
import { SiteHeader } from "@/app/components/site-header"
import { config } from "@/lib/config"

export default function HomePage() {
    return (
        <div className="flex min-h-screen flex-col">
            <SiteHeader />

            {/* Main content */}
            <main className="flex-1">
                <div className="mx-auto max-w-6xl px-4 py-8 xl:max-w-7xl 2xl:max-w-[90rem]">
                    {/* Hero */}
                    <section className="mb-12 text-center">
                        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                            {config.siteTagline}
                        </h1>
                        <p className="mx-auto mt-3 max-w-2xl text-lg text-muted-foreground">
                            {config.siteSubtitle}
                        </p>
                    </section>
                    <Suspense fallback={<div className="min-h-[400px]" />}>
                        <ProductCatalog />
                    </Suspense>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t">
                <div className="mx-auto max-w-6xl px-4 py-8">
                    <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                        <div className="flex flex-wrap items-center justify-center gap-4 sm:justify-start">
                            <div className="flex items-center gap-2">
                                <div className="flex size-6 items-center justify-center rounded-md bg-primary">
                                    <Zap className="size-3 text-primary-foreground" />
                                </div>
                                <span className="text-sm font-medium">{config.siteName}</span>
                            </div>
                            <nav className="flex gap-4 text-sm text-muted-foreground">
                                <Link href="/orders/lookup" className="hover:text-foreground transition-colors">
                                    订单查询
                                </Link>
                            </nav>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            &copy; {new Date().getFullYear()} {config.siteName} 版权所有
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    )
}
