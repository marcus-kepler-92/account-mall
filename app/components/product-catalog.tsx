"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
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

// Mock data - will be replaced with real data from API
const mockTags = [
    { id: "1", name: "Game Accounts", slug: "game-accounts", count: 12 },
    { id: "2", name: "Software Keys", slug: "software-keys", count: 8 },
    { id: "3", name: "Subscriptions", slug: "subscriptions", count: 5 },
    { id: "4", name: "Gift Cards", slug: "gift-cards", count: 15 },
    { id: "5", name: "Social Media", slug: "social-media", count: 3 },
]

const mockProducts = [
    { id: "1", name: "Premium Game Account", price: "29.99", tags: ["Game Accounts"], stock: 5 },
    { id: "2", name: "Office 365 License Key", price: "49.99", tags: ["Software Keys"], stock: 12 },
    { id: "3", name: "Netflix 1-Year Sub", price: "99.99", tags: ["Subscriptions"], stock: 0 },
    { id: "4", name: "Steam Gift Card $50", price: "45.00", tags: ["Gift Cards"], stock: 20 },
    { id: "5", name: "Spotify Premium 6M", price: "39.99", tags: ["Subscriptions"], stock: 8 },
    { id: "6", name: "Windows 11 Pro Key", price: "19.99", tags: ["Software Keys"], stock: 30 },
]

type SortOption = "default" | "price-asc" | "price-desc" | "newest"

export function ProductCatalog() {
    const [search, setSearch] = useState("")
    const [selectedTags, setSelectedTags] = useState<string[]>([])
    const [sort, setSort] = useState<SortOption>("default")
    const [currentPage, setCurrentPage] = useState(1)
    const [categoriesOpen, setCategoriesOpen] = useState(true)
    const [showMobileFilters, setShowMobileFilters] = useState(false)

    const pageSize = 9
    const totalPages = 3 // Mock total pages

    const toggleTag = (tagName: string) => {
        setSelectedTags((prev) =>
            prev.includes(tagName)
                ? prev.filter((t) => t !== tagName)
                : [...prev, tagName]
        )
        setCurrentPage(1)
    }

    const clearFilters = () => {
        setSearch("")
        setSelectedTags([])
        setSort("default")
        setCurrentPage(1)
    }

    const hasActiveFilters = search || selectedTags.length > 0 || sort !== "default"

    // Sidebar filter content (shared between desktop and mobile)
    const filterContent = (
        <div className="space-y-6">
            {/* Categories */}
            <Collapsible open={categoriesOpen} onOpenChange={setCategoriesOpen}>
                <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-sm font-semibold hover:text-foreground transition-colors">
                    Categories
                    <ChevronDown className={`size-4 text-muted-foreground transition-transform ${categoriesOpen ? "rotate-180" : ""}`} />
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <div className="space-y-2 pt-2">
                        {mockTags.map((tag) => (
                            <label
                                key={tag.id}
                                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
                            >
                                <Checkbox
                                    checked={selectedTags.includes(tag.name)}
                                    onCheckedChange={() => toggleTag(tag.name)}
                                />
                                <span className="flex-1">{tag.name}</span>
                                <span className="text-xs text-muted-foreground">{tag.count}</span>
                            </label>
                        ))}
                    </div>
                </CollapsibleContent>
            </Collapsible>

            {/* Price filter */}
            <Collapsible defaultOpen>
                <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-sm font-semibold hover:text-foreground transition-colors">
                    Sort By
                    <ChevronDown className="size-4 text-muted-foreground transition-transform data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <div className="pt-2">
                        <Select value={sort} onValueChange={(v) => { setSort(v as SortOption); setCurrentPage(1) }}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Default" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="default">Default</SelectItem>
                                <SelectItem value="price-asc">Price: Low to High</SelectItem>
                                <SelectItem value="price-desc">Price: High to Low</SelectItem>
                                <SelectItem value="newest">Newest First</SelectItem>
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
                            placeholder="Search products..."
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
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
                                <SelectValue placeholder="Sort by" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="default">Default</SelectItem>
                                <SelectItem value="price-asc">Price: Low → High</SelectItem>
                                <SelectItem value="price-desc">Price: High → Low</SelectItem>
                                <SelectItem value="newest">Newest First</SelectItem>
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
                        {selectedTags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                                {tag}
                                <button
                                    onClick={() => toggleTag(tag)}
                                    className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
                                >
                                    <X className="size-3" />
                                </button>
                            </Badge>
                        ))}
                        {search && (
                            <Badge variant="secondary" className="gap-1 pr-1">
                                &quot;{search}&quot;
                                <button
                                    onClick={() => setSearch("")}
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
                            Clear all
                        </button>
                    </div>
                )}

                {/* Product grid */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {mockProducts.map((product) => (
                        <Card key={product.id} className="group overflow-hidden transition-colors hover:border-foreground/20">
                            <CardContent className="pt-5">
                                <div className="mb-3 flex flex-wrap gap-1.5">
                                    {product.tags.map((tag) => (
                                        <Badge key={tag} variant="secondary" className="text-xs font-normal">
                                            {tag}
                                        </Badge>
                                    ))}
                                </div>
                                <h3 className="font-medium leading-snug group-hover:text-primary transition-colors">
                                    {product.name}
                                </h3>
                            </CardContent>
                            <CardFooter className="flex items-center justify-between">
                                <div>
                                    <span className="text-lg font-bold">${product.price}</span>
                                    {product.stock > 0 ? (
                                        <span className="ml-2 text-xs text-muted-foreground">
                                            {product.stock} in stock
                                        </span>
                                    ) : (
                                        <span className="ml-2 text-xs text-destructive">
                                            Out of stock
                                        </span>
                                    )}
                                </div>
                                <Button size="sm" disabled={product.stock === 0}>
                                    Buy
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>

                {/* Empty state */}
                {mockProducts.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="mb-4 rounded-full bg-muted p-4">
                            <Package className="size-8 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium">No products found</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Try adjusting your search or filters.
                        </p>
                    </div>
                )}

                {/* Pagination */}
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
            </div>
        </div>
    )
}
