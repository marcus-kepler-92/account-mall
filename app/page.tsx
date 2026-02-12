import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Zap, Search } from "lucide-react"
import { ProductCatalog } from "@/app/components/product-catalog"
import { ThemeToggle } from "@/app/components/theme-toggle"

export default function HomePage() {
    return (
        <div className="flex min-h-screen flex-col">
            {/* Header */}
            <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
                <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
                    <Link href="/" className="flex items-center gap-2">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
                            <Zap className="size-4 text-primary-foreground" />
                        </div>
                        <span className="text-lg font-bold tracking-tight">Account Mall</span>
                    </Link>
                    <nav className="flex items-center gap-2">
                        <ThemeToggle />
                        <Button variant="ghost" size="sm" asChild>
                            <Link href="/orders/lookup">
                                <Search className="size-4" />
                                订单查询
                            </Link>
                        </Button>
                    </nav>
                </div>
            </header>

            {/* Main content */}
            <main className="flex-1">
                <div className="mx-auto max-w-6xl px-4 py-8 xl:max-w-7xl 2xl:max-w-[90rem]">
                    {/* Hero */}
                    <section className="mb-12 text-center">
                        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                            数字商品，即买即发
                        </h1>
                        <p className="mx-auto mt-3 max-w-2xl text-lg text-muted-foreground">
                            安全可靠的卡密自动发卡平台，支持多种数字商品类型
                        </p>
                    </section>
                    <ProductCatalog />
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
                                <span className="text-sm font-medium">Account Mall</span>
                            </div>
                            <nav className="flex gap-4 text-sm text-muted-foreground">
                                <Link href="/orders/lookup" className="hover:text-foreground transition-colors">
                                    订单查询
                                </Link>
                            </nav>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            &copy; {new Date().getFullYear()} Account Mall 版权所有
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    )
}
