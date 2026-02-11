import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Zap, Search } from "lucide-react"
import { ProductCatalog } from "@/app/components/product-catalog"

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
                        <Button variant="ghost" size="sm" asChild>
                            <Link href="/orders/lookup">
                                <Search className="size-4" />
                                Order Lookup
                            </Link>
                        </Button>
                    </nav>
                </div>
            </header>

            {/* Main content */}
            <main className="flex-1">
                <div className="mx-auto max-w-6xl px-4 py-8">
                    <ProductCatalog />
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t">
                <div className="mx-auto max-w-6xl px-4 py-8">
                    <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                        <div className="flex items-center gap-2">
                            <div className="flex size-6 items-center justify-center rounded-md bg-primary">
                                <Zap className="size-3 text-primary-foreground" />
                            </div>
                            <span className="text-sm font-medium">Account Mall</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            &copy; {new Date().getFullYear()} Account Mall. All rights reserved.
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    )
}
