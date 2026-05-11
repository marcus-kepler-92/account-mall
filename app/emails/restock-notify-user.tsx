import * as React from "react";
import { BaseNotification } from "./base-notification";
import type { NotificationSection } from "./base-notification";

export interface RestockNotifyUserProps {
    productName: string;
    price: number;
    productUrl: string;
    brandName?: string;
}

export function RestockNotifyUser({
    productName,
    price,
    productUrl,
    brandName,
}: RestockNotifyUserProps) {
    const sections: NotificationSection[] = [
        { type: "text", content: "你好，" },
        { type: "text", content: `你催货的 ${productName} 现已到货。` },
        { type: "price", value: `¥${price.toFixed(2)}` },
        { type: "cta", label: "立即查看", href: productUrl },
        { type: "note", content: "库存有限，请尽快下单。" },
    ];

    return (
        <BaseNotification
            previewText="你催货的商品已到货，点击查看"
            title="你催货的商品已到货"
            sections={sections}
            footerLabel="催货通知"
            brandName={brandName}
        />
    );
}

export default RestockNotifyUser;
