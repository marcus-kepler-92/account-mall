/**
 * Middleware tests
 *
 * Tests the route classification logic and authentication flow:
 * - Public pages pass through without auth
 * - Public APIs pass through without auth
 * - Admin pages redirect to /admin/login without session
 * - Protected APIs return 401 without session
 * - Valid sessions pass through on protected routes
 */

import { NextRequest } from "next/server";
import { proxy as middleware } from "@/proxy";

// Mock fetch globally for session validation
const mockFetch = jest.fn();
global.fetch = mockFetch;

/**
 * Helper to create a NextRequest for testing
 */
function createRequest(
  path: string,
  options: { method?: string; cookies?: Record<string, string> } = {}
): NextRequest {
  const { method = "GET", cookies = {} } = options;
  const url = `http://localhost:3000${path}`;
  const request = new NextRequest(url, { method });

  for (const [name, value] of Object.entries(cookies)) {
    request.cookies.set(name, value);
  }

  return request;
}

/**
 * Helper to simulate a valid session response
 */
function mockValidSession() {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      session: {
        id: "session_001",
        userId: "admin_001",
        token: "valid_token",
      },
    }),
  });
}

/**
 * Helper to simulate an invalid session response
 */
function mockInvalidSession() {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({}),
  });
}

// ─── Public Pages ────────────────────────────────────────────────

describe("Public pages (no auth required)", () => {
  it("should allow access to homepage /", async () => {
    const request = createRequest("/");
    const response = await middleware(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("should allow access to /products/:slug", async () => {
    const request = createRequest("/products/123-chatgpt-plus");
    const response = await middleware(request);

    expect(response.status).toBe(200);
  });

  it("should allow access to /products list", async () => {
    const request = createRequest("/products");
    const response = await middleware(request);

    expect(response.status).toBe(200);
  });

  it("should allow access to /orders/:orderNo/success", async () => {
    const request = createRequest("/orders/FAK202601010001/success");
    const response = await middleware(request);

    expect(response.status).toBe(200);
  });

  it("should allow access to /orders/by-email", async () => {
    const request = createRequest("/orders/by-email");
    const response = await middleware(request);

    expect(response.status).toBe(200);
  });

  it("should allow access to /orders/lookup", async () => {
    const request = createRequest("/orders/lookup");
    const response = await middleware(request);

    expect(response.status).toBe(200);
  });

  it("should allow access to /admin/login", async () => {
    const request = createRequest("/admin/login");
    const response = await middleware(request);

    expect(response.status).toBe(200);
  });
});

// ─── Public APIs ─────────────────────────────────────────────────

describe("Public APIs (no auth required)", () => {
  it("should allow /api/auth/* routes", async () => {
    const request = createRequest("/api/auth/sign-in/email", {
      method: "POST",
    });
    const response = await middleware(request);

    expect(response.status).toBe(200);
  });

  it("should allow GET /api/products (public browsing)", async () => {
    const request = createRequest("/api/products");
    const response = await middleware(request);

    expect(response.status).toBe(200);
  });

  it("should allow GET /api/products/:id", async () => {
    const request = createRequest("/api/products/clx_123");
    const response = await middleware(request);

    expect(response.status).toBe(200);
  });

  it("should allow /api/orders/by-email", async () => {
    const request = createRequest("/api/orders/by-email");
    const response = await middleware(request);

    expect(response.status).toBe(200);
  });

  it("should allow POST /api/orders/lookup", async () => {
    const request = createRequest("/api/orders/lookup", { method: "POST" });
    const response = await middleware(request);

    expect(response.status).toBe(200);
  });

  it("should allow POST /api/orders/lookup-by-email", async () => {
    const request = createRequest("/api/orders/lookup-by-email", { method: "POST" });
    const response = await middleware(request);

    expect(response.status).toBe(200);
  });

  it("should allow /api/payment/* routes", async () => {
    const request = createRequest("/api/payment/alipay/notify", {
      method: "POST",
    });
    const response = await middleware(request);

    expect(response.status).toBe(200);
  });
});

// ─── Protected Admin Pages ───────────────────────────────────────

describe("Protected admin pages", () => {
  it("should redirect /admin/dashboard to /admin/login without session", async () => {
    const request = createRequest("/admin/dashboard");
    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/admin/login");
  });

  it("should redirect /admin/products to /admin/login without session", async () => {
    const request = createRequest("/admin/products");
    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/admin/login");
  });

  it("should redirect /admin/orders to /admin/login without session", async () => {
    const request = createRequest("/admin/orders");
    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/admin/login");
  });

  it("should allow admin page access with valid session", async () => {
    mockValidSession();

    const request = createRequest("/admin/dashboard", {
      cookies: { "better-auth.session_token": "valid_token" },
    });
    const response = await middleware(request);

    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("should redirect admin page with invalid session", async () => {
    mockInvalidSession();

    const request = createRequest("/admin/dashboard", {
      cookies: { "better-auth.session_token": "expired_token" },
    });
    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/admin/login");
  });
});

// ─── Protected APIs ──────────────────────────────────────────────

describe("Protected APIs", () => {
  it("should return 401 for POST /api/products without session", async () => {
    const request = createRequest("/api/products", { method: "POST" });
    const response = await middleware(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("should return 401 for PUT /api/products/:id without session", async () => {
    const request = createRequest("/api/products/clx_123", { method: "PUT" });
    const response = await middleware(request);

    expect(response.status).toBe(401);
  });

  it("should return 401 for DELETE /api/products/:id without session", async () => {
    const request = createRequest("/api/products/clx_123", {
      method: "DELETE",
    });
    const response = await middleware(request);

    expect(response.status).toBe(401);
  });

  it("should return 401 for /api/cards/* without session", async () => {
    const request = createRequest("/api/cards/clx_card_001", {
      method: "DELETE",
    });
    const response = await middleware(request);

    expect(response.status).toBe(401);
  });

  it("should return 401 for GET /api/orders (admin list) without session", async () => {
    const request = createRequest("/api/orders");
    const response = await middleware(request);

    expect(response.status).toBe(401);
  });

  it("should allow POST /api/products with valid session", async () => {
    mockValidSession();

    const request = createRequest("/api/products", {
      method: "POST",
      cookies: { "better-auth.session_token": "valid_token" },
    });
    const response = await middleware(request);

    expect(response.status).toBe(200);
  });

  it("should allow /api/cards with valid session", async () => {
    mockValidSession();

    const request = createRequest("/api/cards/product_001/bulk", {
      method: "POST",
      cookies: { "better-auth.session_token": "valid_token" },
    });
    const response = await middleware(request);

    expect(response.status).toBe(200);
  });
});
