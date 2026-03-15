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
 * Helper to simulate a valid session response (no user.role; use mockAdminSession or mockDistributorSession for role checks)
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
 * Helper to simulate a valid admin session (user.role === "ADMIN")
 */
function mockAdminSession() {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      session: {
        id: "session_001",
        userId: "admin_001",
        token: "valid_token",
      },
      user: { id: "admin_001", role: "ADMIN" },
    }),
  });
}

/**
 * Helper to simulate a valid distributor session (user.role === "DISTRIBUTOR")
 */
function mockDistributorSession() {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      session: { id: "s1", userId: "dist_1", token: "valid_token" },
      user: { id: "dist_1", role: "DISTRIBUTOR" },
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

  it("should allow access to /distributor/login", async () => {
    const request = createRequest("/distributor/login");
    const response = await middleware(request);

    expect(response.status).toBe(200);
  });

  it("should allow access to /distributor/register", async () => {
    const request = createRequest("/distributor/register");
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

  it("should allow POST /api/orders (create order)", async () => {
    const request = createRequest("/api/orders", { method: "POST" });
    const response = await middleware(request);

    expect(response.status).toBe(200);
  });

  it("should allow POST /api/orders/get-payment-url", async () => {
    const request = createRequest("/api/orders/get-payment-url", { method: "POST" });
    const response = await middleware(request);

    expect(response.status).toBe(200);
  });

  it("should allow /api/restock-subscriptions", async () => {
    const request = createRequest("/api/restock-subscriptions", { method: "POST" });
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

  it("should allow POST /api/orders/:orderNo/refresh (order password auth)", async () => {
    const request = createRequest("/api/orders/order_123/refresh", {
      method: "POST",
    });
    const response = await middleware(request);

    expect(response.status).toBe(200);
  });
});

// ─── Admin login page with session ───────────────────────────────

describe("Admin login page with session cookie", () => {
  it("should redirect to /admin/dashboard when already authenticated as ADMIN", async () => {
    mockAdminSession();

    const request = createRequest("/admin/login", {
      cookies: { "better-auth.session_token": "valid_token" },
    });
    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/admin/dashboard");
  });

  it("should redirect to /admin/dashboard when authenticated with __Secure- cookie (production) as ADMIN", async () => {
    mockAdminSession();

    const request = createRequest("/admin/login", {
      cookies: { "__Secure-better-auth.session_token": "valid_token" },
    });
    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/admin/dashboard");
  });

  it("should NOT redirect when on /admin/login with DISTRIBUTOR session (wrong entry)", async () => {
    mockDistributorSession();

    const request = createRequest("/admin/login", {
      cookies: { "better-auth.session_token": "valid_token" },
    });
    const response = await middleware(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
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

  it("should allow admin page access with valid session cookie (no fetch needed)", async () => {
    // Page navigations trust cookie presence; role check is delegated to layout auth-guard.
    const request = createRequest("/admin/dashboard", {
      cookies: { "better-auth.session_token": "valid_token" },
    });
    const response = await middleware(request);

    expect(response.status).toBe(200);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should allow admin page access with __Secure- session cookie (production, no fetch needed)", async () => {
    const request = createRequest("/admin/dashboard", {
      cookies: { "__Secure-better-auth.session_token": "valid_token" },
    });
    const response = await middleware(request);

    expect(response.status).toBe(200);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should allow page access when cookie exists regardless of role (role check delegated to layout)", async () => {
    // proxy no longer fetches session for page navigations; layout auth-guard handles role enforcement.
    const request = createRequest("/admin/dashboard", {
      cookies: { "better-auth.session_token": "valid_token" },
    });
    const response = await middleware(request);

    expect(response.status).toBe(200);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should allow page access when cookie exists even with expired/invalid token (layout auth-guard handles this)", async () => {
    // proxy only checks cookie existence; actual session validation is in layout's auth-guard.
    const request = createRequest("/admin/dashboard", {
      cookies: { "better-auth.session_token": "expired_token" },
    });
    const response = await middleware(request);

    expect(response.status).toBe(200);
    expect(mockFetch).not.toHaveBeenCalled();
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

  it("should return 401 for GET /api/orders/:id without session", async () => {
    const request = createRequest("/api/orders/order_123");
    const response = await middleware(request);

    expect(response.status).toBe(401);
  });

  it("should return 401 when session fetch fails for protected API", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    const request = createRequest("/api/orders", {
      cookies: { "better-auth.session_token": "token" },
    });
    const response = await middleware(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("should return 401 when session is empty for protected API", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const request = createRequest("/api/orders", {
      cookies: { "better-auth.session_token": "token" },
    });
    const response = await middleware(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("should allow POST /api/products with valid ADMIN session", async () => {
    mockAdminSession();

    const request = createRequest("/api/products", {
      method: "POST",
      cookies: { "better-auth.session_token": "valid_token" },
    });
    const response = await middleware(request);

    expect(response.status).toBe(200);
  });

  it("should allow /api/cards with valid ADMIN session", async () => {
    mockAdminSession();

    const request = createRequest("/api/cards/product_001/bulk", {
      method: "POST",
      cookies: { "better-auth.session_token": "valid_token" },
    });
    const response = await middleware(request);

    expect(response.status).toBe(200);
  });

  it("should return 401 when DISTRIBUTOR session accesses admin API (GET /api/orders)", async () => {
    mockDistributorSession();

    const request = createRequest("/api/orders", {
      cookies: { "better-auth.session_token": "valid_token" },
    });
    const response = await middleware(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("should pass through protected page when cookie exists (no session fetch for page navigations)", async () => {
    // proxy skips session fetch for page navigations; layout auth-guard handles validation.
    const request = createRequest("/admin/dashboard", {
      cookies: { "better-auth.session_token": "token" },
    });
    const response = await middleware(request);

    expect(response.status).toBe(200);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should pass through for non-public non-protected path", async () => {
    const request = createRequest("/api/some-other-route", { method: "GET" });
    const response = await middleware(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});

// ─── Protected Distributor Pages ─────────────────────────────────────

describe("Protected distributor pages", () => {
  it("should redirect /distributor to /distributor/login without session", async () => {
    const request = createRequest("/distributor");
    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/distributor/login");
  });

  it("should redirect /distributor/orders to /distributor/login without session", async () => {
    const request = createRequest("/distributor/orders");
    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/distributor/login");
  });

  it("should allow distributor page access when cookie exists (no fetch needed)", async () => {
    // proxy trusts cookie presence for page navigations; role check delegated to layout.
    const request = createRequest("/distributor", {
      cookies: { "better-auth.session_token": "valid_token" },
    });
    const response = await middleware(request);

    expect(response.status).toBe(200);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should allow page access when ADMIN cookie present on distributor page (role check delegated to layout)", async () => {
    // proxy no longer enforces role on page navigations; layout's auth-guard will redirect if wrong role.
    const request = createRequest("/distributor", {
      cookies: { "better-auth.session_token": "valid_token" },
    });
    const response = await middleware(request);

    expect(response.status).toBe(200);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ─── Distributor login page with session ─────────────────────────────

describe("Distributor login page with session cookie", () => {
  it("should redirect to /distributor when already authenticated as DISTRIBUTOR", async () => {
    mockDistributorSession();

    const request = createRequest("/distributor/login", {
      cookies: { "better-auth.session_token": "valid_token" },
    });
    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/distributor");
  });

  it("should NOT redirect when on /distributor/login with ADMIN session (wrong entry)", async () => {
    mockAdminSession();

    const request = createRequest("/distributor/login", {
      cookies: { "better-auth.session_token": "valid_token" },
    });
    const response = await middleware(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});

// ─── PromoCode cookie: handled by client hook + GET /api/set-promo-cookie ───

describe("GET storefront with promoCode (cookie set by client, not middleware)", () => {
  it("does not set cookie in middleware when GET / with promoCode", async () => {
    const request = new NextRequest("http://localhost:3000/?promoCode=ABC");
    const response = await middleware(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBeFalsy();
  });
});
