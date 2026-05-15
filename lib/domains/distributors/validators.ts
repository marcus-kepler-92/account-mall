// lib/domains/distributors/validators.ts
import * as z from "zod"
import { passwordSchema } from "@/lib/validations/auth"

// ── Distributor invite ────────────────────────────────────────────────────────
export const distributorInviteSchema = z.object({
  email: z
    .string()
    .email("请输入有效的邮箱地址")
    .transform((v) => v.toLowerCase().trim()),
})

export const acceptInviteSchema = z.object({
  token: z.string().min(1, "邀请 token 不能为空"),
  name: z.string().min(1, "请输入昵称").max(50, "昵称不能超过 50 字符"),
  password: passwordSchema,
})

export const usernameSchema = z
  .string()
  .min(6, "用户名至少 6 位")
  .max(30, "用户名不能超过 30 位")
  .regex(/^[a-zA-Z0-9_]+$/, "用户名只能包含字母、数字和下划线")
  .trim()
  .transform((v) => v.toLowerCase())

export const acceptNoEmailInviteSchema = acceptInviteSchema.extend({
  username: usernameSchema,
})

export const bindInviterSchema = z.object({
  inviteCode: z.string().min(1, "邀请码不能为空").max(256, "邀请码过长"),
})

// ── Admin distributor management ──────────────────────────────────────────────
export const updateDistributorSchema = z.object({
  disabled: z.boolean().optional(),
  discountCodeEnabled: z.boolean().optional(),
  discountPercent: z.number().min(0).max(100).nullable().optional(),
})

// ── Commission tiers ──────────────────────────────────────────────────────────
export const createTierSchema = z.object({
  minAmount: z.number().min(0),
  maxAmount: z.number().min(0),
  ratePercent: z.number().min(0).max(100),
  sortOrder: z.number().int().min(0).optional(),
})

export const updateTierSchema = z.object({
  minAmount: z.number().min(0).optional(),
  maxAmount: z.number().min(0).optional(),
  ratePercent: z.number().min(0).max(100).optional(),
  sortOrder: z.number().int().min(0).optional(),
})

// ── Withdrawals ───────────────────────────────────────────────────────────────
export const updateWithdrawalSchema = z.object({
  status: z.enum(["PAID", "REJECTED"]),
  note: z.string().optional(),
})

// ── Order distributor reassign ────────────────────────────────────────────────
export const reassignDistributorSchema = z.object({
  distributorId: z.string().nullable(),
})

// ── Inferred types ────────────────────────────────────────────────────────────
export type DistributorInviteInput = z.infer<typeof distributorInviteSchema>
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>
export type AcceptNoEmailInviteInput = z.infer<typeof acceptNoEmailInviteSchema>
export type BindInviterInput = z.infer<typeof bindInviterSchema>
export type UpdateDistributorInput = z.infer<typeof updateDistributorSchema>
export type CreateTierInput = z.infer<typeof createTierSchema>
export type UpdateTierInput = z.infer<typeof updateTierSchema>
export type UpdateWithdrawalInput = z.infer<typeof updateWithdrawalSchema>
export type ReassignDistributorInput = z.infer<typeof reassignDistributorSchema>

// ── Invitation milestones ─────────────────────────────────────────────────────
export const createMilestoneSchema = z.object({
  thresholdCount: z.number().int().min(1, "达标人数至少为 1"),
  thresholdAmount: z.number().positive("每人最低消费必须大于 0"),
  bonusAmount: z.number().positive("奖励金额必须大于 0"),
})

export const updateMilestoneSchema = z.object({
  thresholdCount: z.number().int().min(1, "达标人数至少为 1").optional(),
  thresholdAmount: z.number().positive("每人最低消费必须大于 0").optional(),
  bonusAmount: z.number().positive("奖励金额必须大于 0").optional(),
})

export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>
