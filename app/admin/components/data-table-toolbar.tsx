"use client"

import { Table } from "@tanstack/react-table"
import { X } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, useTransition } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DataTableViewOptions } from "./data-table-view-options"

interface StatusOption {
    label: string
    value: string
}

interface DataTableToolbarProps<TData> {
    table: Table<TData>
    searchPlaceholder?: string
    searchParamKey?: string
    statusOptions?: StatusOption[]
    statusParamKey?: string
    children?: React.ReactNode
}

export function DataTableToolbar<TData>({
    table,
    searchPlaceholder = "搜索...",
    searchParamKey = "search",
    statusOptions,
    statusParamKey,
    children,
}: DataTableToolbarProps<TData>) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [, startTransition] = useTransition()

    const initialSearch = searchParams.get(searchParamKey) || ""
    const [searchValue, setSearchValue] = useState(initialSearch)

    // Sync the controlled input when the URL (source of truth) changes via
    // back/forward or external navigation — intentional set-state-in-effect.
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSearchValue(searchParams.get(searchParamKey) || "")
    }, [searchParams, searchParamKey])

    const updateSearch = (value: string) => {
        const params = new URLSearchParams(searchParams.toString())
        if (value) {
            params.set(searchParamKey, value)
        } else {
            params.delete(searchParamKey)
        }
        params.set("page", "1")
        startTransition(() => {
            router.push(`?${params.toString()}`)
        })
    }

    const hasFilters = searchParams.toString().length > 0

    const clearAllFilters = () => {
        setSearchValue("")
        router.push("?")
    }

    // Status badge filter: single-select via URL param
    const rawStatus = statusParamKey ? (searchParams.get(statusParamKey) ?? "") : ""
    const activeStatus = statusOptions?.some((opt) => opt.value === rawStatus) ? rawStatus : ""

    const handleStatusClick = (value: string) => {
        if (!statusParamKey) return
        const params = new URLSearchParams(searchParams.toString())
        if (value === "" || activeStatus === value) {
            params.delete(statusParamKey)
        } else {
            params.set(statusParamKey, value)
        }
        params.set("page", "1")
        router.push(`?${params.toString()}`)
    }

    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-2">
                <Input
                    placeholder={searchPlaceholder}
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") updateSearch(searchValue)
                    }}
                    onBlur={() => {
                        if (searchValue !== initialSearch) updateSearch(searchValue)
                    }}
                    className="h-8 w-[150px] lg:w-[250px]"
                />
                {statusOptions && statusParamKey && (
                    <div className="flex items-center gap-1">
                        <Badge
                            variant={activeStatus === "" ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => handleStatusClick("")}
                        >
                            全部
                        </Badge>
                        {statusOptions.map((opt) => (
                            <Badge
                                key={opt.value}
                                variant={activeStatus === opt.value ? "default" : "outline"}
                                className="cursor-pointer"
                                onClick={() => handleStatusClick(opt.value)}
                            >
                                {opt.label}
                            </Badge>
                        ))}
                    </div>
                )}
                {children}
                {hasFilters && (
                    <Button
                        variant="ghost"
                        onClick={clearAllFilters}
                        className="h-8 px-2 lg:px-3"
                    >
                        重置
                        <X className="ml-2 h-4 w-4" />
                    </Button>
                )}
            </div>
            <DataTableViewOptions table={table} />
        </div>
    )
}
