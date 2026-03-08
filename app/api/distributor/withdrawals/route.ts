import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getDistributorSession } from "@/lib/auth-guard"
import { unauthorized } from "@/lib/api-response"
import { checkWithdrawalCreateRateLimit } from "@/lib/rate-limit"
import { uploadBinary, DEFAULT_MAX_BYTES } from "@/lib/upload"

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const

export async function GET(request: NextRequest) {
    const session = await getDistributorSession()
    if (!session) return unauthorized()

    const user = session.user as { id: string }
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10))
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)))

    const [withdrawals, total] = await Promise.all([
        prisma.withdrawal.findMany({
            where: { distributorId: user.id },
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
        prisma.withdrawal.count({ where: { distributorId: user.id } }),
    ])

    return NextResponse.json({
        data: withdrawals.map((w) => ({
            id: w.id,
            amount: Number(w.amount),
            status: w.status,
            receiptImageUrl: w.receiptImageUrl,
            note: w.note,
            processedAt: w.processedAt,
            createdAt: w.createdAt,
        })),
        meta: {
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize) || 1,
        },
    })
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

    let withdrawal: { id: string; amount: { toNumber?: () => number }; status: string; receiptImageUrl: string | null; createdAt: Date }
    try {
        withdrawal = await prisma.$transaction(async (tx) => {
            const [settledSum, paidSum, pendingSum] = await Promise.all([
                tx.commission.aggregate({
                    where: { distributorId: user.id, status: "SETTLED" },
                    _sum: { amount: true },
                }),
                tx.withdrawal.aggregate({
                    where: { distributorId: user.id, status: "PAID" },
                    _sum: { amount: true },
                }),
                tx.withdrawal.aggregate({
                    where: { distributorId: user.id, status: "PENDING" },
                    _sum: { amount: true },
                }),
            ])
            const withdrawableBalance =
                Number(settledSum._sum.amount ?? 0) -
                Number(paidSum._sum.amount ?? 0) -
                Number(pendingSum._sum.amount ?? 0)
            if (amount > withdrawableBalance) {
                throw new Error("WITHDRAWAL_OVER_BALANCE")
            }
            return tx.withdrawal.create({
                data: {
                    distributorId: user.id,
                    amount,
                    status: "PENDING",
                    receiptImageUrl,
                },
            })
        })
    } catch (err) {
        if (err instanceof Error && err.message === "WITHDRAWAL_OVER_BALANCE") {
            return NextResponse.json(
                { error: "提现金额不能超过可提现余额", fieldErrors: { amount: ["超额"] } },
                { status: 400 }
            )
        }
        throw err
    }

    return NextResponse.json(
        {
            id: withdrawal.id,
            amount: Number(withdrawal.amount),
            status: withdrawal.status,
            receiptImageUrl: withdrawal.receiptImageUrl,
            createdAt: withdrawal.createdAt,
        },
        { status: 201 }
    )
}
