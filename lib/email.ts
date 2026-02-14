import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

const FROM_EMAIL =
    process.env.EMAIL_FROM ?? "Account Mall <onboarding@resend.dev>";

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
    const toList = Array.isArray(to) ? to : [to];
    if (toList.length === 0) {
        console.warn("[email] No recipients, skip send");
        return { success: false, error: "No recipients" };
    }

    if (!resend) {
        console.warn("[email] RESEND_API_KEY not set, skipping send", {
            to: toList,
            subject,
        });
        return { success: true };
    }

    console.log("[email] Sending", { to: toList, subject });
    const { error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: toList,
        subject,
        html: html ?? text ?? "",
        text: text ?? undefined,
    });

    if (error) {
        const errorStr = typeof error === "object" && error !== null && "message" in error
            ? String((error as { message?: unknown }).message)
            : typeof error === "object"
                ? JSON.stringify(error)
                : String(error);
        console.error("[email] Send failed", { to: toList, subject, error: errorStr });
        return { success: false, error: errorStr };
    }
    console.log("[email] Sent OK", { to: toList, subject });
    return { success: true };
}
