"use client"

import { useFormContext } from "react-hook-form"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ProductFormSchema } from "@/lib/validations/product"

export function ProductFormSettings() {
    const { watch, setValue } = useFormContext<ProductFormSchema>()
    const isActive = watch("isActive") ?? false
    const couponEnabled = watch("couponEnabled") ?? false
    const excludeFromAttribution = watch("excludeFromAttribution") ?? false
    const emailOnFulfill = watch("emailOnFulfill") ?? false

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
                <div className="flex items-center justify-between">
                    <div>
                        <Label htmlFor="email-on-fulfill">发货后邮件通知买家</Label>
                        <p className="text-xs text-muted-foreground">
                            {emailOnFulfill
                                ? "订单完成时向买家邮箱发送账号信息或卡密"
                                : "默认关闭：完成订单不发邮件，买家自行查订单"}
                        </p>
                    </div>
                    <Switch
                        id="email-on-fulfill"
                        checked={emailOnFulfill}
                        onCheckedChange={(v) => setValue("emailOnFulfill", v)}
                    />
                </div>
                <div className="flex items-center justify-between">
                    <div>
                        <Label htmlFor="exclude-from-attribution">不参与分销归因</Label>
                        <p className="text-xs text-muted-foreground">
                            {excludeFromAttribution
                                ? "该商品订单不归因到任何分销员，不产生佣金"
                                : "正常按推广码 / 优惠码归因到分销员"}
                        </p>
                    </div>
                    <Switch
                        id="exclude-from-attribution"
                        checked={excludeFromAttribution}
                        onCheckedChange={(v) => setValue("excludeFromAttribution", v)}
                    />
                </div>
            </CardContent>
        </Card>
    )
}
