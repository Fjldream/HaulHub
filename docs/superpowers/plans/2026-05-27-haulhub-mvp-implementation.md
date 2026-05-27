# HaulHub MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable HaulHub MVP with a desktop accountant web app, a uni-app driver client for WeChat Mini Program/H5/App targets, and a SQLite-backed API.

**Architecture:** Use a monorepo so the admin Web, driver uni-app, API service, shared business rules, and design tokens can evolve independently. Keep trip status, finance calculation, privacy rules, and API contracts in shared packages so the admin app and uni-app client do not duplicate core logic.

**Tech Stack:** Next.js + TypeScript + Tailwind CSS for `apps/admin-web`; uni-app + Vue 3 + TypeScript for `apps/driver-uni`; Node.js + TypeScript API service with Prisma + SQLite for `apps/api`; Vitest for domain/API tests; Playwright where browser verification is needed.

---

## File Structure

- Create: `package.json` - root workspace scripts and dependencies.
- Create: `apps/admin-web/**` - accountant desktop Web app.
- Create: `apps/driver-uni/**` - uni-app driver client.
- Create: `apps/api/**` - backend API service.
- Create: `packages/shared/**` - status machine, finance helpers, permissions, shared types.
- Create: `packages/design-tokens/**` - typed wrapper around `design/tokens.json`.
- Create: `prisma/schema.prisma` - SQLite database schema owned by `apps/api`.
- Create: `tests/**` or package-local tests - domain, API, and critical UI checks.

## Task 1: Convert Scaffold To Monorepo

**Files:**
- Modify: `package.json`
- Move: root Next.js scaffold files into `apps/admin-web/`
- Create: `apps/driver-uni/package.json`
- Create: `apps/api/package.json`
- Create: `packages/shared/package.json`
- Create: `packages/design-tokens/package.json`

- [ ] **Step 1: Move existing Next scaffold into admin app**

Move these root files/directories into `apps/admin-web/`: `src`, `public`, `next.config.ts`, `next-env.d.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `README.md`, and the current app-level `package.json`.

Expected: `apps/admin-web/src/app/page.tsx` exists.

- [ ] **Step 2: Create root workspace package**

Create a root `package.json` with workspaces:

```json
{
  "name": "haulhub",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev:admin": "npm --workspace apps/admin-web run dev",
    "dev:driver:h5": "npm --workspace apps/driver-uni run dev:h5",
    "dev:api": "npm --workspace apps/api run dev",
    "lint": "npm run lint --workspaces --if-present",
    "test": "npm run test --workspaces --if-present"
  }
}
```

- [ ] **Step 3: Add package placeholders**

Create minimal package manifests for `apps/driver-uni`, `apps/api`, `packages/shared`, and `packages/design-tokens`, each with `private: true`, `type: module`, and package-specific scripts.

- [ ] **Step 4: Install workspace dependencies**

Run:

```powershell
npm install
```

Expected: root `package-lock.json` reflects workspaces.

- [ ] **Step 5: Verify admin scaffold still works**

Run:

```powershell
npm run lint
```

Expected: lint passes.

- [ ] **Step 6: Commit**

```powershell
git add .
git commit -m "chore: convert scaffold to monorepo"
```

## Task 2: Shared Domain Packages

**Files:**
- Create: `packages/shared/src/trips/status.ts`
- Create: `packages/shared/src/trips/finance.ts`
- Create: `packages/shared/src/auth/permissions.ts`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/tests/*.test.ts`
- Create: `packages/design-tokens/src/index.ts`

- [ ] **Step 1: Add failing status machine tests**

Tests must allow `assigned -> in_progress -> submitted -> under_review -> completed`, allow `under_review -> returned -> submitted`, and reject `assigned -> completed`.

- [ ] **Step 2: Implement trip status helpers**

Expose `TripStatus`, `canTransitionTripStatus`, and `assertTripStatusTransition`.

- [ ] **Step 3: Add finance tests**

Tests must cover expense total, positive profit, negative profit, zero freight profit rate, and CNY formatting.

- [ ] **Step 4: Implement finance helpers**

Expose `calculateExpenseTotal`, `calculateProfit`, `calculateProfitRate`, and `formatCny`. Use decimal-safe arithmetic; do not use floating-point math for persisted values.

- [ ] **Step 5: Add permission tests**

Tests must assert driver-facing records exclude `estimatedFreight`, `actualFreight`, `profit`, `profitRate`, and `businessReports`.

- [ ] **Step 6: Implement permission helpers**

Expose `stripDriverHiddenFields`, `canDriverEditTrip`, and `canAccountantReviewTrip`.

- [ ] **Step 7: Expose design tokens package**

`packages/design-tokens` imports `../../design/tokens.json` and exports `designTokens`, `statusTokens`, and `financeTokens`.

- [ ] **Step 8: Run tests and commit**

Run `npm run test --workspace packages/shared`, then commit.

