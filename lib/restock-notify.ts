import { RestockNotifyUser } from "@/app/emails/restock-notify-user";
import { sendMail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { render } from "@react-email/render";
import React from "react";

const BASE_URL =
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

type ProductInfo = {
    id: string;
    name: string;
    slug: string;
    price: number;
};

/**
 * Send restock notification emails to subscribers when stock goes 0 -> >0.
 * Called after cards are added to a product that had zero stock.
 */
export async function notifyRestockSubscribers(product: ProductInfo): Promise<void> {
    console.log("[restock-notify] Start", { productId: product.id, productName: product.name });

    const subscriptions = await prisma.restockSubscription.findMany({
        where: {
            productId: product.id,
            status: "PENDING",
        },
        select: { id: true, email: true },
    });

    if (subscriptions.length === 0) {
        console.log("[restock-notify] No PENDING subscriptions, skip");
        return;
    }
    console.log("[restock-notify] Subscribers to notify", { count: subscriptions.length, productId: product.id });

    const price = product.price;
    const productUrl = `${BASE_URL}/products/${product.id}-${product.slug}`;

    const userSubject = "[Account Mall] 你关注的商品已补货";
    const userHtml = await render(
        React.createElement(RestockNotifyUser, {
            productName: product.name,
            price,
            productUrl,
        }),
    );

    const sentIds: string[] = [];
    for (const sub of subscriptions) {
        const result = await sendMail({
            to: sub.email,
            subject: userSubject,
            html: userHtml,
        });
        if (result.success) {
            sentIds.push(sub.id);
        } else {
            console.warn("[restock-notify] User email failed", { email: sub.email, error: result.error });
        }
    }

    const failedCount = subscriptions.length - sentIds.length;
    console.log("[restock-notify] User emails done", {
        productId: product.id,
        total: subscriptions.length,
        sent: sentIds.length,
        failed: failedCount,
    });

    const now = new Date();
    if (sentIds.length > 0) {
        const updateResult = await prisma.restockSubscription.updateMany({
            where: { id: { in: sentIds } },
            data: { status: "NOTIFIED", notifiedAt: now },
        });
        console.log("[restock-notify] Subscriptions marked NOTIFIED", {
            count: updateResult?.count ?? sentIds.length,
            productId: product.id,
        });
    }
    console.log("[restock-notify] Done", { productId: product.id });
}
