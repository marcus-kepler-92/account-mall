import nextJest from "next/jest.js"

const createJestConfig = nextJest({ dir: "./" })

const config = {
  testEnvironment: "node",
  setupFiles: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
  testMatch: ["**/__tests__/**/*.(test|spec).[jt]s?(x)"],
  testPathIgnorePatterns: ["/node_modules/", "/.next/"],
  transformIgnorePatterns: ["node_modules/(?!(nuqs|better-auth)/)"],
  clearMocks: true,
}

export default createJestConfig(config)
