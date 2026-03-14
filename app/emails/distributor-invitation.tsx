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
} from "./theme";

export interface DistributorInvitationProps {
    inviterName: string;
    acceptUrl: string;
    brandName?: string;
    expiresInDays?: number;
}

export function DistributorInvitation({
    inviterName,
    acceptUrl,
    brandName = "Account Mall",
    expiresInDays = 7,
}: DistributorInvitationProps) {
    return (
        <Html lang="zh-CN">
            <Head />
            <Preview>{inviterName} 邀请您加入 {brandName} 分销中心</Preview>
            <Body style={main}>
                <Container style={container}>
                    <Section style={{ margin: "0 0 24px" }}>
                        <Text style={headerBrand}>{brandName}</Text>
                    </Section>

                    <Section style={{ margin: "0 0 24px" }}>
                        <Heading style={heading}>您收到一份分销邀请</Heading>
                        <Text style={text}>
                            <strong>{inviterName}</strong> 邀请您加入 {brandName} 分销中心，成为分销员后即可推广商品赚取佣金。
                        </Text>
                        <Text style={text}>
                            点击下方按钮设置登录密码，完成注册后即可开始推广。
                        </Text>
                    </Section>

                    <Section style={{ margin: "0 0 24px" }}>
                        <Button href={acceptUrl} style={button}>
                            接受邀请，设置密码
                        </Button>
                    </Section>

                    <Section style={{ margin: "0 0 24px" }}>
                        <Text style={textMuted}>
                            此邀请链接将在 {expiresInDays} 天后失效，请尽快完成注册。如非本人操作，请忽略此邮件。
                        </Text>
                    </Section>

                    <Hr style={divider} />
                    <Section>
                        <Text style={footer}>{brandName} · 分销中心邀请</Text>
                    </Section>
                </Container>
            </Body>
        </Html>
    );
}

export default DistributorInvitation;
