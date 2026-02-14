"use client"

import { useState, FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronDown, ChevronUp, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    DEFAULT_CARD_FILTERS,
    type CardFiltersState,
    buildCardFiltersQuery,
} from "./cards-filters"

type CardsFilterBarProps = {
    initialFilters: CardFiltersState
}

export function CardsFilterBar({ initialFilters }: CardsFilterBarProps) {
    const router = useRouter()
    const [filters, setFilters] = useState<CardFiltersState>(initialFilters)
    const [advancedOpen, setAdvancedOpen] = useState(
        Boolean(initialFilters.orderNo || initialFilters.productKeyword)
    )

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        const next: CardFiltersState = {
            ...filters,
            page: 1,
        }

        const query = buildCardFiltersQuery(next)
        router.push(`/admin/cards${query}`)
    }

    const handleReset = () => {
        const next: CardFiltersState = {
            ...DEFAULT_CARD_FILTERS,
        }
        setFilters(next)
        setAdvancedOpen(false)

        const query = buildCardFiltersQuery(next)
        router.push(`/admin/cards${query}`)
    }

    return (
        <form className="space-y-4" onSubmit={handleSubmit}>
            {/* Row 1: main search + status + actions */}
            <div className="flex flex-wrap items-center gap-4">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                        name="codeLike"
                        placeholder="按卡号片段搜索..."
                        className="pl-9"
                        value={filters.codeLike}
                        onChange={(event) =>
                            setFilters((prev) => ({ ...prev, codeLike: event.target.value }))
                        }
                    />
                </div>
                <Select
                    name="status"
                    value={filters.status}
                    onValueChange={(value) =>
                        setFilters((prev) => ({
                            ...prev,
                            status: value as CardFiltersState["status"],
                        }))
                    }
                >
                    <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="卡密状态" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">全部状态</SelectItem>
                        <SelectItem value="UNSOLD">未售</SelectItem>
                        <SelectItem value="RESERVED">预占中</SelectItem>
                        <SelectItem value="SOLD">已售</SelectItem>
                    </SelectContent>
                </Select>
                <Button type="submit" variant="outline">
                    查询
                </Button>
                <Button type="button" variant="ghost" onClick={handleReset} asChild>
                    <Link href="/admin/cards">重置</Link>
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => setAdvancedOpen((o) => !o)}
                >
                    {advancedOpen ? (
                        <>
                            <ChevronUp className="size-4" />
                            收起筛选
                        </>
                    ) : (
                        <>
                            <ChevronDown className="size-4" />
                            更多筛选
                        </>
                    )}
                </Button>
            </div>

            {/* Row 2: advanced (collapsible) */}
            {advancedOpen && (
                <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-muted/30 p-4">
                    <div className="flex-1 min-w-[200px] max-w-xs">
                        <Input
                            name="orderNo"
                            placeholder="按订单号搜索..."
                            value={filters.orderNo}
                            onChange={(event) =>
                                setFilters((prev) => ({ ...prev, orderNo: event.target.value }))
                            }
                        />
                    </div>
                    <div className="flex-1 min-w-[200px] max-w-xs">
                        <Input
                            name="productKeyword"
                            placeholder="按商品名称或短链搜索..."
                            value={filters.productKeyword}
                            onChange={(event) =>
                                setFilters((prev) => ({
                                    ...prev,
                                    productKeyword: event.target.value,
                                }))
                            }
                        />
                    </div>
                </div>
            )}
        </form>
    )
}

