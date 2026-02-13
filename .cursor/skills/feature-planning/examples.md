# Feature Planning Examples

This document provides concrete examples of how to use the feature-planning skill.

---

## Example 1: Adding Email Notifications for Order Completion

### User Request
"I want to add email notifications when an order is completed"

### Discovery Phase

**1. Explore Codebase:**
- Read `README.md` → Tech stack includes Resend + React Email
- Read `TASKS.md` → Task #18 mentions email notifications
- Search: "How are emails currently sent?" → No existing implementation
- Check `package.json` → Resend dependency exists
- Review `prisma/schema.prisma` → Order model has `email` and `status` fields

**2. Available Tools:**
- Codebase search for email patterns
- Read existing API routes for order completion
- Check for existing email utilities

**3. Related Code Found:**
- `app/api/orders/[orderId]/route.ts` - Order completion logic
- `prisma/schema.prisma` - Order model structure
- No existing email service found

### Requirements Analysis

**What:** Send email notification when order status changes to COMPLETED

**Why:** Provide backup delivery method for card keys, improve user experience

**Who:** Customers who completed orders

**Where:** 
- Trigger: Order completion API (`POST /api/payment/alipay/notify`)
- Email service: New utility in `lib/email.ts`
- Template: `app/emails/order-completion.tsx`

**Constraints:**
- Must not block payment confirmation if email fails
- Must use existing Resend setup
- Email should include all card keys for the order

**Acceptance Criteria:**
- Email sent automatically when order status → COMPLETED
- Email includes: order number, product name, quantity, all card keys
- Email sending failure doesn't affect order completion
- Email template is responsive and readable

### Role-Based Todos

#### Product Manager
- [ ] Define email content structure (order details + card keys)
- [ ] Specify error handling UX (what happens if email fails?)
- [ ] Define email subject line format
- [ ] Review email template design requirements
- [ ] Identify edge cases (invalid email, email service down)

