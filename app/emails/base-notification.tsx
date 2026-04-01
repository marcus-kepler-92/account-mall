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
    button,
    container,
    divider,
    footer,
    heading,
    headerBrand,
    main,
    text,
    textMuted,
    priceBlock,
    priceText,
} from "./theme";

export type NotificationSection =
    | { type: "text"; content: string }
    | { type: "note"; content: string }
    | { type: "kv"; label: string; value: string }
    | { type: "code"; content: string }
    | { type: "price"; value: string }
    | { type: "cta"; label: string; href: string }

export interface BaseNotificationProps {
    previewText: string
    title: string
    sections: NotificationSection[]
    footerLabel?: string
    brandName?: string
}

const codeBlock = {
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

export function BaseNotification({
    previewText,
    title,
    sections,
    footerLabel,
    brandName = "Account Mall",
}: BaseNotificationProps) {
    return (
        <Html lang="zh-CN">
            <Head />
            <Preview>{previewText}</Preview>
            <Body style={main}>
                <Container style={container}>
                    <Section style={{ margin: "0 0 24px" }}>
                        <Text style={headerBrand}>{brandName}</Text>
                    </Section>

                    <Section style={{ margin: "0 0 8px" }}>
                        <Heading style={heading}>{title}</Heading>
                    </Section>

                    {sections.map((section, i) => {
                        switch (section.type) {
                            case "text":
                                return (
                                    <Section key={i} style={{ margin: "0 0 4px" }}>
                                        <Text style={text}>{section.content}</Text>
                                    </Section>
                                )
                            case "note":
                                return (
                                    <Section key={i} style={{ margin: "0 0 4px" }}>
                                        <Text style={textMuted}>{section.content}</Text>
                                    </Section>
                                )
                            case "kv":
                                return (
                                    <Section key={i} style={{ margin: "0" }}>
                                        <Text style={{ ...text, margin: "0 0 8px" }}>
                                            {section.label}：<strong>{section.value}</strong>
                                        </Text>
                                    </Section>
                                )
                            case "code":
                                return (
                                    <Section key={i} style={codeBlock}>
                                        <Text style={{ margin: 0 }}>{section.content}</Text>
                                    </Section>
                                )
                            case "price":
                                return (
                                    <Section key={i} style={{ ...priceBlock, margin: "0 0 24px" }}>
                                        <Text style={priceText}>{section.value}</Text>
                                    </Section>
                                )
                            case "cta":
                                return (
                                    <Section key={i} style={{ margin: "16px 0 8px" }}>
                                        <Button href={section.href} style={button}>
                                            {section.label}
                                        </Button>
                                    </Section>
                                )
                        }
                    })}

                    <Hr style={divider} />
                    <Section>
                        <Text style={footer}>
                            {brandName}{footerLabel ? ` · ${footerLabel}` : ""}
                        </Text>
                    </Section>
                </Container>
            </Body>
        </Html>
    );
}

export default BaseNotification;
