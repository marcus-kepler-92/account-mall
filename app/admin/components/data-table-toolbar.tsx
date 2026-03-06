"use client";

import { Table } from "@tanstack/react-table";
import { X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTableViewOptions } from "./data-table-view-options";

interface DataTableToolbarProps<TData> {
    table: Table<TData>;
    searchPlaceholder?: string;
    searchParamKey?: string;
    children?: React.ReactNode;
}

export function DataTableToolbar<TData>({
    table,
    searchPlaceholder = "搜索...",
    searchParamKey = "search",
    children,
}: DataTableToolbarProps<TData>) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();
    
    const initialSearch = searchParams.get(searchParamKey) || "";
    const [searchValue, setSearchValue] = useState(initialSearch);

    useEffect(() => {
        setSearchValue(searchParams.get(searchParamKey) || "");
    }, [searchParams, searchParamKey]);

    const updateSearch = (value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value) {
            params.set(searchParamKey, value);
        } else {
            params.delete(searchParamKey);
        }
        params.set("page", "1");
        startTransition(() => {
            router.push(`?${params.toString()}`);
        });
    };

    const hasFilters = searchParams.toString().length > 0;

    const clearAllFilters = () => {
        setSearchValue("");
        router.push("?");
    };

    return (
        <div className="flex items-center justify-between">
            <div className="flex flex-1 items-center space-x-2">
                <Input
                    placeholder={searchPlaceholder}
                    value={searchValue}
                    onChange={(e) => {
                        setSearchValue(e.target.value);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            updateSearch(searchValue);
                        }
                    }}
                    onBlur={() => {
                        if (searchValue !== initialSearch) {
                            updateSearch(searchValue);
                        }
                    }}
                    className="h-8 w-[150px] lg:w-[250px]"
                />
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
    );
}
