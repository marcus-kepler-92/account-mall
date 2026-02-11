import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Package, ShoppingCart, CreditCard } from "lucide-react"

export default function AdminDashboardPage() {
    // Placeholder stats - will be replaced with real data later
    const stats = [
        {
            title: "Products",
            value: "—",
            description: "Total products",
            href: "/admin/products",
            icon: Package,
        },
        {
            title: "Orders",
            value: "—",
            description: "Total orders",
            href: "/admin/orders",
            icon: ShoppingCart,
        },
        {
            title: "Cards",
            value: "—",
            description: "Total cards in stock",
            href: "/admin/cards",
            icon: CreditCard,
        },
    ]

    return (
        <div className="space-y-8">
            {/* Page header */}
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Overview</h2>
                <p className="text-muted-foreground">
                    Welcome to the Account Mall admin panel.
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {stats.map((stat) => (
                    <Link key={stat.title} href={stat.href}>
                        <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardDescription>{stat.description}</CardDescription>
                                <stat.icon className="size-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold">{stat.value}</div>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Manage {stat.title.toLowerCase()} →
                                </p>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    )
}
