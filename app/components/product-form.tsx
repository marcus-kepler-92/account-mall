"use client"

import { useState, useEffect } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
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
import { generateSlug } from "@/lib/utils"
import { MarkdownEditor } from "@/app/components/markdown-editor"
import { productFormSchema, type ProductFormSchema } from "@/lib/validations/product"
import { Loader2, Plus, X, ArrowLeft, Upload, Trash2 } from "lucide-react"
import Link from "next/link"

type Tag = {
    id: string
    name: string
    slug: string
}

type ProductData = {
    id: string
    name: string
    slug: string
    description: string | null
    summary: string | null
    image: string | null
    price: number
    maxQuantity: number
    status: string
    productType?: "NORMAL" | "FREE_SHARED"
    sourceUrl?: string | null
    tags: Tag[]
}

export function ProductForm({
    product,
    allTags,
}: {
    product?: ProductData
    allTags: Tag[]
}) {
    const router = useRouter()
    const isEditing = !!product

    const [newTagName, setNewTagName] = useState("")
    const [tags, setTags] = useState<Tag[]>(allTags)
    const [creatingTag, setCreatingTag] = useState(false)
    const [deletingTagId, setDeletingTagId] = useState<string | null>(null)
    const [confirmDeleteTagId, setConfirmDeleteTagId] = useState<string | null>(null)
    const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)

    const form = useForm<ProductFormSchema>({
        resolver: zodResolver(productFormSchema),
        defaultValues: {
            name: product?.name ?? "",
            slug: product?.slug ?? "",
            description: product?.description ?? "",
            summary: product?.summary ?? "",
            image: product?.image ?? "",
            price: product ? String(product.price) : "",
            maxQuantity: product ? String(product.maxQuantity) : "10",
            isActive: product ? product.status === "ACTIVE" : true,
            productType: product?.productType ?? "NORMAL",
            sourceUrl: product?.sourceUrl ?? "",
            tagIds: product?.tags.map((t) => t.id) ?? [],
        },
    })

    const { register, handleSubmit, formState: { errors }, watch, setValue, control } = form
    const name = watch("name")
    watch("slug")
    const imageValue = watch("image")
    const isActive = watch("isActive")
    const productType = watch("productType") ?? "NORMAL"
    const tagIds = watch("tagIds") ?? []
    const isFreeShared = productType === "FREE_SHARED"

    // Convert uploaded file to base64
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (!file.type.startsWith("image/")) {
            toast.error("请上传图片文件")
            return
        }
        if (file.size > 2 * 1024 * 1024) {
            toast.error("图片大小不能超过 2MB")
            return
        }
        const reader = new FileReader()
        reader.onload = () => {
            setValue("image", reader.result as string)
        }
        reader.readAsDataURL(file)
    }

    // Auto-generate slug from name (unless manually edited)
    useEffect(() => {
        if (!slugManuallyEdited && !isEditing) {
            setValue("slug", generateSlug(name))
        }
    }, [name, slugManuallyEdited, isEditing, setValue])

    const toggleTag = (tagId: string) => {
        const current = tagIds as string[]
        const next = current.includes(tagId)
            ? current.filter((id) => id !== tagId)
            : [...current, tagId]
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
            setValue(
                "tagIds",
                (tagIds as string[]).filter((id) => id !== tagId)
            )
            toast.success("标签已删除")
        } catch {
            toast.error("删除标签失败")
        } finally {
            setDeletingTagId(null)
        }
    }

    const handleDeleteTagClick = (e: React.MouseEvent, tagId: string) => {
        e.preventDefault()
        e.stopPropagation()
        setConfirmDeleteTagId(tagId)
    }

    const handleConfirmDeleteTag = () => {
        const tagId = confirmDeleteTagId
        setConfirmDeleteTagId(null)
        if (tagId) doDeleteTag(tagId)
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
            setValue("tagIds", [...(tagIds as string[]), tag.id])
            setNewTagName("")
        } catch {
            toast.error("创建标签失败")
        } finally {
            setCreatingTag(false)
        }
    }

    const onSubmit = async (data: ProductFormSchema) => {
        const body = {
            name: data.name.trim(),
            slug: data.slug.trim(),
            description: data.description?.trim() || undefined,
            summary: data.summary?.trim() || null,
            image: data.image || null,
            price: isFreeShared ? 0 : parseFloat(data.price),
            maxQuantity: data.maxQuantity === "" ? 10 : parseInt(data.maxQuantity, 10),
            status: data.isActive ? "ACTIVE" : "INACTIVE",
            productType: data.productType ?? "NORMAL",
            sourceUrl: isFreeShared ? (data.sourceUrl?.trim() || null) : null,
            tagIds: data.tagIds ?? [],
        }

        try {
            const url = isEditing
                ? `/api/products/${product.id}`
                : "/api/products"
            const method = isEditing ? "PUT" : "POST"

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            })

            if (!res.ok) {
                const data = await res.json()
                toast.error(data.error || "保存商品失败")
                return
            }

            toast.success(isEditing ? "商品已更新" : "商品已创建")
            router.push("/admin/products")
            router.refresh()
        } catch {
            toast.error("发生未知错误")
        }
    }

    return (
        <div className="space-y-6">
            <AlertDialog open={confirmDeleteTagId !== null} onOpenChange={(open) => !open && setConfirmDeleteTagId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>删除标签</AlertDialogTitle>
                        <AlertDialogDescription>
                            确定要删除该标签吗？删除后使用该标签的商品将不再关联此标签。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmDeleteTag} className={buttonVariants({ variant: "destructive" })}>
                            确定删除
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/admin/products">
                        <ArrowLeft className="size-4" />
                    </Link>
                </Button>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">
                        {isEditing ? "编辑商品" : "新建商品"}
                    </h2>
                    <p className="text-muted-foreground">
                        {isEditing ? "更新商品信息" : "创建新的数字商品"}
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-3">
                    <div className="lg:col-span-2 space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>基本信息</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">
                                        商品名称 <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id="name"
                                        {...register("name")}
                                        placeholder="例如：ChatGPT Plus 账号"
                                    />
                                    {errors.name && (
                                        <p className="text-sm text-destructive">{errors.name.message}</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="slug">
                                        URL 别名 <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id="slug"
                                        {...register("slug", {
                                            onChange: () => setSlugManuallyEdited(true),
                                        })}
                                        placeholder="chatgpt-plus-account"
                                    />
                                    {errors.slug && (
                                        <p className="text-sm text-destructive">{errors.slug.message}</p>
                                    )}
                                    <p className="text-xs text-muted-foreground">
                                        用于商品 URL，仅支持小写字母、数字和连字符
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label>商品图片</Label>
                                    {imageValue ? (
                                        <div className="relative inline-block">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={imageValue}
                                                alt="商品图片预览"
                                                className="h-[200px] w-[200px] rounded-md border object-cover"
                                            />
                                            <Button
                                                type="button"
                                                variant="destructive"
                                                size="icon"
                                                className="absolute -right-2 -top-2 size-6"
                                                onClick={() => setValue("image", "")}
                                            >
                                                <Trash2 className="size-3" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <label
                                            htmlFor="image-upload"
                                            className="flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed p-6 transition-colors hover:border-foreground/30 hover:bg-accent/50"
                                        >
                                            <Upload className="mb-2 size-6 text-muted-foreground" />
                                            <span className="text-sm text-muted-foreground">
                                                点击上传图片
                                            </span>
                                            <span className="mt-1 text-xs text-muted-foreground">
                                                支持 JPG、PNG、GIF，最大 2MB
                                            </span>
                                        </label>
                                    )}
                                    <input
                                        id="image-upload"
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleImageUpload}
                                    />
                                    {errors.image && (
                                        <p className="text-sm text-destructive">{errors.image.message}</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>价格与限制</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>商品类型</Label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                value="NORMAL"
                                                {...register("productType")}
                                            />
                                            <span>普通商品</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                value="FREE_SHARED"
                                                {...register("productType")}
                                                onChange={(e) => {
                                                    register("productType").onChange(e)
                                                    if (e.target.value === "FREE_SHARED") setValue("price", "0")
                                                }}
                                            />
                                            <span>免费共享</span>
                                        </label>
                                    </div>
                                </div>

                                {isFreeShared && (
                                    <div className="space-y-2">
                                        <Label htmlFor="sourceUrl">
                                            爬取来源 URL <span className="text-destructive">*</span>
                                        </Label>
                                        <Input
                                            id="sourceUrl"
                                            {...register("sourceUrl")}
                                            placeholder="https://example.com/share/xxx"
                                        />
                                        {errors.sourceUrl && (
                                            <p className="text-sm text-destructive">{errors.sourceUrl.message}</p>
                                        )}
                                        <p className="text-xs text-muted-foreground">
                                            用户领取时从此地址爬取「状态:正常」的账号，随机分配一个
                                        </p>
                                    </div>
                                )}

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="price">
                                            价格 (¥) <span className="text-destructive">*</span>
                                        </Label>
                                        <Input
                                            id="price"
                                            type="number"
                                            step="0.01"
                                            min={isFreeShared ? "0" : "0.01"}
                                            {...register("price")}
                                            placeholder="0.00"
                                            disabled={isFreeShared}
                                        />
                                        {isFreeShared && (
                                            <p className="text-xs text-muted-foreground">免费共享商品价格固定为 0</p>
                                        )}
                                        {errors.price && (
                                            <p className="text-sm text-destructive">{errors.price.message}</p>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="maxQuantity">单笔最大购买数量</Label>
                                        <Input
                                            id="maxQuantity"
                                            type="number"
                                            min="1"
                                            max="1000"
                                            {...register("maxQuantity")}
                                            disabled={isFreeShared}
                                        />
                                        {errors.maxQuantity && (
                                            <p className="text-sm text-destructive">{errors.maxQuantity.message}</p>
                                        )}
                                        <p className="text-xs text-muted-foreground">
                                            {isFreeShared ? "免费共享每次仅可领取 1 个" : "单笔订单最多可购买的数量"}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="w-full">
                            <CardHeader>
                                <CardTitle>商品简介</CardTitle>
                                <p className="text-sm font-normal text-muted-foreground">用于首页商品卡片下方展示，建议 1～2 句；留空则使用商品描述前 80 字</p>
                            </CardHeader>
                            <CardContent>
                                <Input
                                    {...register("summary")}
                                    placeholder="简短介绍商品，最多 300 字"
                                    maxLength={300}
                                    className="w-full"
                                />
                                {errors.summary && (
                                    <p className="mt-2 text-sm text-destructive">{errors.summary.message}</p>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="w-full">
                            <CardHeader>
                                <CardTitle>商品描述</CardTitle>
                                <p className="text-sm font-normal text-muted-foreground">支持 Markdown，用于商品详情页展示</p>
                            </CardHeader>
                            <CardContent>
                                <Controller
                                    name="description"
                                    control={control}
                                    render={({ field }) => (
                                        <MarkdownEditor
                                            value={field.value ?? ""}
                                            onChange={field.onChange}
                                            placeholder="描述你的商品，支持 Markdown…"
                                            height={480}
                                        />
                                    )}
                                />
                                {errors.description && (
                                    <p className="mt-2 text-sm text-destructive">{errors.description.message}</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <div className="space-y-6 lg:sticky lg:top-20 lg:self-start">
                        <Card>
                            <CardHeader>
                                <CardTitle>状态</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label htmlFor="status">已上架</Label>
                                        <p className="text-xs text-muted-foreground">
                                            {isActive ? "商品对买家可见" : "商品对买家隐藏"}
                                        </p>
                                    </div>
                                    <Switch
                                        id="status"
                                        checked={isActive}
                                        onCheckedChange={(v) => setValue("isActive", v)}
                                    />
                                </div>
                            </CardContent>
                        </Card>

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
                                                        checked={(tagIds as string[]).includes(tag.id)}
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
                                                    onClick={(e) => handleDeleteTagClick(e, tag.id)}
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

                                {(tagIds as string[]).length > 0 && (
                                    <div className="flex flex-wrap gap-1 pt-2 border-t">
                                        {(tagIds as string[]).map((id) => {
                                            const tag = tags.find((t) => t.id === id)
                                            return tag ? (
                                                <Badge
                                                    key={id}
                                                    variant="secondary"
                                                    className="gap-1 pr-1"
                                                >
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
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <Button type="submit" disabled={form.formState.isSubmitting}>
                        {form.formState.isSubmitting && (
                            <Loader2 className="size-4 animate-spin" />
                        )}
                        {isEditing ? "保存修改" : "创建商品"}
                    </Button>
                    <Button type="button" variant="outline" asChild>
                        <Link href="/admin/products">取消</Link>
                    </Button>
                </div>
            </form>
        </div>
    )
}
