import { buildArticleDescription, buildArticleTitle } from "@/lib/article-seo"

describe("buildArticleTitle", () => {
    it("prefers the SEO title and falls back to the title", () => {
        expect(buildArticleTitle({ seoTitle: " 美区Apple ID注册 ", title: "T" })).toBe("美区Apple ID注册")
        expect(buildArticleTitle({ seoTitle: "  ", title: "T" })).toBe("T")
        expect(buildArticleTitle({ seoTitle: null, title: "T" })).toBe("T")
    })
})

describe("buildArticleDescription", () => {
    it("uses SEO description, then summary, then body text, then title", () => {
        expect(buildArticleDescription({ seoDescription: "seo", summary: "s", title: "T" })).toBe("seo")
        expect(buildArticleDescription({ seoDescription: "", summary: "s", title: "T" })).toBe("s")
        expect(
            buildArticleDescription({
                summary: null,
                content: "## 第一步\n\n打开 **App Store**，点击[右上角头像](/x)。",
                title: "T",
            }),
        ).toBe("第一步 打开 App Store，点击右上角头像。")
        expect(buildArticleDescription({ content: "", title: "T" })).toBe("T")
    })

    it("truncates to 160 characters", () => {
        const long = "字".repeat(300)
        expect(buildArticleDescription({ summary: long, title: "T" })).toHaveLength(160)
        expect(buildArticleDescription({ content: long, title: "T" })).toHaveLength(160)
    })
})
