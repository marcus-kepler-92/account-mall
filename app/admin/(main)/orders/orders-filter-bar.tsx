"use client"

import { useState, FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
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
    DEFAULT_ORDER_FILTERS,
    type OrderFiltersState,
    buildOrderFiltersQuery,
} from "./orders-filters"

type OrdersFilterBarProps = {
    initialFilters: OrderFiltersState
}

export function OrdersFilterBar({ initialFilters }: OrdersFilterBarProps) {
    const router = useRouter()
    const [filters, setFilters] = useState<OrderFiltersState>(initialFilters)

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        const next: OrderFiltersState = {
            ...filters,
            page: 1,
        }

        const query = buildOrderFiltersQuery(next)
        router.push(`/admin/orders${query}`)
    }

    const handleReset = () => {
        const next: OrderFiltersState = {
            ...DEFAULT_ORDER_FILTERS,
        }
        setFilters(next)

        const query = buildOrderFiltersQuery(next)
        router.push(`/admin/orders${query}`)
    }

    return (
        <form className="flex flex-wrap items-center gap-4" onSubmit={handleSubmit}>
            <div className="relative flex-1 min-w-[220px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                    name="email"
                    placeholder="按邮箱搜索..."
                    className="pl-9"
                    value={filters.email}
                    onChange={(event) =>
                        setFilters((prev) => ({ ...prev, email: event.target.value }))
                    }
                />
            </div>
            <div className="flex-1 min-w-[220px] max-w-sm">
                <Input
                    name="orderNo"
                    placeholder="按订单号搜索..."
                    value={filters.orderNo}
                    onChange={(event) =>
                        setFilters((prev) => ({ ...prev, orderNo: event.target.value }))
                    }
                />
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
                    <Input
                        type="date"
                        name="dateFrom"
                        className="w-[150px]"
                        value={filters.dateFrom}
                        onChange={(event) =>
                            setFilters((prev) => ({ ...prev, dateFrom: event.target.value }))
                        }
                    />
                    <span className="text-xs text-muted-foreground">至</span>
                    <Input
                        type="date"
                        name="dateTo"
                        className="w-[150px]"
                        value={filters.dateTo}
                        onChange={(event) =>
                            setFilters((prev) => ({ ...prev, dateTo: event.target.value }))
                        }
                    />
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Select
                    name="status"
                    value={filters.status}
                    onValueChange={(value) =>
                        setFilters((prev) => ({
                            ...prev,
                            status: value as OrderFiltersState["status"],
                        }))
                    }
                >
                    <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="订单状态" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">全部状态</SelectItem>
                        <SelectItem value="PENDING">待完成</SelectItem>
                        <SelectItem value="COMPLETED">已完成</SelectItem>
                        <SelectItem value="CLOSED">已关闭</SelectItem>
                    </SelectContent>
                </Select>
                <Button type="submit" variant="outline">
                    查询
                </Button>
                <Button type="button" variant="ghost" onClick={handleReset} asChild>
                    <Link href="/admin/orders">重置</Link>
                </Button>
            </div>
        </form>
    )
}

