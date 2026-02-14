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
    priceBlock,
    priceText,
    text,
    textMuted,
    headerBrand,
} from "./theme";

export interface RestockNotifyUserProps {
    productName: string;
    price: number;
    productUrl: string;
}

export function RestockNotifyUser({ productName, price, productUrl }: RestockNotifyUserProps) {
    return (
        <Html lang="zh-CN">
            <Head />
            <Preview>你关注的商品已补货，点击查看</Preview>
            <Body style={main}>
                <Container style={container}>
                    <Section style={{ margin: "0 0 24px" }}>
                        <Text style={headerBrand}>{BRAND_NAME}</Text>
                    </Section>

                    <Section style={{ margin: "0 0 24px" }}>
                        <Heading style={heading}>你关注的商品已补货</Heading>
                        <Text style={text}>你好，</Text>
                        <Text style={text}>
                            你曾订阅补货提醒的商品 <strong>{productName}</strong> 现已到货。
                        </Text>
                    </Section>

                    <Section style={priceBlock}>
                        <Text style={priceText}>¥{price.toFixed(2)}</Text>
                    </Section>

                    <Section style={{ margin: "0 0 24px" }}>
                        <Button href={productUrl} style={button}>
                            立即查看
                        </Button>
                        <Text style={textMuted}>库存有限，请尽快下单。</Text>
                    </Section>

                    <Hr style={divider} />
                    <Section>
                        <Text style={footer}>{BRAND_NAME} · 补货提醒</Text>
                    </Section>
                </Container>
            </Body>
        </Html>
    );
}

export default RestockNotifyUser;
