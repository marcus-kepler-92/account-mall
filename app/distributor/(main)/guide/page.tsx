import { redirect } from "next/navigation"
import Link from "next/link"
import { getDistributorSession } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { GuideMarkdownView } from "@/app/components/guide-markdown-view"

export const dynamic = "force-dynamic"

type PageProps = {
    searchParams: Promise<{ tagId?: string }>
}

export default async function DistributorGuidePage({ searchParams }: PageProps) {
    const session = await getDistributorSession()
    if (!session) redirect("/distributor/login")

    const { tagId } = await searchParams

    const [guides, tagsWithPublishedGuides] = await Promise.all([
        prisma.distributorGuide.findMany({
            where: {
                status: "PUBLISHED",
                ...(tagId && tagId.trim() !== "" ? { tagId: tagId.trim() } : {}),
            },
            orderBy: [
                { sortOrder: "desc" },
                { publishedAt: "desc" },
                { createdAt: "desc" },
            ],
            include: {
                tag: { select: { id: true, name: true, slug: true } },
            },
        }),
        prisma.tag.findMany({
            where: {
                guides: {
                    some: { status: "PUBLISHED" },
                },
            },
            orderBy: { name: "asc" },
            select: { id: true, name: true, slug: true },
        }),
    ])

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                    入门手册
                </h1>
                <p className="text-muted-foreground">
                    商品上架、描述模板、话术与引流文案，可直接复制使用
                </p>
            </div>

            {/* 类目筛选 */}
            <div className="flex flex-wrap items-center gap-2">
                <Link
                    href="/distributor/guide"
                    className={!tagId ? "inline-flex" : ""}
                >
                    <Badge
                        variant={!tagId ? "default" : "secondary"}
                        className="cursor-pointer hover:opacity-90"
                        asChild={false}
                    >
                        全部
                    </Badge>
                </Link>
                {tagsWithPublishedGuides.map((tag) => (
                    <Link
                        key={tag.id}
                        href={`/distributor/guide?tagId=${encodeURIComponent(tag.id)}`}
                    >
                        <Badge
                            variant={tagId === tag.id ? "default" : "secondary"}
                            className="cursor-pointer hover:opacity-90"
                            asChild={false}
                        >
                            {tag.name}
                        </Badge>
                    </Link>
                ))}
            </div>

            {/* 指南列表 */}
            <div className="space-y-6">
                {guides.length === 0 ? (
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                            暂无指南，请稍后再看。
                        </CardContent>
                    </Card>
                ) : (
                    guides.map((guide) => (
                        <Card key={guide.id}>
                            <CardHeader>
                                <CardTitle className="text-lg">{guide.title}</CardTitle>
                                {guide.tag && (
                                    <Badge variant="outline" className="w-fit">
                                        {guide.tag.name}
                                    </Badge>
                                )}
                            </CardHeader>
                            <CardContent>
                                <GuideMarkdownView content={guide.content ?? ""} />
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    )
}
