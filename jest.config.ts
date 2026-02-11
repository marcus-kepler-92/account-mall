import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  dir: "./",
});

const config = {
  // Default to node environment; component tests can override with docblock
  testEnvironment: "node",
  setupFiles: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  testMatch: ["**/__tests__/**/*.(test|spec).[jt]s?(x)"],
  clearMocks: true,
};

export default createJestConfig(config);
