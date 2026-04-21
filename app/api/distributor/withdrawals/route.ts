import { NextRequest, NextResponse } from "next/server"
import { getDistributorSession } from "@/lib/auth-guard"
import { unauthorized } from "@/lib/api-response"
import { checkWithdrawalCreateRateLimit } from "@/lib/rate-limit"
import { uploadBinary, DEFAULT_MAX_BYTES } from "@/lib/upload"
import { config } from "@/lib/config"
import { listDistributorWithdrawals, createWithdrawal, WithdrawalOverBalanceError } from "@/lib/domains/distributors"

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const

export async function GET(request: NextRequest) {
  const session = await getDistributorSession()
  if (!session) return unauthorized()

  const user = session.user as { id: string }
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10))
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)))

  const result = await listDistributorWithdrawals(user.id, page, pageSize)
  return NextResponse.json(result)
}

export async function POST(request: NextRequest) {
  const session = await getDistributorSession()
  if (!session) return unauthorized()

  const user = session.user as { id: string }
  const rateLimitRes = await checkWithdrawalCreateRateLimit(user.id)
  if (rateLimitRes) return rateLimitRes

  const contentType = request.headers.get("content-type") ?? ""
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "请使用表单提交，并上传收款码图片" },
      { status: 400 }
    )
  }

  const formData = await request.formData()
  const amountStr = formData.get("amount")
  const file = formData.get("receiptImage") as File | null

  if (!amountStr || typeof amountStr !== "string") {
    return NextResponse.json({ error: "请填写提现金额" }, { status: 400 })
  }
  const amountRaw = parseFloat(amountStr)
  if (Number.isNaN(amountRaw) || amountRaw <= 0) {
    return NextResponse.json({ error: "提现金额必须大于 0" }, { status: 400 })
  }
  const amount = Math.round(amountRaw * 100) / 100
  if (amount < 0.01) {
    return NextResponse.json({ error: "提现金额至少 0.01 元" }, { status: 400 })
  }
  if (amount < config.withdrawalMinAmount) {
    return NextResponse.json({ error: `提现金额至少 ${config.withdrawalMinAmount} 元` }, { status: 400 })
  }

  if (!file || !(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "请上传收款码图片" }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
    return NextResponse.json(
      { error: "仅支持 JPG、PNG、WebP 图片，且不超过 4MB" },
      { status: 400 }
    )
  }
  if (file.size > DEFAULT_MAX_BYTES) {
    return NextResponse.json(
      { error: "图片大小不能超过 4MB" },
      { status: 400 }
    )
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const receiptImageUrl = await uploadBinary(buffer, {
    mimeType: file.type,
    pathPrefix: "receipts",
    cacheControlMaxAge: 365 * 24 * 60 * 60,
  })

  try {
    const withdrawal = await createWithdrawal(user.id, amount, config.withdrawalFeePercent, receiptImageUrl)
    return NextResponse.json(withdrawal, { status: 201 })
  } catch (err) {
    if (err instanceof WithdrawalOverBalanceError) {
      return NextResponse.json(
        { error: "提现金额不能超过可提现余额", fieldErrors: { amount: ["超额"] } },
        { status: 400 }
      )
    }
    throw err
  }
}
