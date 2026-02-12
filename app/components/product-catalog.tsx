"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
    Search,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    SlidersHorizontal,
    X,
    Package,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ProductCard, ProductCardSkeleton, type ProductCardData } from "@/app/components/product-card"

type TagItem = { id: string; name: string; slug: string; _count?: { products: number } }

type SortOption = "default" | "price-asc" | "price-desc" | "newest"

const PAGE_SIZE = 18

export function ProductCatalog() {
    const [searchInput, setSearchInput] = useState("")
    const [search, setSearch] = useState("")
    const [selectedTagSlugs, setSelectedTagSlugs] = useState<string[]>([])
    const [sort, setSort] = useState<SortOption>("default")
    const [currentPage, setCurrentPage] = useState(1)
    const [categoriesOpen, setCategoriesOpen] = useState(true)
    const [showMobileFilters, setShowMobileFilters] = useState(false)

    const [tags, setTags] = useState<TagItem[]>([])
    const [products, setProducts] = useState<ProductCardData[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [totalPages, setTotalPages] = useState(1)

    const fetchTags = useCallback(async () => {
        try {
            const res = await fetch("/api/tags")
            if (!res.ok) throw new Error("Failed to fetch tags")
            const data = await res.json()
            setTags(data)
        } catch {
            setTags([])
        }
    }, [])

    const fetchProducts = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const params = new URLSearchParams()
            if (search.trim()) params.set("q", search.trim())
            if (selectedTagSlugs.length > 0) params.set("tag", selectedTagSlugs.join(","))
            if (sort !== "default") params.set("sort", sort)
            params.set("page", String(currentPage))
            params.set("pageSize", String(PAGE_SIZE))

            const res = await fetch(`/api/products?${params}`)
            if (!res.ok) throw new Error("Failed to fetch products")
            const json = await res.json()
            setProducts(json.data ?? [])
            setTotalPages(json.meta?.totalPages ?? 1)
        } catch (e) {
            setError(e instanceof Error ? e.message : "加载失败")
            setProducts([])
        } finally {
            setLoading(false)
        }
    }, [search, selectedTagSlugs, sort, currentPage])

    useEffect(() => {
        fetchTags()
    }, [fetchTags])

    useEffect(() => {
        fetchProducts()
    }, [fetchProducts])

    // Debounce search input
    useEffect(() => {
        const t = setTimeout(() => {
            setSearch(searchInput)
            setCurrentPage(1)
        }, 300)
        return () => clearTimeout(t)
    }, [searchInput])

    const toggleTag = (tagSlug: string) => {
        setSelectedTagSlugs((prev) =>
            prev.includes(tagSlug)
                ? prev.filter((s) => s !== tagSlug)
                : [...prev, tagSlug]
        )
        setCurrentPage(1)
    }

    const clearFilters = () => {
        setSearchInput("")
        setSearch("")
        setSelectedTagSlugs([])
        setSort("default")
        setCurrentPage(1)
    }

    const hasActiveFilters = searchInput || selectedTagSlugs.length > 0 || sort !== "default"

    // Sidebar filter content (shared between desktop and mobile)
    const filterContent = (
        <div className="space-y-6">
            {/* Categories */}
            <Collapsible open={categoriesOpen} onOpenChange={setCategoriesOpen}>
                <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-sm font-semibold hover:text-foreground transition-colors">
                    分类
                    <ChevronDown className={`size-4 text-muted-foreground transition-transform ${categoriesOpen ? "rotate-180" : ""}`} />
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <div className="space-y-2 pt-2">
                        {tags.map((tag) => (
                            <label
                                key={tag.id}
                                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
                            >
                                <Checkbox
                                    checked={selectedTagSlugs.includes(tag.slug)}
                                    onCheckedChange={() => toggleTag(tag.slug)}
                                />
                                <span className="flex-1">{tag.name}</span>
                                <span className="text-xs text-muted-foreground">
                                    {tag._count?.products ?? 0}
                                </span>
                            </label>
                        ))}
                    </div>
                </CollapsibleContent>
            </Collapsible>

            {/* Price filter */}
            <Collapsible defaultOpen>
                <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-sm font-semibold hover:text-foreground transition-colors">
                    排序
                    <ChevronDown className="size-4 text-muted-foreground transition-transform data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <div className="pt-2">
                        <Select value={sort} onValueChange={(v) => { setSort(v as SortOption); setCurrentPage(1) }}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="默认" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="default">默认</SelectItem>
                                <SelectItem value="price-asc">价格从低到高</SelectItem>
                                <SelectItem value="price-desc">价格从高到低</SelectItem>
                                <SelectItem value="newest">最新优先</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CollapsibleContent>
            </Collapsible>
        </div>
    )

    return (
        <div className="flex gap-8">
            {/* Desktop sidebar filters */}
            <aside className="hidden w-56 shrink-0 lg:block">
                {filterContent}
            </aside>

            {/* Main content */}
            <div className="flex-1 min-w-0">
                {/* Search bar + mobile filter toggle */}
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
                    {/* Mobile filter button */}
                    <Button
                        variant="outline"
                        size="icon"
                        className="lg:hidden shrink-0"
                        onClick={() => setShowMobileFilters(!showMobileFilters)}
                    >
                        <SlidersHorizontal className="size-4" />
                    </Button>
                    {/* Desktop sort */}
                    <div className="hidden sm:block lg:hidden">
                        <Select value={sort} onValueChange={(v) => { setSort(v as SortOption); setCurrentPage(1) }}>
                            <SelectTrigger className="w-[160px]">
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

                {/* Mobile filters panel */}
                {showMobileFilters && (
                    <div className="mb-6 rounded-lg border p-4 lg:hidden">
                        {filterContent}
                    </div>
                )}

                {/* Active filters */}
                {hasActiveFilters && (
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                        {selectedTagSlugs.map((slug) => (
                            <Badge key={slug} variant="secondary" className="gap-1 pr-1">
                                {tags.find((t) => t.slug === slug)?.name ?? slug}
                                <button
                                    onClick={() => toggleTag(slug)}
                                    className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
                                >
                                    <X className="size-3" />
                                </button>
                            </Badge>
                        ))}
                        {searchInput && (
                            <Badge variant="secondary" className="gap-1 pr-1">
                                &quot;{searchInput}&quot;
                                <button
                                    onClick={() => { setSearchInput(""); setSearch(""); setCurrentPage(1) }}
                                    className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
                                >
                                    <X className="size-3" />
                                </button>
                            </Badge>
                        )}
                        <button
                            onClick={clearFilters}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                            清除全部
                        </button>
                    </div>
                )}

                {/* Loading state */}
                {loading && (
                    <div className="grid grid-cols-1 items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[1600px]:grid-cols-6">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <ProductCardSkeleton key={i} />
                        ))}
                    </div>
                )}

                {/* Error state */}
                {!loading && error && (
                    <div className="flex flex-col items-center justify-center py-20">
                        <p className="text-sm font-medium text-destructive">{error}</p>
                        <Button variant="outline" className="mt-4" onClick={() => fetchProducts()}>
                            重试
                        </Button>
                    </div>
                )}

                {/* Product grid - equal height, cover aspect ratio preserved */}
                {!loading && !error && (
                <div className="grid grid-cols-1 items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[1600px]:grid-cols-6">
                    {products.map((product, idx) => (
                        <ProductCard key={product.id} product={product} gradientIndex={idx} />
                    ))}
                </div>
                )}

                {/* Empty state */}
                {!loading && !error && products.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="mb-4 rounded-full bg-muted p-4">
                            <Package className="size-8 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium">未找到商品</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            试试调整搜索或筛选条件
                        </p>
                    </div>
                )}

                {/* Pagination */}
                {!loading && !error && totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                    <Button
                        variant="outline"
                        size="icon"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((p) => p - 1)}
                    >
                        <ChevronLeft className="size-4" />
                    </Button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <Button
                            key={page}
                            variant={page === currentPage ? "default" : "outline"}
                            size="icon"
                            onClick={() => setCurrentPage(page)}
                        >
                            {page}
                        </Button>
                    ))}
                    <Button
                        variant="outline"
                        size="icon"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage((p) => p + 1)}
                    >
                        <ChevronRight className="size-4" />
                    </Button>
                </div>
                )}
            </div>
        </div>
    )
}