#### Architect
- [ ] Design email service abstraction (`lib/email.ts`)
- [ ] Plan async email sending (don't block order completion)
- [ ] Design email template structure using React Email
- [ ] Plan error handling and logging strategy
- [ ] Consider retry mechanism for failed emails
- [ ] Design email queue/background job (if needed)

#### Senior Developer
- [ ] Create email service: `lib/email.ts` with `sendOrderCompletionEmail()`
- [ ] Create React Email template: `app/emails/order-completion.tsx`
- [ ] Update order completion API: `app/api/payment/alipay/notify/route.ts`
- [ ] Add email sending call after order status update
- [ ] Implement error handling (try-catch, log errors)
- [ ] Add TypeScript types for email data
- [ ] Configure Resend API key in environment variables

#### Tester
- [ ] Unit test: `sendOrderCompletionEmail()` with valid data
- [ ] Unit test: Email service handles Resend API errors
- [ ] Integration test: Order completion triggers email
- [ ] Integration test: Email failure doesn't affect order completion
- [ ] Test: Email template renders correctly with all card keys
- [ ] Test: Email sent to correct recipient address
- [ ] Manual test: Verify email delivery in different email clients

---

## Example 2: Adding Order Status Filter to Admin Dashboard

### User Request
"Add filtering by order status in the admin orders page"

### Discovery Phase

**1. Explore Codebase:**
- Read `TASKS.md` → Task #7 mentions order management
- Search: "Where is admin orders page?" → `app/admin/(main)/orders/page.tsx`
- Search: "How are orders queried?" → `app/api/orders/route.ts`
- Review existing filter patterns in product management

**2. Available Tools:**
- Read existing orders API and page
- Check for existing filter components
- Review Prisma query patterns

**3. Related Code Found:**
- `app/admin/(main)/orders/page.tsx` - Orders list page
- `app/api/orders/route.ts` - Orders API endpoint
- `app/admin/(main)/products/page.tsx` - Similar filter pattern exists

### Requirements Analysis

**What:** Add status filter dropdown to admin orders page

**Why:** Help admins quickly find orders by status (PENDING, COMPLETED, CLOSED)

**Who:** Admin users

**Where:**
- UI: `app/admin/(main)/orders/page.tsx`
- API: `app/api/orders/route.ts` (add status query parameter)

**Constraints:**
- Must follow existing filter pattern from products page
- Must work with existing pagination
- Should persist filter in URL query params

**Acceptance Criteria:**
- Filter dropdown shows all order statuses
- Filtering works with existing search/pagination
- URL reflects current filter state
- Default shows all orders

### Role-Based Todos

#### Product Manager
- [ ] Define filter UI placement (top of list, alongside search)
- [ ] Specify filter options: All, Pending, Completed, Closed
- [ ] Define default filter behavior (show all)
- [ ] Review filter interaction with search and pagination
- [ ] Specify URL parameter name (`?status=pending`)

#### Architect
- [ ] Design API query parameter: `GET /api/orders?status=PENDING`
- [ ] Plan filter persistence in URL searchParams
- [ ] Design filter state management (server component vs client)
- [ ] Consider filter combination with other query params
- [ ] Plan database query optimization (index on status field)

#### Senior Developer
- [ ] Update API route: `app/api/orders/route.ts` - Add status filter
- [ ] Update Prisma query to filter by status when provided
- [ ] Add filter dropdown component to orders page
- [ ] Implement URL searchParams reading/writing
- [ ] Update TypeScript types for filter parameters
- [ ] Follow existing filter pattern from products page
- [ ] Add loading state during filter changes

#### Tester
- [ ] Test: Filter by PENDING shows only pending orders
- [ ] Test: Filter by COMPLETED shows only completed orders
- [ ] Test: Filter persists in URL
- [ ] Test: Filter works with pagination
- [ ] Test: Filter works with search (if exists)
- [ ] Test: Default "All" shows all orders
- [ ] Test: Invalid status parameter handled gracefully

---

## Example 3: Implementing Order Timeout Mechanism

### User Request
"Orders should automatically close after 15 minutes if not paid"

### Discovery Phase

**1. Explore Codebase:**
- Read `TASKS.md` → Task #16 describes this feature
- Search: "How are cron jobs configured?" → Check for `vercel.json`
- Search: "Where is order status updated?" → Order completion API
- Review Order model: `status` field, `createdAt` timestamp

**2. Available Tools:**
- Check Vercel Cron Jobs documentation
- Review existing API route patterns
- Check for existing cron job implementations

**3. Related Code Found:**
- `prisma/schema.prisma` - Order model with status and timestamps
- `app/api/payment/alipay/notify/route.ts` - Order completion logic
- No existing cron jobs found

### Requirements Analysis

**What:** Automatically close PENDING orders older than 15 minutes

**Why:** Release reserved card keys back to inventory, prevent inventory lock

**Who:** System background process

**Where:**
- Cron job: `app/api/cron/close-expired-orders/route.ts`
- Configuration: `vercel.json`

**Constraints:**
- Must release card keys (RESERVED → UNSOLD)
- Must be idempotent (safe to run multiple times)
- Should run frequently enough (every minute)
- Must handle timezone correctly

**Acceptance Criteria:**
- PENDING orders older than 15 minutes are closed
- Card keys are released back to inventory
- Process is idempotent
- Runs automatically via cron job
- Logs closed orders for monitoring

### Role-Based Todos

#### Product Manager
- [ ] Define timeout duration (15 minutes, configurable?)
- [ ] Specify behavior: Close order, release cards, log action
- [ ] Define edge case: What if payment arrives during timeout check?
- [ ] Review notification needs (should users be notified?)

#### Architect
- [ ] Design cron job endpoint: `POST /api/cron/close-expired-orders`
- [ ] Plan idempotency (check status before updating)
- [ ] Design database query (find expired PENDING orders)
- [ ] Plan transaction boundary (order update + card release)
- [ ] Design error handling and logging
- [ ] Configure Vercel Cron in `vercel.json`
- [ ] Consider race condition with payment callback

#### Senior Developer
- [ ] Create cron route: `app/api/cron/close-expired-orders/route.ts`
- [ ] Implement Prisma query: Find PENDING orders older than 15 min
- [ ] Implement transaction: Update order status + release cards
- [ ] Add idempotency check (skip if already CLOSED)
- [ ] Add logging for monitoring
- [ ] Configure Vercel Cron: `vercel.json`
- [ ] Add environment variable for timeout duration
- [ ] Add TypeScript types

#### Tester
- [ ] Unit test: `closeExpiredOrders()` closes old PENDING orders
- [ ] Unit test: Idempotency (running twice doesn't duplicate work)
- [ ] Unit test: Doesn't close orders less than 15 minutes old
- [ ] Integration test: Cron endpoint closes expired orders
- [ ] Integration test: Card keys released correctly
- [ ] Integration test: Race condition handling (payment during cron)
- [ ] Manual test: Verify cron job runs on schedule

---

## Tips for Using This Skill

1. **Start Broad, Then Narrow**: Begin with high-level discovery, then dive into specifics
2. **Reference Existing Code**: Always look for similar patterns first
3. **Think About Dependencies**: Order todos to respect implementation dependencies
4. **Consider Edge Cases**: Each role should think about failure scenarios
5. **Be Specific**: Include file paths, function names, and code patterns in todos
6. **Stay Practical**: Todos should be implementable with available tools
