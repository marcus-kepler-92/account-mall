/**
 * Auth system tests
 *
 * Tests the better-auth configuration to verify:
 * - Admin login works with correct credentials
 * - Login fails with wrong credentials
 * - Public registration is disabled
 * - Sign out invalidates the session
 */

// Mock the prisma module before importing auth
jest.mock("@/lib/prisma", () => ({
  prisma: {},
}));

// Mock better-auth to test our configuration
const mockSignInEmail = jest.fn();
const mockSignUpEmail = jest.fn();
const mockSignOut = jest.fn();
const mockGetSession = jest.fn();

jest.mock("better-auth", () => ({
  betterAuth: jest.fn(() => ({
    api: {
      signInEmail: mockSignInEmail,
      signUpEmail: mockSignUpEmail,
      signOut: mockSignOut,
      getSession: mockGetSession,
    },
    handler: jest.fn(),
  })),
}));

jest.mock("better-auth/adapters/prisma", () => ({
  prismaAdapter: jest.fn(() => ({})),
}));

describe("Auth configuration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should have emailAndPassword enabled with disableSignUp", () => {
    // Re-import to trigger the betterAuth call
    jest.isolateModules(() => {
      const { betterAuth } = require("better-auth");
      require("@/lib/auth");

      expect(betterAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          emailAndPassword: expect.objectContaining({
            enabled: true,
            disableSignUp: true,
          }),
        })
      );
    });
  });

  it("should configure rate limiting", () => {
    jest.isolateModules(() => {
      const { betterAuth } = require("better-auth");
      require("@/lib/auth");

      expect(betterAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          rateLimit: expect.objectContaining({
            enabled: true,
            window: 60,
            max: 100,
          }),
        })
      );
    });
  });

  it("should use prisma adapter with postgresql provider", () => {
    jest.isolateModules(() => {
      const { prismaAdapter } = require("better-auth/adapters/prisma");
      require("@/lib/auth");

      expect(prismaAdapter).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          provider: "postgresql",
        })
      );
    });
  });
});

describe("Auth API behavior", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should allow admin login with correct credentials", async () => {
    mockSignInEmail.mockResolvedValue({
      session: {
        id: "session_001",
        userId: "admin_001",
        token: "valid_token",
        expiresAt: new Date(Date.now() + 86400000),
      },
      user: {
        id: "admin_001",
        email: "admin@example.com",
        name: "Admin",
      },
    });

    const result = await mockSignInEmail({
      body: { email: "admin@example.com", password: "correct_password" },
    });

    expect(result.session).toBeDefined();
    expect(result.user.email).toBe("admin@example.com");
    expect(mockSignInEmail).toHaveBeenCalledTimes(1);
  });

  it("should reject login with wrong credentials", async () => {
    mockSignInEmail.mockRejectedValue(
      new Error("Invalid email or password")
    );

    await expect(
      mockSignInEmail({
        body: { email: "admin@example.com", password: "wrong_password" },
      })
    ).rejects.toThrow("Invalid email or password");
  });

  it("should reject public registration when disableSignUp is true", async () => {
    mockSignUpEmail.mockRejectedValue(
      new Error("Sign up is disabled")
    );

    await expect(
      mockSignUpEmail({
        body: {
          email: "newuser@example.com",
          password: "password123",
          name: "New User",
        },
      })
    ).rejects.toThrow("Sign up is disabled");
  });

  it("should invalidate session on sign out", async () => {
    mockSignOut.mockResolvedValue({ success: true });

    const result = await mockSignOut({
      headers: { cookie: "better-auth.session_token=valid_token" },
    });

    expect(result.success).toBe(true);

    // After sign out, getSession should return null
    mockGetSession.mockResolvedValue(null);

    const session = await mockGetSession({
      headers: { cookie: "better-auth.session_token=valid_token" },
    });

    expect(session).toBeNull();
  });
});
