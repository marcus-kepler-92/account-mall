import { OrderCompletion } from "@/app/emails/order-completion";
import { sendMail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { render } from "@react-email/render";
import React from "react";

const BASE_URL =
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

/**
 * Send order completion email to customer with account/card info when order status becomes COMPLETED.
 * Call fire-and-forget (do not await). Does nothing if order not found or not COMPLETED.
 */
export async function sendOrderCompletionEmail(orderId: string): Promise<void> {
    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
            product: { select: { name: true } },
            cards: {
                where: { status: "SOLD" },
                select: { content: true },
            },
        },
    });

    if (!order || order.status !== "COMPLETED") {
        return;
    }

    const lookupUrl = `${BASE_URL}/orders/lookup`;

    const html = await render(
        React.createElement(OrderCompletion, {
            orderNo: order.orderNo,
            productName: order.product.name,
            quantity: order.quantity,
            cards: order.cards.map((c) => ({ content: c.content })),
            lookupUrl,
        }),
    );

    const result = await sendMail({
        to: order.email,
        subject: "[Account Mall] 订单已完成：您的账号信息",
        html,
    });

    if (!result.success) {
        console.error("[order-completion-email] Send failed", {
            orderId,
            orderNo: order.orderNo,
            error: result.error,
        });
    }
}
