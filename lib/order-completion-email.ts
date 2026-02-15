import { OrderCompletion } from "@/app/emails/order-completion";
import { sendMail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { render } from "@react-email/render";
import React from "react";

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

    const lookupUrl = `${config.siteUrl}/orders/lookup`;

    const html = await render(
        React.createElement(OrderCompletion, {
            orderNo: order.orderNo,
            productName: order.product.name,
            quantity: order.quantity,
            cards: order.cards.map((c) => ({ content: c.content })),
            lookupUrl,
            brandName: config.siteName,
        }),
    );

    const result = await sendMail({
        to: order.email,
        subject: `[${config.siteName}] 订单已完成：您的账号信息`,
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
