"use client"

import { useState, useEffect } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { generateSlug } from "@/lib/utils"
import { RichTextEditor } from "@/app/components/rich-text-editor"
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
    image: string | null
    price: number
    maxQuantity: number
    status: string
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
    const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)

    const form = useForm<ProductFormSchema>({
        resolver: zodResolver(productFormSchema),
        defaultValues: {
            name: product?.name ?? "",
            slug: product?.slug ?? "",
            description: product?.description ?? "",
            image: product?.image ?? "",
            price: product ? String(product.price) : "",
            maxQuantity: product ? String(product.maxQuantity) : "10",
            isActive: product ? product.status === "ACTIVE" : true,
            tagIds: product?.tags.map((t) => t.id) ?? [],
        },
    })

    const { register, handleSubmit, formState: { errors }, watch, setValue, control } = form
    const name = watch("name")
    const slug = watch("slug")
    const imageValue = watch("image")
    const isActive = watch("isActive")
    const tagIds = watch("tagIds") ?? []

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
            image: data.image || null,
            price: parseFloat(data.price),
            maxQuantity: data.maxQuantity === "" ? 10 : parseInt(data.maxQuantity, 10),
            status: data.isActive ? "ACTIVE" : "INACTIVE",
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
                                    <Label htmlFor="description">描述</Label>
                                    <Controller
                                        name="description"
                                        control={control}
                                        render={({ field }) => (
                                            <RichTextEditor
                                                value={field.value ?? ""}
                                                onChange={field.onChange}
                                                placeholder="描述你的商品..."
                                            />
                                        )}
                                    />
                                    {errors.description && (
                                        <p className="text-sm text-destructive">{errors.description.message}</p>
                                    )}
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
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="price">
                                            价格 (¥) <span className="text-destructive">*</span>
                                        </Label>
                                        <Input
                                            id="price"
                                            type="number"
                                            step="0.01"
                                            min="0.01"
                                            {...register("price")}
                                            placeholder="0.00"
                                        />
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
                                        />
                                        {errors.maxQuantity && (
                                            <p className="text-sm text-destructive">{errors.maxQuantity.message}</p>
                                        )}
                                        <p className="text-xs text-muted-foreground">
                                            单笔订单最多可购买的数量
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="space-y-6">
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
                                            <label
                                                key={tag.id}
                                                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
                                            >
                                                <Checkbox
                                                    checked={(tagIds as string[]).includes(tag.id)}
                                                    onCheckedChange={() => toggleTag(tag.id)}
                                                />
                                                <span className="flex-1">{tag.name}</span>
                                            </label>
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
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleTag(id)}
                                                        className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                                                    >
                                                        <X className="size-3" />
                                                    </button>
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
