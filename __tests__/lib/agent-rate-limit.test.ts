describe("agent-rate-limit module", () => {
  afterEach(() => {
    jest.resetModules()
    jest.unmock("@/lib/config")
  })

  it("exports null when Upstash env is missing", async () => {
    jest.doMock("@/lib/config", () => ({
      config: { upstashRedisRestUrl: "", upstashRedisRestToken: "" },
    }))

    await jest.isolateModulesAsync(async () => {
      const mod = await import("@/lib/agent-rate-limit")
      expect(mod.redis).toBeNull()
      expect(mod.limiters).toBeNull()
    })
  })

  it("builds redis + 4 limiters when env is configured", async () => {
    jest.doMock("@/lib/config", () => ({
      config: {
        upstashRedisRestUrl: "https://test.upstash.io",
        upstashRedisRestToken: "test-token",
      },
    }))

    await jest.isolateModulesAsync(async () => {
      const mod = await import("@/lib/agent-rate-limit")
      expect(mod.redis).not.toBeNull()
      expect(mod.limiters).not.toBeNull()
      const keys = Object.keys(mod.limiters!).sort()
      expect(keys).toEqual(["chatFp", "chatIp", "chatSession", "csReverse"])
    })
  })
})
