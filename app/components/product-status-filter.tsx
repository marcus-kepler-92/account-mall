"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { X } from "lucide-react"

type Tag = { slug: string; name: string }

export function ProductStatusFilter({
    currentStatus,
    currentTag,
    tags,
}: {
    currentStatus?: string
    currentTag?: string
    tags: Tag[]
}) {
    const router = useRouter()
    const searchParams = useSearchParams()

    const setFilter = (key: string, value: string | null) => {
        const params = new URLSearchParams(searchParams.toString())
        if (value) {
            params.set(key, value)
        } else {
            params.delete(key)
        }
        router.push(`/admin/products?${params.toString()}`)
    }

    const statusOptions = [
        { label: "全部", value: "" },
        { label: "上架", value: "ACTIVE" },
        { label: "下架", value: "INACTIVE" },
    ]

    return (
        <div className="flex flex-wrap items-center gap-3">
            {/* Status filter */}
            <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground mr-1">状态：</span>
                {statusOptions.map((opt) => (
                    <Button
                        key={opt.value}
                        variant={
                            (currentStatus ?? "") === opt.value
                                ? "default"
                                : "outline"
                        }
                        size="sm"
                        onClick={() =>
                            setFilter("status", opt.value || null)
                        }
                    >
                        {opt.label}
                    </Button>
                ))}
            </div>

            {/* Tag filter */}
            {tags.length > 0 && (
                <div className="flex items-center gap-1">
                    <span className="text-sm text-muted-foreground mr-1">标签：</span>
                    {tags.map((tag) => (
                        <Badge
                            key={tag.slug}
                            variant={
                                currentTag === tag.slug
                                    ? "default"
                                    : "outline"
                            }
                            className="cursor-pointer"
                            onClick={() =>
                                setFilter(
                                    "tag",
                                    currentTag === tag.slug
                                        ? null
                                        : tag.slug
                                )
                            }
                        >
                            {tag.name}
                        </Badge>
                    ))}
                    {currentTag && (
                        <button
                            onClick={() => setFilter("tag", null)}
                            className="ml-1 text-muted-foreground hover:text-foreground"
                        >
                            <X className="size-3" />
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}
