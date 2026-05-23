"use client"

import { useState } from "react"
import { useFormContext } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { MarkdownEditor } from "@/app/components/markdown-editor"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandItem, CommandList, CommandGroup } from "@/components/ui/command"
import { Button } from "@/components/ui/button"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ProductFormSchema } from "@/lib/validations/product"

export function ProductFormPricingFields({
    isAutoFetch,
    isManual = false,
    sourceUrlOptions,
}: {
    isAutoFetch: boolean
    isManual?: boolean
    sourceUrlOptions: string[]
}) {
    const { control, watch } = useFormContext<ProductFormSchema>()
    const allowAccountSwitch = watch("allowAccountSwitch") ?? true
    const autoFetchType = watch("autoFetchType") ?? "scrape"
    const isVoidlogins = isAutoFetch && autoFetchType === "voidlogins"
    const [sourceUrlOpen, setSourceUrlOpen] = useState(false)

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>价格与限制</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <FormField
                        control={control}
                        name="productType"
                        render={({ field }) => (
                            <FormItem className="space-y-2">
                                <FormLabel>商品类型</FormLabel>
                                <FormControl>
                                    <RadioGroup
                                        value={field.value}
                                        onValueChange={(value) => {
                                            field.onChange(value)
                                        }}
                                        className="flex flex-wrap gap-4"
                                    >
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <RadioGroupItem value="NORMAL" />
                                            <span className="text-sm">普通商品</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <RadioGroupItem value="AUTO_FETCH" />
                                            <span className="text-sm">自动获取</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <RadioGroupItem value="MANUAL" />
                                            <span className="text-sm">手动发货</span>
                                        </label>
                                    </RadioGroup>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {isManual && (
                        <p className="text-sm text-muted-foreground rounded-md border bg-muted/30 p-3">
                            手动发货商品的售价、成本与库存由下方
                            <span className="font-medium"> SKU 管理 </span>
                            区维护，此处无需填写。
                        </p>
                    )}

                    {!isManual && (
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField
                                control={control}
                                name="price"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            价格 (¥) {!isAutoFetch && <span className="text-destructive">*</span>}
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                min={isAutoFetch ? "0" : "0.01"}
                                                placeholder={isAutoFetch ? "0.00（可免费）" : "0.00"}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={control}
                                name="costPerUnit"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>采购成本（每张卡密，可选）</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                min={0}
                                                step="0.01"
                                                placeholder="留空表示未设置"
                                                value={field.value ?? ""}
                                                onChange={(e) => {
                                                    const v = e.target.value
                                                    field.onChange(v === "" ? null : parseFloat(v))
                                                }}
                                            />
                                        </FormControl>
                                        <FormDescription>用于利润看板计算，不影响售价和用户展示</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            {!isAutoFetch && (
                                <FormField
                                    control={control}
                                    name="maxQuantity"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>单笔最大购买数量</FormLabel>
                                            <FormControl>
                                                <Input type="number" min={1} max={1000} {...field} />
                                            </FormControl>
                                            <FormDescription>单笔订单最多可购买的数量</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}
                        </div>
                    )}

                    {isAutoFetch && (
                        <>
                            <FormField
                                control={control}
                                name="autoFetchType"
                                render={({ field }) => (
                                    <FormItem className="space-y-2">
                                        <FormLabel>获取方式</FormLabel>
                                        <FormControl>
                                            <RadioGroup
                                                value={field.value}
                                                onValueChange={field.onChange}
                                                className="flex gap-4"
                                            >
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <RadioGroupItem value="scrape" />
                                                    <span className="text-sm">爬取来源 URL</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <RadioGroupItem value="voidlogins" />
                                                    <span className="text-sm">苹果管理平台</span>
                                                </label>
                                            </RadioGroup>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {!isVoidlogins && (
                            <FormField
                                control={control}
                                name="sourceUrl"
                                render={({ field }) => {
                                    const selected = (field.value ?? "")
                                        .split(",")
                                        .map((s) => s.trim())
                                        .filter(Boolean)
                                    const toggle = (url: string) => {
                                        const next = selected.includes(url)
                                            ? selected.filter((u) => u !== url)
                                            : [...selected, url]
                                        field.onChange(next.join(","))
                                    }
                                    return (
                                        <FormItem>
                                            <FormLabel>
                                                来源 URL <span className="text-destructive">*</span>
                                            </FormLabel>
                                            <Popover open={sourceUrlOpen} onOpenChange={setSourceUrlOpen}>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        role="combobox"
                                                        className={cn(
                                                            "w-full justify-between font-mono text-xs font-normal",
                                                            !selected.length && "text-muted-foreground"
                                                        )}
                                                    >
                                                        <span className="truncate">
                                                            {selected.length
                                                                ? selected.join(", ")
                                                                : "请选择爬取来源"}
                                                        </span>
                                                        <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                                                    <Command>
                                                        <CommandList>
                                                            <CommandGroup>
                                                                {sourceUrlOptions.map((url) => (
                                                                    <CommandItem
                                                                        key={url}
                                                                        value={url}
                                                                        onSelect={() => toggle(url)}
                                                                        className="font-mono text-xs"
                                                                    >
                                                                        <Check
                                                                            className={cn(
                                                                                "mr-2 size-4",
                                                                                selected.includes(url) ? "opacity-100" : "opacity-0"
                                                                            )}
                                                                        />
                                                                        {url}
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                            <FormDescription>可多选，同时从多个来源爬取账号并合并</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )
                                }}
                            />
                            )}

                            {isVoidlogins && (
                            <div className="grid gap-4 sm:grid-cols-2">
                                <FormField
                                    control={control}
                                    name="voidloginsCode"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>
                                                分享页代码 <span className="text-destructive">*</span>
                                            </FormLabel>
                                            <FormControl>
                                                <Input placeholder="请输入分享页代码" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={control}
                                    name="voidloginsPassword"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>访问密码</FormLabel>
                                            <FormControl>
                                                <Input placeholder="无密码可留空" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            )}
                            <FormField
                                control={control}
                                name="validityHours"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>有效期（小时）</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                min={1}
                                                max={8760}
                                                placeholder="24（默认）"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormDescription>账号有效时长，过期后需重新下单；留空使用默认值 24 小时</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={control}
                                name="allowAccountSwitch"
                                render={({ field }) => (
                                    <FormItem>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <FormLabel>允许更换账号</FormLabel>
                                                <FormDescription>
                                                    开启后用户可在订单详情页申请更换不可用账号
                                                </FormDescription>
                                            </div>
                                            <FormControl>
                                                <Switch
                                                    checked={field.value ?? true}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            {allowAccountSwitch && (
                                <FormField
                                    control={control}
                                    name="accountSwitchLimit"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>最大更换次数</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    max={100}
                                                    placeholder="1"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormDescription>每个订单允许更换账号的次数上限</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            <Card className="w-full">
                <CardHeader>
                    <CardTitle>商品简介</CardTitle>
                    <p className="text-sm font-normal text-muted-foreground">
                        用于首页商品卡片下方展示，建议 1～2 句；留空则使用商品描述前 80 字
                    </p>
                </CardHeader>
                <CardContent className="space-y-2">
                    <FormField
                        control={control}
                        name="summary"
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <Input
                                        placeholder="简短介绍商品，最多 300 字"
                                        className="w-full"
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </CardContent>
            </Card>

            <Card className="w-full">
                <CardHeader>
                    <CardTitle>商品描述</CardTitle>
                    <p className="text-sm font-normal text-muted-foreground">
                        支持 Markdown，用于商品详情页展示
                    </p>
                </CardHeader>
                <CardContent>
                    <FormField
                        control={control}
                        name="description"
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <MarkdownEditor
                                        value={field.value ?? ""}
                                        onChange={field.onChange}
                                        placeholder="描述你的商品，支持 Markdown…"
                                        height={320}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </CardContent>
            </Card>
        </>
    )
}
