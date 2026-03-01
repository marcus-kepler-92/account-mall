/**
 * 免费共享卡密：单一数据源类型与序列化/反序列化。
 * Card.content 存此处定义的 payload JSON；API 返回与前端展示共用此形状。
 */

import type { SharedAccount } from "@/lib/scrape-shared-accounts"

/** 前端/API 用的卡密 payload（不含 status，不对外展示） */
export interface FreeSharedCardPayload {
    account: string
    password: string
    region: string
    lastCheckedAt?: string
    installStatus?: string
}

/** 从爬虫结果转为卡密 payload（去掉 status） */
export function sharedAccountToCardPayload(account: SharedAccount): FreeSharedCardPayload {
    return {
        account: account.account,
        password: account.password,
        region: account.region,
        ...(account.lastCheckedAt && { lastCheckedAt: account.lastCheckedAt }),
        ...(account.installStatus && { installStatus: account.installStatus }),
    }
}

/** 序列化为 Card.content 的 JSON 字符串（存库用） */
export function toCardContentJson(payload: FreeSharedCardPayload): string {
    return JSON.stringify(payload)
}

/** 解析 Card.content：若为免费共享 JSON 则返回 payload，否则返回 null */
export function parseFreeSharedCardContent(content: string): FreeSharedCardPayload | null {
    try {
        const parsed = JSON.parse(content) as unknown
        if (
            parsed &&
            typeof parsed === "object" &&
            "account" in parsed &&
            "password" in parsed &&
            typeof (parsed as { account: unknown }).account === "string" &&
            typeof (parsed as { password: unknown }).password === "string"
        ) {
            const p = parsed as {
                account: string
                password: string
                region?: string
                lastCheckedAt?: string
                installStatus?: string
            }
            return {
                account: p.account,
                password: p.password,
                region: p.region ?? "未知",
                ...(p.lastCheckedAt && { lastCheckedAt: p.lastCheckedAt }),
                ...(p.installStatus && { installStatus: p.installStatus }),
            }
        }
    } catch {
        /* not JSON or invalid */
    }
    return null
}

/** 类型守卫：卡密项是否为免费共享（含 account/password） */
export function isFreeSharedCard(
    card: { content: string } | FreeSharedCardPayload
): card is FreeSharedCardPayload & { content?: string } {
    return "account" in card && "password" in card
}
