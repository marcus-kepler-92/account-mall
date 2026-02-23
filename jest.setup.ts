// Global test setup
// Note: @testing-library/jest-dom will be imported in component test files
// that use jsdom environment (via docblock: @jest-environment jsdom)

// Suppress expected console output during tests (notify routes, orders-id, restock-notify, etc.)
const noop = () => {}
jest.spyOn(console, "log").mockImplementation(noop)
jest.spyOn(console, "warn").mockImplementation(noop)
jest.spyOn(console, "error").mockImplementation(noop)

// Minimal config mock so modules that call getConfig() at load time don't throw ZodError
jest.mock("@/lib/config", () => {
    const mock = {
        databaseUrl: "postgresql://localhost:5432/test",
        betterAuthSecret: "x".repeat(32),
        siteUrl: "http://localhost:3000",
        nodeEnv: "test" as const,
    }
    return { config: mock, getConfig: () => mock }
})
