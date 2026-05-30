"use client"

import { useFormContext } from "react-hook-form"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ProductFormSchema } from "@/lib/validations/product"

export function ProductFormSettings() {
    const { watch, setValue } = useFormContext<ProductFormSchema>()
    const isActive = watch("isActive") ?? false
    const couponEnabled = watch("couponEnabled") ?? false
    const commissionMode = watch("commissionMode") ?? "GLOBAL"
    const commissionValue = watch("commissionValue") ?? ""
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
                <div className="space-y-2">
                    <div>
                        <Label htmlFor="commission-mode">分销结算方式</Label>
                        <p className="text-xs text-muted-foreground">
                            决定该商品如何给分销员算佣金
                        </p>
                    </div>
                    <Select
                        value={commissionMode}
                        onValueChange={(v) => {
                            setValue("commissionMode", v as "NONE" | "GLOBAL" | "FIXED_AMOUNT" | "FIXED_PERCENT")
                            // Clear value on any mode switch to avoid a stale number
                            // carrying the wrong unit (e.g. 80% becoming ¥80/unit).
                            setValue("commissionValue", "")
                        }}
                    >
                        <SelectTrigger id="commission-mode">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="GLOBAL">全局阶梯佣金（默认）</SelectItem>
                            <SelectItem value="FIXED_PERCENT">固定百分比</SelectItem>
                            <SelectItem value="FIXED_AMOUNT">固定金额（每件）</SelectItem>
                            <SelectItem value="NONE">不参与分销</SelectItem>
                        </SelectContent>
                    </Select>
                    {(commissionMode === "FIXED_PERCENT" || commissionMode === "FIXED_AMOUNT") && (
                        <div>
                            <Input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder={commissionMode === "FIXED_PERCENT" ? "佣金百分比，如 20" : "每件固定佣金（元），如 5"}
                                value={commissionValue}
                                onChange={(e) => setValue("commissionValue", e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                {commissionMode === "FIXED_PERCENT"
                                    ? "按订单实付金额的百分比给佣金"
                                    : "每件固定佣金；注意单件佣金超过售价会亏本"}
                            </p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
