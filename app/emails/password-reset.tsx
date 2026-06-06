import * as React from "react";
import { BaseNotification } from "./base-notification";

export interface PasswordResetEmailProps {
    resetUrl: string;
    brandName?: string;
    expiresInMinutes?: number;
}

export function PasswordResetEmail({
    resetUrl,
    brandName = "Account Mall",
    expiresInMinutes = 60,
}: PasswordResetEmailProps) {
    return (
        <BaseNotification
            previewText="重置您的分销员账号密码"
            title="重置密码"
            brandName={brandName}
            footerLabel="分销中心"
            sections={[
                {
                    type: "text",
                    content:
                        "我们收到了您的密码重置请求。点击下方按钮设置新密码：",
                },
                { type: "cta", label: "重置密码", href: resetUrl },
                {
                    type: "note",
                    content: `该链接 ${expiresInMinutes} 分钟内有效。如果这不是您本人的操作，请忽略本邮件，您的密码不会被更改。`,
                },
            ]}
        />
    );
}

export default PasswordResetEmail;
