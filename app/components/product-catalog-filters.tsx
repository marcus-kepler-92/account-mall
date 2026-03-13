"use client"

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
import { ChevronDown } from "lucide-react"
import { useState } from "react"

type TagItem = { id: string; name: string; slug: string; _count?: { products: number } }
type SortOption = "default" | "price-asc" | "price-desc" | "newest"

type Props = {
    tags: TagItem[]
    selectedTagSlugs: string[]
    sort: SortOption
    onToggleTag: (slug: string) => void
    onSortChange: (sort: SortOption) => void
}

export function ProductCatalogFilters({
    tags,
    selectedTagSlugs,
    sort,
    onToggleTag,
    onSortChange,
}: Props) {
    const [categoriesOpen, setCategoriesOpen] = useState(true)

    return (
        <div className="space-y-6">
            <Collapsible open={categoriesOpen} onOpenChange={setCategoriesOpen}>
                <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-sm font-semibold hover:text-foreground transition-colors">
                    分类
                    <ChevronDown
                        className={`size-4 text-muted-foreground transition-transform ${categoriesOpen ? "rotate-180" : ""}`}
                    />
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
                                    onCheckedChange={() => onToggleTag(tag.slug)}
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

            <Collapsible defaultOpen>
                <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-sm font-semibold hover:text-foreground transition-colors">
                    排序
                    <ChevronDown className="size-4 text-muted-foreground transition-transform data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <div className="pt-2">
                        <Select
                            value={sort}
                            onValueChange={(v) => onSortChange(v as SortOption)}
                        >
                            <SelectTrigger className="w-full" aria-label="排序方式">
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
}
