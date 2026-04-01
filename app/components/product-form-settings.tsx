"use client"

import { useFormContext } from "react-hook-form"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ProductFormSchema } from "@/lib/validations/product"

export function ProductFormSettings() {
    const { watch, setValue } = useFormContext<ProductFormSchema>()
    const isActive = watch("isActive")
    const couponEnabled = watch("couponEnabled") ?? false

    return (
        <Card>
            <CardHeader>
                <CardTitle>状态</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <Label htmlFor="status">已上架</Label>
                        <p className="text-xs text-muted-foreground">
                            {isActive ? "商品对买家可见" : "商品对买家隐藏"}
                        </p>
                    </div>
                    <Switch
                        id="status"
                        checked={isActive}
                        onCheckedChange={(v) => setValue("isActive", v)}
                    />
                </div>
                <div className="flex items-center justify-between">
                    <div>
                        <Label htmlFor="coupon-enabled">允许使用优惠码</Label>
                        <p className="text-xs text-muted-foreground">
                            {couponEnabled ? "买家可在结算时填写优惠码" : "结算时不接受优惠码"}
                        </p>
                    </div>
                    <Switch
                        id="coupon-enabled"
                        checked={couponEnabled}
                        onCheckedChange={(v) => setValue("couponEnabled", v)}
                    />
                </div>
            </CardContent>
        </Card>
    )
}
