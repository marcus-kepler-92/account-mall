import { z } from "zod"

export const passwordSchema = z
  .string()
  .min(8, "密码至少 8 位")
  .max(128, "密码不能超过 128 位")

export const confirmPasswordRefine = {
  fn: (data: { password: string; confirmPassword: string }) =>
    data.password === data.confirmPassword,
  opts: { message: "两次密码不一致", path: ["confirmPassword"] },
}
