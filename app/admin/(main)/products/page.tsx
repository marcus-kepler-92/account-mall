import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Package, Plus, Search } from "lucide-react"
import { Input } from "@/components/ui/input"

export default function AdminProductsPage() {
    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Products</h2>
                    <p className="text-muted-foreground">
                        Manage your digital products and pricing.
                    </p>
                </div>
                <Button>
                    <Plus className="size-4" />
                    Add Product
                </Button>
            </div>

            {/* Search & Filter bar */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                        placeholder="Search products..."
                        className="pl-9"
                        disabled
                    />
                </div>
            </div>

            {/* Empty state */}
            <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                    <div className="rounded-full bg-muted p-4 mb-4">
                        <Package className="size-8 text-muted-foreground" />
                    </div>
                    <CardTitle className="mb-2">No products yet</CardTitle>
                    <CardDescription className="mb-6 text-center max-w-sm">
                        Get started by adding your first digital product. Products will appear here once created.
                    </CardDescription>
                    <Button>
                        <Plus className="size-4" />
                        Add Your First Product
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
