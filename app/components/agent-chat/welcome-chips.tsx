"use client"

import { useThreadRuntime } from "@assistant-ui/react"

// Welcome chips reflect the four highest-frequency real customer questions
// across our three product lines (shared / dedicated / pre-purchased accounts).
// Each maps to a specific knowledge-base entry the AI should answer with.
const SUGGESTED = [
  "买的账号怎么登录？",
  "弹窗让我升级账号要选什么？",
  "怎么查询我的订单？",
  "独享号和共享号有什么区别？",
]

export function WelcomeChips() {
  const runtime = useThreadRuntime()
  return (
    <div className="flex flex-col items-start gap-3 px-4 py-6">
      <div className="rounded-2xl bg-muted px-4 py-3 text-sm">
        你好！我是 AI 客服，可以帮你查商品 / 订单 / 处理常见问题。我搞不定的，会主动帮你转接人工客服。下面是一些常问的：
      </div>
      <div className="flex flex-wrap gap-2">
        {SUGGESTED.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() =>
              runtime.append({
                role: "user",
                content: [{ type: "text", text: q }],
              })
            }
            className="rounded-full border bg-background px-3 py-2 text-sm transition hover:bg-muted md:py-1.5 md:text-xs"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  )
}
