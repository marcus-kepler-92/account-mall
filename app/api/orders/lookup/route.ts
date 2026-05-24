import { NextRequest, NextResponse } from "next/server";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
    publicOrderLookupSchema,
    orderStatusSchema,
} from "@/lib/validations/order";
import type { z } from "zod";
import { verifyPassword } from "better-auth/crypto";
import { createOrderSuccessToken } from "@/lib/order-success-token";
import { checkOrderQueryRateLimit } from "@/lib/rate-limit";
import {
    invalidJsonBody,
    validationError,
    badRequest,
    internalServerError,
} from "@/lib/api-response";
import { config } from "@/lib/config";
import { parseAutoFetchCardContent } from "@/lib/auto-fetch-card";
import { getSiteSettings } from "@/lib/site-settings";
import { isWithinBusinessHours, formatEtaText } from "@/lib/business-hours";

type LookupBody = z.infer<typeof publicOrderLookupSchema>;
type OrderStatus = z.infer<typeof orderStatusSchema>;

type TransactionClient = Omit<
    PrismaClient,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

interface LookupResponseBase {
    orderNo: string;
    productName: string;
    createdAt: Date;
    status: OrderStatus;
    amount: number;
}

interface LookupResponsePending extends LookupResponseBase {
    cards: [];
    isPending: true;
    /** 未超时且可继续支付时为 true */
    canPay: boolean;
    /** 支付截止时间（ISO），便于前端展示「请在 xx 前完成支付」 */
    expiresAt?: string;
}

/**
 * MANUAL 中间态（AWAITING_FULFILLMENT / PROCESSING）：未发货时仅有产品/订单元信息，
 * 不包含 cards 与 fulfillment.content。前端据此渲染等待时间线 + 催发货控件。
 *
 * `id` and `email` are exposed (in addition to the password the buyer enters in
 * the form) so the buyer-facing 催发货 button can call POST /api/orders/[id]/dun
 * with the full lookup-credential triple. `etaText` is precomputed server-side
 * with the runtime business-hours window — client must NOT import business-hours.
 */
interface LookupResponseProcessing extends LookupResponseBase {
    id: string;
    email: string;
    productType: "MANUAL";
    cards: [];
    fulfillment: null;
    variantName: string | null;
    dunCount: number;
    lastDunAt: string | null;
    etaText: string;
    /** SiteSettings.dunMinAgeMinutes in seconds — used by the dun button countdown. */
    dunMinAgeSeconds: number;
    /** Seconds since order was created — used by the dun button initial countdown. */
    orderAgeSeconds: number;
    /** Remaining cooldown seconds based on lastDunAt + dunCooldownMinutes. */
    initialCooldownSeconds: number;
}

/** 卡密：普通为 content；AUTO_FETCH 为 content(JSON) + account/password/region/lastCheckedAt */
interface LookupResponseCompleted extends LookupResponseBase {
    productType: "NORMAL" | "AUTO_FETCH" | "MANUAL";
    cards: Array<
        | { content: string }
        | {
              content: string;
              account: string;
              password: string;
              region: string;
              lastCheckedAt?: string;
          }
    >;
    /** MANUAL only — admin-delivered fulfillment text. null for NORMAL/AUTO_FETCH. */
    fulfillment: { content: string } | null;
    /** MANUAL only — snapshot of variant name. null for NORMAL/AUTO_FETCH. */
    variantName: string | null;
    /** MANUAL only — buyer "催发货" count (always present, defaults to 0). */
    dunCount: number;
    /** MANUAL only — last "催发货" timestamp ISO; null when no dun fired. */
    lastDunAt: string | null;
    cardTemplates: { template: string }[];
    successToken?: string;
    /** AUTO_FETCH 订单的账号有效期 */
    contentExpiresAt?: string;
    isAutoFetch?: boolean;
    /** AUTO_FETCH：用户是否可以使用一次性换号机会 */
    canSwitch?: boolean;
    /** AUTO_FETCH：剩余换号次数 */
    remainingSwitches?: number;
}

/**
 * POST /api/orders/lookup
 * Public: users can query order details and cards by orderNo + password.
 */
