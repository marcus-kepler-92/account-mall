"use client"

import { useState } from "react"
import { useFormContext } from "react-hook-form"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Loader2, Upload, Trash2 } from "lucide-react"
import type { ProductFormSchema } from "@/lib/validations/product"

export function ProductFormBasicFields({
    isEditing,
    onSlugManualEdit,
}: {
    isEditing: boolean
    onSlugManualEdit: () => void
}) {
    const { control, setValue } = useFormContext<ProductFormSchema>()
    const [imageUploading, setImageUploading] = useState(false)

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
        setImageUploading(true)
        try {
            const formData = new FormData()
            formData.append("file", file)
            const res = await fetch("/api/upload/image", {
                method: "POST",
                body: formData,
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                toast.error(data.error || "图片上传失败")
                return
            }
            const { url } = await res.json()
            if (url) setValue("image", url)
        } catch {
            toast.error("图片上传失败")
        } finally {
            setImageUploading(false)
            e.target.value = ""
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>基本信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <FormField
                    control={control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>
                                商品名称 <span className="text-destructive">*</span>
                            </FormLabel>
                            <FormControl>
                                <Input placeholder="例如：ChatGPT Plus 账号" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={control}
                    name="slug"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>
                                URL 别名 <span className="text-destructive">*</span>
                            </FormLabel>
                            <FormControl>
                                <Input
                                    placeholder="chatgpt-plus-account"
                                    {...field}
                                    onChange={(e) => {
                                        field.onChange(e)
                                        if (!isEditing) onSlugManualEdit()
                                    }}
                                />
                            </FormControl>
                            <FormDescription>用于商品 URL，仅支持小写字母、数字和连字符</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={control}
                    name="image"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>商品图片</FormLabel>
                            <div className="space-y-2">
                                {field.value ? (
                                    <div className="relative inline-block">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={field.value}
                                            alt="商品图片预览"
                                            className="h-50 w-50 rounded-md border object-cover"
                                        />
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            size="icon"
                                            className="absolute -right-2 -top-2 size-6"
                                            onClick={() => field.onChange("")}
                                        >
                                            <Trash2 className="size-3" />
                                        </Button>
                                    </div>
                                ) : (
                                    <label
                                        htmlFor="image-upload"
                                        className={`flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed p-6 transition-colors hover:border-foreground/30 hover:bg-accent/50 ${imageUploading ? "pointer-events-none opacity-60" : ""}`}
                                    >
                                        {imageUploading ? (
                                            <Loader2 className="mb-2 size-6 animate-spin text-muted-foreground" />
                                        ) : (
                                            <Upload className="mb-2 size-6 text-muted-foreground" />
                                        )}
                                        <span className="text-sm text-muted-foreground">
                                            {imageUploading ? "上传中…" : "点击上传图片"}
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
                                    disabled={imageUploading}
                                    onChange={handleImageUpload}
                                />
                            </div>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </CardContent>
        </Card>
    )
}
