import * as React from "react";
import { BaseNotification } from "./base-notification";
import type { NotificationSection } from "./base-notification";

export interface OrderCompletionProps {
    orderNo: string;
    productName: string;
    quantity: number;
    cards: { content: string }[];
    lookupUrl?: string;
    brandName?: string;
}

export function OrderCompletion({
    orderNo,
    productName,
    quantity,
    cards,
    lookupUrl,
    brandName,
}: OrderCompletionProps) {
    const sections: NotificationSection[] = [
        { type: "text", content: "您的订单已支付完成，账号/卡密信息如下，请妥善保管。" },
        { type: "kv", label: "订单号", value: orderNo },
        { type: "kv", label: "商品", value: `${productName} × ${quantity}` },
        ...cards.map((c): NotificationSection => ({ type: "code", content: c.content })),
        ...(lookupUrl ? [{ type: "cta" as const, label: "查看订单", href: lookupUrl }] : []),
    ];

    return (
        <BaseNotification
            previewText="您的订单已发货，账号信息见邮件"
            title="订单已完成"
            sections={sections}
            footerLabel="订单通知"
            brandName={brandName}
        />
    );
}

export default OrderCompletion;
