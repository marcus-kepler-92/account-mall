import * as React from "react";
import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from "@react-email/components";
import {
    button,
    container,
    divider,
    footer,
    heading,
    headerBrand,
    main,
    text,
} from "./theme";

export interface OrderCompletionProps {
    orderNo: string;
    productName: string;
    quantity: number;
    /**
     * Unified account content payload. For NORMAL/AUTO_FETCH orders, this is the concatenation
     * of all sold card contents (joined with blank line). For MANUAL orders, this is the
     * fulfillment text entered by the admin. Rendered with `whiteSpace: pre-wrap` so the
     * caller controls line breaks.
     */
    accountContent: string;
    lookupUrl?: string;
    brandName?: string;
}

const accountBlock = {
    backgroundColor: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "6px",
    padding: "12px 16px",
    margin: "0 0 8px",
    fontFamily: "ui-monospace, monospace",
    fontSize: "14px",
    lineHeight: "20px",
    color: "#1e293b",
    wordBreak: "break-word" as const,
};

export function OrderCompletion({
    orderNo,
    productName,
    quantity,
    accountContent,
    lookupUrl,
    brandName = "Account Mall",
}: OrderCompletionProps) {
    return (
        <Html lang="zh-CN">
            <Head />
            <Preview>您的订单已发货，账号信息见邮件</Preview>
            <Body style={main}>
                <Container style={container}>
                    <Section style={{ margin: "0 0 24px" }}>
                        <Text style={headerBrand}>{brandName}</Text>
                    </Section>

                    <Section style={{ margin: "0 0 8px" }}>
                        <Heading style={heading}>订单已完成</Heading>
                    </Section>

                    <Section style={{ margin: "0 0 4px" }}>
                        <Text style={text}>您的订单已支付完成，账号/卡密信息如下，请妥善保管。</Text>
                    </Section>

                    <Section style={{ margin: "0" }}>
                        <Text style={{ ...text, margin: "0 0 8px" }}>
                            订单号：<strong>{orderNo}</strong>
                        </Text>
                    </Section>

                    <Section style={{ margin: "0" }}>
                        <Text style={{ ...text, margin: "0 0 8px" }}>
                            商品：<strong>{productName} × {quantity}</strong>
                        </Text>
                    </Section>

                    <Section style={accountBlock}>
                        <Text style={{ margin: 0, whiteSpace: "pre-wrap" }}>{accountContent}</Text>
                    </Section>

                    {lookupUrl ? (
                        <Section style={{ margin: "16px 0 8px" }}>
                            <Button href={lookupUrl} style={button}>
                                查看订单
                            </Button>
                        </Section>
                    ) : null}

                    <Hr style={divider} />
                    <Section>
                        <Text style={footer}>
                            {brandName} · 订单通知
                        </Text>
                    </Section>
                </Container>
            </Body>
        </Html>
    );
}

export default OrderCompletion;
