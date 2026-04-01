import * as React from "react";
import { BaseNotification } from "./base-notification";
import type { NotificationSection } from "./base-notification";

export interface DistributorInvitationProps {
    inviterName: string;
    acceptUrl: string;
    brandName?: string;
    expiresInDays?: number;
}

export function DistributorInvitation({
    inviterName,
    acceptUrl,
    brandName,
    expiresInDays = 7,
}: DistributorInvitationProps) {
    const sections: NotificationSection[] = [
        { type: "text", content: `${inviterName} 邀请您加入分销中心，成为分销员后即可推广商品赚取佣金。` },
        { type: "text", content: "点击下方按钮设置登录密码，完成注册后即可开始推广。" },
        { type: "cta", label: "接受邀请，设置密码", href: acceptUrl },
        { type: "note", content: `此邀请链接将在 ${expiresInDays} 天后失效，请尽快完成注册。如非本人操作，请忽略此邮件。` },
    ];

    return (
        <BaseNotification
            previewText={`${inviterName} 邀请您加入分销中心`}
            title="您收到一份分销邀请"
            sections={sections}
            footerLabel="分销中心邀请"
            brandName={brandName}
        />
    );
}

export default DistributorInvitation;
