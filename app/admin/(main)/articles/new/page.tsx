import { ArticleForm } from "../article-form"
import { getArticleProductOptions } from "../article-product-options"

export const dynamic = "force-dynamic"

export default async function AdminNewArticlePage() {
    const products = await getArticleProductOptions()
    return <ArticleForm products={products} />
}
