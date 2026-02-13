import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

const FROM_EMAIL =
    process.env.EMAIL_FROM ?? "Account Mall <onboarding@resend.dev>";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";

export type SendMailOptions = {
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
};

/**
 * Send email via Resend. No-op when RESEND_API_KEY is not configured.
 */
export async function sendMail({
    to,
    subject,
    html,
    text,
}: SendMailOptions): Promise<{ success: boolean; error?: string }> {
    if (!resend) {
        console.warn("[email] RESEND_API_KEY not set, skipping send");
        return { success: true };
    }

    const toList = Array.isArray(to) ? to : [to];
    if (toList.length === 0) return { success: false, error: "No recipients" };

    const { error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: toList,
        subject,
        html: html ?? text ?? "",
        text: text ?? undefined,
    });

    if (error) {
        console.error("[email] Send failed:", error);
        return { success: false, error: String(error) };
    }
    return { success: true };
}

/**
 * Get admin email for restock notifications. Empty when not configured.
 */
export function getAdminEmail(): string {
    return ADMIN_EMAIL.trim();
}
