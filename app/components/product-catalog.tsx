"use client"

import { useState, useEffect, useCallback } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useQuery, keepPreviousData } from "@tanstack/react-query"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Search, SlidersHorizontal, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { ProductCardData } from "@/app/components/product-card"
import { ProductCatalogFilters } from "./product-catalog-filters"
import { ProductCatalogGrid } from "./product-catalog-grid"

type TagItem = { id: string; name: string; slug: string; _count?: { products: number } }
type SortOption = "default" | "price-asc" | "price-desc" | "newest"

const PAGE_SIZE = 18

function parseTagFromUrl(tagParam: string | null): string[] {
    if (!tagParam || typeof tagParam !== "string") return []
    return tagParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
}

async function fetchJson<T>(url: string): Promise<T> {
    const res = await fetchWithTimeout(url)
    if (!res.ok) throw new Error("请求失败")
    return res.json()
}

/** URL 为单一数据源，仅在用户操作时更新 query（router.replace），不做 effect 双向同步。 */
export function ProductCatalog() {
    const pathname = usePathname()
    const router = useRouter()
    const searchParams = useSearchParams()
    const tagParam = searchParams.get("tag") ?? ""
    const codeParam = searchParams.get("code") ?? ""
    const selectedTagSlugs = parseTagFromUrl(searchParams.get("tag"))

    const [searchInput, setSearchInput] = useState("")
    const [search, setSearch] = useState("")
    const [sort, setSort] = useState<SortOption>("default")
    const [currentPage, setCurrentPage] = useState(1)
    const [showMobileFilters, setShowMobileFilters] = useState(false)

    const tagsUrl = codeParam ? `/api/tags?code=${encodeURIComponent(codeParam)}` : "/api/tags"
    const { data: tags = [] } = useQuery<TagItem[]>({
        queryKey: ["tags", codeParam],
        queryFn: () => fetchJson(tagsUrl),
    })

    const productsParams = new URLSearchParams()
    if (search.trim()) productsParams.set("q", search.trim())
    if (tagParam) productsParams.set("tag", tagParam)
    if (codeParam) productsParams.set("code", codeParam)
    if (sort !== "default") productsParams.set("sort", sort)
    productsParams.set("page", String(currentPage))
    productsParams.set("pageSize", String(PAGE_SIZE))

    const {
        data: productsData,
        isLoading: loading,
        isError,
        error: queryError,
        refetch: refetchProducts,
    } = useQuery<{ data: ProductCardData[]; meta: { totalPages: number } }>({
        queryKey: ["products", search, tagParam, codeParam, sort, currentPage],
        queryFn: () => fetchJson(`/api/products?${productsParams}`),
        placeholderData: keepPreviousData,
    })

    const products = productsData?.data ?? []
    const totalPages = productsData?.meta?.totalPages ?? 1
    const error = isError ? (queryError instanceof Error ? queryError.message : "加载失败") : null

    useEffect(() => {
        const t = setTimeout(() => {
            setSearch(searchInput)
            setCurrentPage(1)
        }, 300)
        return () => clearTimeout(t)
    }, [searchInput])

    const createQueryStringWithTag = useCallback(
        (tagSlugs: string[]) => {
            const params = new URLSearchParams(searchParams.toString())
            if (tagSlugs.length === 0) params.delete("tag")
            else params.set("tag", tagSlugs.join(","))
            return params.toString()
        },
        [searchParams]
    )

    const toggleTag = (tagSlug: string) => {
        const next = selectedTagSlugs.includes(tagSlug)
            ? selectedTagSlugs.filter((s) => s !== tagSlug)
            : [...selectedTagSlugs, tagSlug]
        const q = createQueryStringWithTag(next)
        router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false })
        setCurrentPage(1)
    }

    const clearFilters = () => {
        setSearchInput("")
        setSearch("")
        setSort("default")
        setCurrentPage(1)
        const q = createQueryStringWithTag([])
        router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false })
    }

    const hasActiveFilters = searchInput || selectedTagSlugs.length > 0 || sort !== "default"

    return (
        <div className="flex gap-8">
            <aside className="hidden w-56 shrink-0 lg:block">
                <ProductCatalogFilters
                    tags={tags}
                    selectedTagSlugs={selectedTagSlugs}
                    sort={sort}
                    onToggleTag={toggleTag}
                    onSortChange={(v) => {
                        setSort(v)
                        setCurrentPage(1)
                    }}
                />
            </aside>

            <div className="flex-1 min-w-0">
                <div className="mb-6 flex items-center gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input
                            placeholder="搜索商品..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <Button
                        variant="outline"
                        size="icon"
                        className="lg:hidden shrink-0"
                        onClick={() => setShowMobileFilters(!showMobileFilters)}
                    >
                        <SlidersHorizontal className="size-4" />
                    </Button>
                    <div className="hidden sm:block lg:hidden">
                        <Select
                            value={sort}
                            onValueChange={(v) => {
                                setSort(v as SortOption)
                                setCurrentPage(1)
                            }}
                        >
                            <SelectTrigger className="w-[160px]" aria-label="排序方式">
                                <SelectValue placeholder="排序" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="default">默认</SelectItem>
                                <SelectItem value="price-asc">价格从低到高</SelectItem>
                                <SelectItem value="price-desc">价格从高到低</SelectItem>
                                <SelectItem value="newest">最新优先</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {showMobileFilters && (
                    <div className="mb-6 rounded-lg border p-4 lg:hidden">
                        <ProductCatalogFilters
                            tags={tags}
                            selectedTagSlugs={selectedTagSlugs}
                            sort={sort}
                            onToggleTag={toggleTag}
                            onSortChange={(v) => {
                                setSort(v)
                                setCurrentPage(1)
                            }}
                        />
                    </div>
                )}

                {hasActiveFilters && (
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                        {selectedTagSlugs.map((slug) => (
                            <Badge key={slug} variant="secondary" className="gap-1 pr-1">
                                {tags.find((t) => t.slug === slug)?.name ?? slug}
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="ml-0.5 size-5 rounded-full p-0 hover:bg-muted-foreground/20"
                                    onClick={() => toggleTag(slug)}
                                    aria-label="移除标签"
                                >
                                    <X className="size-3" />
                                </Button>
                            </Badge>
                        ))}
                        {searchInput && (
                            <Badge variant="secondary" className="gap-1 pr-1">
                                &quot;{searchInput}&quot;
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="ml-0.5 size-5 rounded-full p-0 hover:bg-muted-foreground/20"
                                    onClick={() => {
                                        setSearchInput("")
                                        setSearch("")
                                        setCurrentPage(1)
                                    }}
                                    aria-label="移除搜索"
                                >
                                    <X className="size-3" />
                                </Button>
                            </Badge>
                        )}
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-xs text-muted-foreground hover:text-foreground"
                            onClick={clearFilters}
                        >
                            清除全部
                        </Button>
                    </div>
                )}

                <ProductCatalogGrid
                    products={products}
                    loading={loading}
                    error={error}
                    currentPage={currentPage}
                    totalPages={totalPages}
                    codeParam={codeParam}
                    onPageChange={setCurrentPage}
                    onRetry={refetchProducts}
                />
            </div>
        </div>
    )
}
