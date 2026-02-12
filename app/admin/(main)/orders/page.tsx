import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { ShoppingCart, Search } from "lucide-react"
import { Input } from "@/components/ui/input"

export default function AdminOrdersPage() {
    return (
        <div className="space-y-6">
            {/* Page header */}
            <div>
                <h2 className="text-2xl font-bold tracking-tight">订单管理</h2>
                <p className="text-muted-foreground">
                    查看和管理客户订单
                </p>
            </div>

            {/* Search & Filter bar */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                        placeholder="按邮箱或订单号搜索..."
                        className="pl-9"
                        disabled
                    />
                </div>
            </div>

            {/* Empty state */}
            <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                    <div className="rounded-full bg-muted p-4 mb-4">
                        <ShoppingCart className="size-8 text-muted-foreground" />
                    </div>
                    <CardTitle className="mb-2">暂无订单</CardTitle>
                    <CardDescription className="text-center max-w-sm">
                        客户购买后订单将显示在这里
                    </CardDescription>
                </CardContent>
            </Card>
        </div>
    )
}
