import {
    Body,
    Button,
    Container,
    Head,
    Heading,
    Hr,
    Html,
    Preview,
    Section,
    Text,
} from "@react-email/components";
import * as React from "react";
import {
    BRAND_NAME,
    button,
    container,
    divider,
    footer,
    heading,
    main,
    text,
    textMuted,
    headerBrand,
} from "./theme";

export interface OrderCompletionProps {
    orderNo: string;
    productName: string;
    quantity: number;
    cards: { content: string }[];
    lookupUrl?: string;
}

const cardBlock = {
    backgroundColor: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "6px",
    padding: "12px 16px",
    margin: "0 0 8px",
    fontFamily: "ui-monospace, monospace",
    fontSize: "14px",
    lineHeight: "20px",
    color: "#1e293b",
    wordBreak: "break-all" as const,
};

export function OrderCompletion({
    orderNo,
    productName,
    quantity,
    cards,
    lookupUrl,
}: OrderCompletionProps) {
    return (
        <Html lang="zh-CN">
            <Head />
            <Preview>您的订单已发货，账号信息见邮件</Preview>
            <Body style={main}>
                <Container style={container}>
                    <Section style={{ margin: "0 0 24px" }}>
                        <Text style={headerBrand}>{BRAND_NAME}</Text>
                    </Section>

                    <Section style={{ margin: "0 0 24px" }}>
                        <Heading style={heading}>订单已完成</Heading>
                        <Text style={text}>
                            您的订单已支付完成，账号/卡密信息如下，请妥善保管。
                        </Text>
                        <Text style={text}>
                            订单号：<strong>{orderNo}</strong>
                        </Text>
                        <Text style={text}>
                            商品：<strong>{productName}</strong> × {quantity}
                        </Text>
                    </Section>

                    <Section style={{ margin: "0 0 24px" }}>
                        <Text style={{ ...text, marginBottom: "8px" }}>账号/卡密：</Text>
                        {cards.map((card, index) => (
                            <Section key={index} style={cardBlock}>
                                <Text style={{ margin: 0 }}>{card.content}</Text>
                            </Section>
                        ))}
                    </Section>

                    {lookupUrl && (
                        <Section style={{ margin: "0 0 24px" }}>
                            <Button href={lookupUrl} style={button}>
                                查看订单
                            </Button>
                        </Section>
                    )}

                    <Hr style={divider} />
                    <Section>
                        <Text style={footer}>{BRAND_NAME} · 订单通知</Text>
                    </Section>
                </Container>
            </Body>
        </Html>
    );
}

export default OrderCompletion;