export async function POST(request: NextRequest) {
    const rateLimitRes = await checkOrderQueryRateLimit(request);
    if (rateLimitRes) return rateLimitRes;

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return invalidJsonBody();
    }

    const parsed = publicOrderLookupSchema.safeParse(body);
    if (!parsed.success) {
        // Public endpoint: avoid exposing detailed validation errors.
        return validationError();
    }

    const { orderNo, password }: LookupBody = parsed.data;

    try {
        const order = await prisma.$transaction(async (tx: TransactionClient) => {
            const existing = await tx.order.findUnique({
                where: { orderNo: orderNo.trim() },
                include: {
                    product: {
                        select: {
                            name: true,
                            productType: true,
                            allowAccountSwitch: true,
                            accountSwitchLimit: true,
                            cardTemplates: {
                                orderBy: { sortOrder: "asc" as const },
                                select: { template: true },
                            },
                        },
                    },
                    cards: {
                        select: {
                            id: true,
                            content: true,
                            status: true,
                        },
                    },
                    fulfillment: {
                        select: { content: true },
                    },
                },
            });

            if (!existing) {
                throw new Error("LOOKUP_FAILED");
            }

            // verifyPassword signature: verifyPassword({ hash, password })
            const passwordOk = await verifyPassword({
                hash: existing.passwordHash,
                password: password.trim(),
            });
            if (!passwordOk) {
                throw new Error("LOOKUP_FAILED");
            }

            return existing;
        });

        // For PENDING orders, return order info without cards + canPay/expiresAt
        if (order.status === "PENDING") {
            const elapsed = Date.now() - order.createdAt.getTime();
            const canPay = elapsed < config.pendingOrderTimeoutMs;
            const expiresAt = new Date(
                order.createdAt.getTime() + config.pendingOrderTimeoutMs,
            ).toISOString();
            const payload: LookupResponsePending = {
                orderNo: order.orderNo,
                productName: order.productNameSnapshot ?? order.product.name,
                createdAt: order.createdAt,
                status: order.status,
                amount: Number(order.amount),
                cards: [],
                isPending: true,
                canPay,
                expiresAt,
            };
            return NextResponse.json(payload);
        }

        // MANUAL intermediate states (paid but not yet fulfilled). cards/fulfillment empty;
        // frontend renders waiting timeline + dun controls based on these fields.
        if (
            order.status === "AWAITING_FULFILLMENT" ||
            order.status === "PROCESSING"
        ) {
            const settings = await getSiteSettings();
            const cfg = {
                start: settings.businessHoursStart,
                end: settings.businessHoursEnd,
                weekdays: settings.businessHoursWeekdays,
                timezone: settings.businessHoursTimezone,
            };
            const now = new Date();
            const etaText = isWithinBusinessHours(now, cfg)
                ? "卖家通常在 15 分钟内发货"
                : formatEtaText(now, cfg);
            const orderAgeSeconds = Math.floor((now.getTime() - order.createdAt.getTime()) / 1000);
            const dunMinAgeSeconds = settings.dunMinAgeMinutes * 60;
            const cooldownMs = settings.dunCooldownMinutes * 60_000;
            const initialCooldownSeconds = order.lastDunAt
                ? Math.max(
                      0,
                      Math.ceil((order.lastDunAt.getTime() + cooldownMs - now.getTime()) / 1000),
                  )
                : 0;
            const payload: LookupResponseProcessing = {
                id: order.id,
                email: order.email,
                orderNo: order.orderNo,
                productName: order.productNameSnapshot ?? order.product.name,
                createdAt: order.createdAt,
                status: order.status,
                amount: Number(order.amount),
                productType: "MANUAL",
                cards: [],
                fulfillment: null,
                variantName: order.variantNameSnapshot,
                dunCount: order.dunCount,
                lastDunAt: order.lastDunAt?.toISOString() ?? null,
                etaText,
                dunMinAgeSeconds,
                orderAgeSeconds,
                initialCooldownSeconds,
            };
            return NextResponse.json(payload);
        }

        // For COMPLETED/CLOSED orders, return cards (NORMAL/AUTO_FETCH) or fulfillment (MANUAL)
        // and optional successToken for redirect to success page.
        const isManual = order.product.productType === "MANUAL";
        type CardRow = { content: string; status: string };
        const cards = isManual
            ? []
            : (order.cards as CardRow[])
                  .filter(
                      (card: CardRow) =>
                          card.status === "SOLD" || card.status === "RESERVED",
                  )
                  .map((card: CardRow) => {
                      const payload = parseAutoFetchCardContent(card.content);
                      if (payload) {
                          return { content: card.content, ...payload };
                      }
                      return { content: card.content };
                  });

        const successToken = createOrderSuccessToken(order.orderNo);
        const isAutoFetch = order.product.productType === "AUTO_FETCH";
        const switchLimit = order.product.accountSwitchLimit ?? 1;
        const remainingSwitches = Math.max(
            0,
            switchLimit - order.switchAccountCount,
        );
        const canSwitch =
            isAutoFetch &&
            order.status === "COMPLETED" &&
            (order.product.allowAccountSwitch ?? true) &&
            remainingSwitches > 0 &&
            (!order.expiresAt || order.expiresAt > new Date());
        const payload: LookupResponseCompleted = {
            orderNo: order.orderNo,
            productName: order.productNameSnapshot ?? order.product.name,
            createdAt: order.createdAt,
            status: order.status,
            amount: Number(order.amount),
            productType: order.product.productType,
            cards,
            fulfillment: isManual ? order.fulfillment : null,
            variantName: order.variantNameSnapshot,
            dunCount: order.dunCount,
            lastDunAt: order.lastDunAt?.toISOString() ?? null,
            cardTemplates: order.product.cardTemplates,
            ...(successToken && { successToken }),
            ...(isAutoFetch && { isAutoFetch: true }),
            ...(isAutoFetch &&
                order.expiresAt && { contentExpiresAt: order.expiresAt.toISOString() }),
            ...(isAutoFetch && { canSwitch }),
            ...(isAutoFetch && { remainingSwitches }),
        };
        return NextResponse.json(payload);
    } catch (error) {
        if (error instanceof Error && error.message === "LOOKUP_FAILED") {
            return badRequest("Order not found or password incorrect");
        }

        return internalServerError();
    }
}

export const runtime = "nodejs";
