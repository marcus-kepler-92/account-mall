"use client"

import { useState } from "react"
import { useFormContext } from "react-hook-form"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { buttonVariants } from "@/components/ui/button"
import { Loader2, Plus, X, Trash2 } from "lucide-react"
import type { ProductFormSchema } from "@/lib/validations/product"

type Tag = { id: string; name: string; slug: string }

export function ProductFormTagSelect({ initialTags }: { initialTags: Tag[] }) {
    const { watch, setValue } = useFormContext<ProductFormSchema>()
    const tagIds = (watch("tagIds") ?? []) as string[]

    const [tags, setTags] = useState<Tag[]>(initialTags)
    const [newTagName, setNewTagName] = useState("")
    const [creatingTag, setCreatingTag] = useState(false)
    const [deletingTagId, setDeletingTagId] = useState<string | null>(null)
    const [confirmDeleteTagId, setConfirmDeleteTagId] = useState<string | null>(null)

    const toggleTag = (tagId: string) => {
        const next = tagIds.includes(tagId)
            ? tagIds.filter((id) => id !== tagId)
            : [...tagIds, tagId]
        setValue("tagIds", next)
    }

    const doDeleteTag = async (tagId: string) => {
        setDeletingTagId(tagId)
        try {
            const res = await fetch(`/api/tags/${tagId}`, { method: "DELETE" })
            if (!res.ok) {
                const data = await res.json()
                toast.error(data.error || "删除标签失败")
                return
            }
            setTags((prev) => prev.filter((t) => t.id !== tagId))
            setValue("tagIds", tagIds.filter((id) => id !== tagId))
            toast.success("标签已删除")
        } catch {
            toast.error("删除标签失败")
        } finally {
            setDeletingTagId(null)
        }
    }

    const handleCreateTag = async () => {
        if (!newTagName.trim()) return
        setCreatingTag(true)
        try {
            const res = await fetch("/api/tags", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newTagName.trim() }),
            })
            if (!res.ok) {
                const data = await res.json()
                toast.error(data.error || "创建标签失败")
                return
            }
            const tag = await res.json()
            setTags((prev) => [...prev, tag])
            setValue("tagIds", [...tagIds, tag.id])
            setNewTagName("")
        } catch {
            toast.error("创建标签失败")
        } finally {
            setCreatingTag(false)
        }
    }

    return (
        <>
            <AlertDialog
                open={confirmDeleteTagId !== null}
                onOpenChange={(open) => !open && setConfirmDeleteTagId(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>删除标签</AlertDialogTitle>
                        <AlertDialogDescription>
                            确定要删除该标签吗？删除后使用该标签的商品将不再关联此标签。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                const tagId = confirmDeleteTagId
                                setConfirmDeleteTagId(null)
                                if (tagId) doDeleteTag(tagId)
                            }}
                            className={buttonVariants({ variant: "destructive" })}
                        >
                            确定删除
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Card>
                <CardHeader>
                    <CardTitle>标签</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {tags.length > 0 && (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {tags.map((tag) => (
                                <div
                                    key={tag.id}
                                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
                                >
                                    <label className="flex flex-1 cursor-pointer items-center gap-2 min-w-0">
                                        <Checkbox
                                            checked={tagIds.includes(tag.id)}
                                            onCheckedChange={() => toggleTag(tag.id)}
                                        />
                                        <span className="truncate">{tag.name}</span>
                                    </label>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="shrink-0 size-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                        disabled={deletingTagId === tag.id}
                                        onClick={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            setConfirmDeleteTagId(tag.id)
                                        }}
                                        title="删除标签"
                                        aria-label="删除标签"
                                    >
                                        {deletingTagId === tag.id ? (
                                            <Loader2 className="size-3.5 animate-spin" />
                                        ) : (
                                            <Trash2 className="size-3.5" />
                                        )}
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}

                    {tagIds.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-2 border-t">
                            {tagIds.map((id) => {
                                const tag = tags.find((t) => t.id === id)
                                return tag ? (
                                    <Badge key={id} variant="secondary" className="gap-1 pr-1">
                                        {tag.name}
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="ml-0.5 size-5 rounded-full p-0 hover:bg-muted-foreground/20"
                                            onClick={() => toggleTag(id)}
                                            aria-label="移除标签"
                                        >
                                            <X className="size-3" />
                                        </Button>
                                    </Badge>
                                ) : null
                            })}
                        </div>
                    )}

                    <div className="flex items-center gap-2 pt-2 border-t">
                        <Input
                            value={newTagName}
                            onChange={(e) => setNewTagName(e.target.value)}
                            placeholder="新建标签..."
                            className="h-8 text-sm"
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault()
                                    handleCreateTag()
                                }
                            }}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleCreateTag}
                            disabled={creatingTag || !newTagName.trim()}
                        >
                            {creatingTag ? (
                                <Loader2 className="size-3 animate-spin" />
                            ) : (
                                <Plus className="size-3" />
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </>
    )
}
