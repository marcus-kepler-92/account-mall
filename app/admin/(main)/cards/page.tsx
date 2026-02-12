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
                    <h2 className="text-2xl font-bold tracking-tight">卡密管理</h2>
                    <p className="text-muted-foreground">
                        管理商品的卡密库存
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline">
                        <Upload className="size-4" />
                        批量导入
                    </Button>
                    <Button>
                        <Plus className="size-4" />
                        添加卡密
                    </Button>
                </div>
            </div>

            {/* Search & Filter bar */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                        placeholder="搜索卡密..."
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
                    <CardTitle className="mb-2">暂无卡密</CardTitle>
                    <CardDescription className="mb-6 text-center max-w-sm">
                        添加卡密到库存，可逐条添加或批量导入
                    </CardDescription>
                    <div className="flex items-center gap-2">
                        <Button variant="outline">
                            <Upload className="size-4" />
                            批量导入
                        </Button>
                        <Button>
                            <Plus className="size-4" />
                            添加第一张卡密
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
