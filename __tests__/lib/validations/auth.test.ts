import { passwordSchema } from "@/lib/validations/auth"

describe("passwordSchema", () => {
  it("accepts exactly 8 characters", () => {
    expect(passwordSchema.safeParse("12345678").success).toBe(true)
  })

  it("accepts exactly 128 characters", () => {
    expect(passwordSchema.safeParse("a".repeat(128)).success).toBe(true)
  })

  it("rejects 7 characters", () => {
    const result = passwordSchema.safeParse("1234567")
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("密码至少 8 位")
    }
  })

  it("rejects 129 characters", () => {
    const result = passwordSchema.safeParse("a".repeat(129))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("密码不能超过 128 位")
    }
  })

  it("rejects empty string", () => {
    expect(passwordSchema.safeParse("").success).toBe(false)
  })
})
