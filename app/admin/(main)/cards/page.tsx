import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { CreditCard, Plus, Search, Upload } from "lucide-react"
import { Input } from "@/components/ui/input"

export default function AdminCardsPage() {
    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Cards</h2>
                    <p className="text-muted-foreground">
                        Manage card inventory for your products.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline">
                        <Upload className="size-4" />
                        Import
                    </Button>
                    <Button>
                        <Plus className="size-4" />
                        Add Card
                    </Button>
                </div>
            </div>

            {/* Search & Filter bar */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                        placeholder="Search cards..."
                        className="pl-9"
                        disabled
                    />
                </div>
            </div>

            {/* Empty state */}
            <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                    <div className="rounded-full bg-muted p-4 mb-4">
                        <CreditCard className="size-8 text-muted-foreground" />
                    </div>
                    <CardTitle className="mb-2">No cards in stock</CardTitle>
                    <CardDescription className="mb-6 text-center max-w-sm">
                        Add cards to your inventory. You can add them one by one or import in bulk.
                    </CardDescription>
                    <div className="flex items-center gap-2">
                        <Button variant="outline">
                            <Upload className="size-4" />
                            Bulk Import
                        </Button>
                        <Button>
                            <Plus className="size-4" />
                            Add First Card
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