## Task 3: SQLite API Service

**Files:**
- Create: `apps/api/src/**`
- Create: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/seed.ts`
- Create: `apps/api/tests/**`

- [ ] **Step 1: Install API dependencies**

Use a small Node.js TypeScript HTTP framework such as Fastify. Add Prisma, SQLite, Zod, Vitest, and tsx.

- [ ] **Step 2: Define SQLite Prisma schema**

Models: `User`, `Vehicle`, `DriverVehicleBinding`, `ExpenseType`, `Trip`, `Expense`, `ReceiptImage`, `SettlementSnapshot`, and `AuditLog`. Use `Decimal` for money fields.

- [ ] **Step 3: Seed sample data**

Seed one accountant, two drivers, two vehicles, default expense types, and sample trips.

- [ ] **Step 4: Implement auth and role middleware**

First version may use simple session tokens for local MVP, but all protected routes must identify the current user and role.

- [ ] **Step 5: Implement driver APIs**

`/driver/trips`, `/driver/trips/:tripId`, `/driver/trips/:tripId/submit`, `/driver/expenses`, and receipt upload endpoints. Driver APIs must never return hidden finance fields.

- [ ] **Step 6: Implement admin APIs**

`/admin/trips`, review start, return, settlement, vehicles, drivers, expense types, and reports.

- [ ] **Step 7: Add audit logs**

Write logs for review start, return, delete expense, edit amount, and settlement.

- [ ] **Step 8: Run API tests and commit**

Run API tests and `npm run lint --workspace apps/api`, then commit.

## Task 4: Admin Web

**Files:**
- Modify/Create: `apps/admin-web/src/app/**`
- Create: `apps/admin-web/src/components/admin/**`
- Create: `apps/admin-web/src/lib/api-client.ts`

- [ ] **Step 1: Wire admin app to API**

Create an API client that calls `apps/api` endpoints and handles auth failures.

- [ ] **Step 2: Build admin shell**

Use stable left navigation and top user area. Consume tokens from `packages/design-tokens`.

- [ ] **Step 3: Build trip management table**

Columns: trip no, plate, driver, customer, route, status, created time, submitted time, actual freight, expense total, profit, actions.

- [ ] **Step 4: Build trip review detail**

Show base info, expenses, receipt previews, financial summary, return action, review action, actual freight input, and settle action.

- [ ] **Step 5: Build management pages**

Vehicles, drivers, expense types, and reports use table-first layouts.

- [ ] **Step 6: Verify desktop UI and commit**

Run lint and a Playwright desktop smoke test.

## Task 5: Driver uni-app

**Files:**
- Create/Modify: `apps/driver-uni/src/pages/**`
- Create: `apps/driver-uni/src/components/**`
- Create: `apps/driver-uni/src/api/**`

- [ ] **Step 1: Scaffold uni-app Vue 3 TypeScript client**

Use a uni-app setup that supports WeChat Mini Program and H5 builds.

- [ ] **Step 2: Build login and trip list**

Trip cards show plate number, customer, route, status, and next action. They do not show freight or profit.

- [ ] **Step 3: Build trip detail**

Show route, driver-visible note, expenses, receipt status, expense total, and allowed actions.

- [ ] **Step 4: Build expense form**

Fields: expense type, amount, occurred time, note, receipt images. Disable submit when required receipt is missing.

- [ ] **Step 5: Build submit confirmation and profile**

Submit confirmation lists expense total and missing items, without financial hidden fields.

- [ ] **Step 6: Verify H5 and mini-program builds**

Run H5 build and WeChat Mini Program build commands. Verify driver pages contain no hidden finance labels.

- [ ] **Step 7: Commit**

Commit the driver client implementation.

## Task 6: End-To-End Vertical Slice

**Files:**
- Create: `tests/e2e/driver-submit-trip.spec.ts`
- Create: `tests/e2e/accountant-settle-trip.spec.ts`
- Create: `tests/e2e/driver-privacy.spec.ts`

- [ ] **Step 1: Driver submits a trip**

Seed a driver trip, log in as the driver, add a required-receipt expense, upload a test receipt, submit the trip, and expect status `已提交`.

- [ ] **Step 2: Accountant settles the trip**

Log in as accountant, start review, enter actual freight, complete settlement, and expect profit to be calculated.

- [ ] **Step 3: Driver privacy check**

Log in as driver and assert the rendered driver UI and driver API response do not include `预计运费`, `实际运费`, `利润`, or `利润率`.

- [ ] **Step 4: Commit final verification**

Run all tests and commit fixes.

## Self-Review

- Spec coverage: design system, MVP pages, uni-app driver target, SQLite API, status machine, finance rules, privacy rules, and verification are covered.
- Placeholder scan: no task depends on undefined future business requirements.
- Scope check: this is a full MVP. If delivery needs to be shorter, implement Tasks 1-3 plus the driver submit/accountant settle vertical slice before filling every management page.
