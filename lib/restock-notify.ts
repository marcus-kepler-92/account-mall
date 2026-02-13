import { prisma } from "@/lib/prisma";
import { sendMail, getAdminEmail } from "@/lib/email";

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
 * Send restock notification emails to subscribers and admin when stock goes 0 -> >0.
 * Called after cards are added to a product that had zero stock.
 */
export async function notifyRestockSubscribers(product: ProductInfo): Promise<void> {
    const subscriptions = await prisma.restockSubscription.findMany({
        where: {
            productId: product.id,
            status: "PENDING",
        },
        select: { id: true, email: true },
    });

    if (subscriptions.length === 0) return;

    const price = product.price;
    const productUrl = `${BASE_URL}/products/${product.id}-${product.slug}`;

    const userSubject = "[Account Mall] 你关注的商品已补货";
    const userHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.6; color: #333;">
  <h2>你关注的商品已补货</h2>
  <p>你好，</p>
  <p>你曾订阅补货提醒的商品 <strong>${escapeHtml(product.name)}</strong> 现已到货。</p>
  <p>价格：¥${price.toFixed(2)}</p>
  <p><a href="${escapeHtml(productUrl)}" style="display: inline-block; padding: 8px 16px; background: #0ea5e9; color: white; text-decoration: none; border-radius: 6px;">立即查看</a></p>
  <p style="color: #666; font-size: 14px;">库存有限，请尽快下单。</p>
  <hr style="margin: 24px 0; border: none; border-top: 1px solid #eee;">
  <p style="font-size: 12px; color: #999;">Account Mall · 补货提醒</p>
</body>
</html>`;

    const sentIds: string[] = [];
    for (const sub of subscriptions) {
        const result = await sendMail({
            to: sub.email,
            subject: userSubject,
            html: userHtml,
        });
        if (result.success) {
            sentIds.push(sub.id);
        }
    }

    const now = new Date();
    if (sentIds.length > 0) {
        await prisma.restockSubscription.updateMany({
            where: { id: { in: sentIds } },
            data: { status: "NOTIFIED", notifiedAt: now },
        });
    }

    const adminEmail = getAdminEmail();
    if (adminEmail) {
        const adminSubject = `[Account Mall] 商品补货通知：${product.name}`;
        const adminHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.6; color: #333;">
  <h2>商品补货通知</h2>
  <p>商品 <strong>${escapeHtml(product.name)}</strong> 已补货。</p>
  <p>补货提醒订阅人数：${subscriptions.length}</p>
  <p>成功发送通知：${sentIds.length}</p>
  <p><a href="${escapeHtml(productUrl)}">查看商品</a></p>
</body>
</html>`;
        await sendMail({
            to: adminEmail,
            subject: adminSubject,
            html: adminHtml,
        });
    }
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
