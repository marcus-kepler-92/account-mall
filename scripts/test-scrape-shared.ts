/**
 * 本地测试：scrapeSharedAccounts(sourceUrl)
 * 运行: npx tsx scripts/test-scrape-shared.ts
 * 运行并保存 HTML 用于调试: npx tsx scripts/test-scrape-shared.ts --dump-html
 */
import { writeFileSync } from "fs"
import { scrapeSharedAccounts } from "../lib/scrape-shared-accounts"

const SOURCE_URL = "https://id.ali-door.top/share/yedamai"

async function main() {
    const dumpHtml = process.argv.includes("--dump-html")
    if (dumpHtml) {
        const res = await fetch(SOURCE_URL, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
        })
        const html = await res.text()
        writeFileSync("scripts/sample-share-page.html", html, "utf-8")
        console.log("Saved HTML to scripts/sample-share-page.html length:", html.length)
        return
    }
    console.log("Fetching:", SOURCE_URL)
    const list = await scrapeSharedAccounts(SOURCE_URL)
    console.log("Parsed count:", list.length)
    console.log(JSON.stringify(list, null, 2))
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
