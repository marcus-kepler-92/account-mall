import { PrismaClient } from "@prisma/client";
import { mockDeep, mockReset, DeepMockProxy } from "jest-mock-extended";

// Create a deep mock of PrismaClient for use in unit tests
export const prismaMock =
  mockDeep<PrismaClient>() as unknown as DeepMockProxy<PrismaClient>;

// Reset all mocks before each test to ensure isolation
beforeEach(() => {
  mockReset(prismaMock);
});

// Mock the prisma module so all imports get the mock instance
jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  prisma: prismaMock,
}));
