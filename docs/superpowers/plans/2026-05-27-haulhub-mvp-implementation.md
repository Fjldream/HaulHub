# HaulHub MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable HaulHub MVP: driver mobile billing flow plus accountant desktop review, settlement, and reporting flow.

**Architecture:** Use a TypeScript monolith first: Next.js App Router for both admin and driver UI, route handlers for API endpoints, Prisma service modules for database access, and PostgreSQL for persistence. Keep business rules in focused domain services so the app can later split into a separate API without rewriting UI code.

**Tech Stack:** Next.js, TypeScript, Tailwind CSS, Prisma, PostgreSQL, Vitest, Playwright, object-storage compatible file adapter.

---

## File Structure

- Create: `package.json` - app scripts and dependencies.
- Create: `src/app/(auth)/login/page.tsx` - shared login page.
- Create: `src/app/(driver)/driver/trips/page.tsx` - driver trip list.
- Create: `src/app/(driver)/driver/trips/[tripId]/page.tsx` - driver trip detail.
- Create: `src/app/(driver)/driver/trips/[tripId]/expenses/new/page.tsx` - driver expense form.
- Create: `src/app/(admin)/admin/page.tsx` - accountant workbench.
- Create: `src/app/(admin)/admin/trips/page.tsx` - trip management table.
- Create: `src/app/(admin)/admin/trips/[tripId]/page.tsx` - trip review and settlement.
- Create: `src/app/(admin)/admin/vehicles/page.tsx` - vehicle management.
- Create: `src/app/(admin)/admin/drivers/page.tsx` - driver management.
- Create: `src/app/(admin)/admin/expense-types/page.tsx` - expense type configuration.
- Create: `src/app/(admin)/admin/reports/page.tsx` - profit statistics.
- Create: `src/app/api/**/route.ts` - resource API endpoints.
- Create: `src/domain/trips/status.ts` - trip state machine.
- Create: `src/domain/trips/finance.ts` - money calculation rules.
- Create: `src/domain/auth/permissions.ts` - role and field visibility rules.
- Create: `src/lib/design-tokens.ts` - typed wrapper around `design/tokens.json`.
- Create: `prisma/schema.prisma` - database schema.
- Create: `tests/domain/*.test.ts` - domain rule tests.
- Create: `tests/e2e/*.spec.ts` - end-to-end flow tests.

## Task 1: Scaffold App And Design Tokens

**Files:**
- Create: `package.json`
- Create: `src/lib/design-tokens.ts`
- Modify: `design/tokens.json`

- [ ] **Step 1: Initialize the Next.js TypeScript app**

Run:

```powershell
npx create-next-app@latest . --ts --eslint --app --src-dir --tailwind --import-alias "@/*"
```

Expected: Next.js app files are created in the workspace.

- [ ] **Step 2: Preserve existing docs and design assets**

Run:

```powershell
Test-Path .\docs; Test-Path .\design\tokens.json
```

Expected: both commands print `True`.

- [ ] **Step 3: Add design token loader**

Create `src/lib/design-tokens.ts`:

```ts
import tokens from "../../design/tokens.json";

export const designTokens = tokens;

export const statusTokens = tokens.status;
export const financeTokens = tokens.finance;
```

- [ ] **Step 4: Verify TypeScript accepts JSON imports**

Run:

```powershell
npm run lint
```

Expected: lint passes or reports only framework scaffold warnings that are fixed before continuing.

## Task 2: Database Schema

**Files:**
- Create: `prisma/schema.prisma`
- Create: `prisma/seed.ts`

- [ ] **Step 1: Install Prisma**

Run:

```powershell
npm install prisma @prisma/client
npm install -D tsx
npx prisma init
```

Expected: Prisma config files are created.

- [ ] **Step 2: Define core schema**

Replace `prisma/schema.prisma` with models for `User`, `Vehicle`, `DriverVehicleBinding`, `ExpenseType`, `Trip`, `Expense`, `ReceiptImage`, `SettlementSnapshot`, and `AuditLog`. Use `Decimal` for all money fields and enums for roles, trip statuses, vehicle statuses, and user statuses.

- [ ] **Step 3: Add seed data**

Create `prisma/seed.ts` with one accountant, two drivers, two vehicles, default expense types, and two sample trips.

- [ ] **Step 4: Run migration**

Run:

```powershell
npx prisma migrate dev --name init
npx prisma db seed
```

Expected: database tables and seed data are created.

## Task 3: Domain Rules

**Files:**
- Create: `src/domain/trips/status.ts`
- Create: `src/domain/trips/finance.ts`
- Create: `src/domain/auth/permissions.ts`
- Create: `tests/domain/trip-status.test.ts`
- Create: `tests/domain/finance.test.ts`
- Create: `tests/domain/permissions.test.ts`

- [ ] **Step 1: Add failing status machine tests**

Tests must assert allowed transitions:

```text
assigned -> in_progress
in_progress -> submitted
submitted -> under_review
under_review -> completed
under_review -> returned
returned -> submitted
```

Tests must reject direct `assigned -> completed` and `completed -> returned`.

- [ ] **Step 2: Implement status machine**

Expose:

```ts
export type TripStatus =
  | "assigned"
  | "in_progress"
  | "submitted"
  | "under_review"
  | "completed"
  | "returned";

export function canTransitionTripStatus(from: TripStatus, to: TripStatus): boolean;
export function assertTripStatusTransition(from: TripStatus, to: TripStatus): void;
```

- [ ] **Step 3: Add finance tests**

Tests must cover positive profit, negative profit, zero actual freight, and two-decimal display.

- [ ] **Step 4: Implement finance helpers**

Expose:

```ts
export function calculateExpenseTotal(amounts: string[]): string;
export function calculateProfit(actualFreight: string, expenseTotal: string): string;
export function calculateProfitRate(actualFreight: string, profit: string): string | null;
export function formatCny(amount: string): string;
```

- [ ] **Step 5: Add permission tests**

Tests must assert driver responses exclude `estimatedFreight`, `actualFreight`, `profit`, `profitRate`, and `businessReports`.

- [ ] **Step 6: Implement permission helpers**

Expose:

```ts
export function stripDriverHiddenFields<T extends Record<string, unknown>>(record: T): Partial<T>;
export function canDriverEditTrip(status: TripStatus): boolean;
export function canAccountantReviewTrip(status: TripStatus): boolean;
```

## Task 4: API Layer

**Files:**
- Create: `src/app/api/auth/login/route.ts`
- Create: `src/app/api/me/route.ts`
- Create: `src/app/api/driver/trips/route.ts`
- Create: `src/app/api/driver/trips/[tripId]/route.ts`
- Create: `src/app/api/driver/trips/[tripId]/submit/route.ts`
- Create: `src/app/api/driver/expenses/route.ts`
- Create: `src/app/api/admin/trips/route.ts`
- Create: `src/app/api/admin/trips/[tripId]/review/route.ts`
- Create: `src/app/api/admin/trips/[tripId]/return/route.ts`
- Create: `src/app/api/admin/trips/[tripId]/settle/route.ts`

- [ ] **Step 1: Write API tests for driver field privacy**

The driver trip detail endpoint must not return freight or profit fields.

- [ ] **Step 2: Implement auth guard**

Create a shared request helper that returns the current user from the session cookie and rejects missing users with `401`.

- [ ] **Step 3: Implement driver trip APIs**

Driver list/detail APIs only return trips assigned to the current driver and always strip hidden financial fields.

- [ ] **Step 4: Implement admin trip APIs**

Admin APIs return full trip financial fields, support review start, return with reason, and settlement with actual freight.

- [ ] **Step 5: Add audit log writes**

Write `AuditLog` rows for review start, return, delete expense, edit amount, and settlement.

## Task 5: Driver UI

**Files:**
- Create: `src/app/(driver)/driver/trips/page.tsx`
- Create: `src/app/(driver)/driver/trips/[tripId]/page.tsx`
- Create: `src/app/(driver)/driver/trips/[tripId]/expenses/new/page.tsx`
- Create: `src/components/driver/trip-card.tsx`
- Create: `src/components/driver/expense-form.tsx`
- Create: `src/components/driver/receipt-uploader.tsx`

- [ ] **Step 1: Build trip list**

Render mobile single-column trip cards with plate number, customer, route, status, and next action.

- [ ] **Step 2: Build trip detail**

Render route, note, expenses, receipt status, expense total, and allowed actions. Do not render freight or profit fields.

- [ ] **Step 3: Build expense form**

Fields: expense type, amount, occurred time, note, receipt images. Disable submit when required receipt is missing.

- [ ] **Step 4: Add mobile layout checks**

Run Playwright at 390px width and verify buttons are at least 44px high and no financial hidden fields appear.

## Task 6: Admin UI

**Files:**
- Create: `src/app/(admin)/admin/page.tsx`
- Create: `src/app/(admin)/admin/trips/page.tsx`
- Create: `src/app/(admin)/admin/trips/[tripId]/page.tsx`
- Create: `src/components/admin/admin-shell.tsx`
- Create: `src/components/admin/trip-table.tsx`
- Create: `src/components/admin/trip-review-panel.tsx`

- [ ] **Step 1: Build admin shell**

Use stable left navigation and top user area. Main content uses design tokens from `design/tokens.json`.

- [ ] **Step 2: Build trip table**

Columns: trip no, plate, driver, customer, route, status, created time, submitted time, actual freight, expense total, profit, actions.

- [ ] **Step 3: Build trip review detail**

Show base info, expenses, receipt previews, financial summary, return action, review action, actual freight input, and settle action.

- [ ] **Step 4: Build management tables**

Add vehicles, drivers, expense types, and reports pages with table-first layouts.

## Task 7: End-To-End Verification

**Files:**
- Create: `tests/e2e/driver-submit-trip.spec.ts`
- Create: `tests/e2e/accountant-settle-trip.spec.ts`
- Create: `tests/e2e/driver-privacy.spec.ts`

- [ ] **Step 1: Driver submits a trip**

Seed a driver trip, log in as the driver, add a required-receipt expense, upload a test receipt, submit the trip, and expect status `已提交`.

- [ ] **Step 2: Accountant settles the trip**

Log in as accountant, start review, enter actual freight, complete settlement, and expect profit to be calculated.

- [ ] **Step 3: Driver privacy check**

Log in as driver and assert the page text does not include `预计运费`, `实际运费`, `利润`, or `利润率`.

## Self-Review

- Spec coverage: design system, MVP pages, status machine, finance rules, privacy rules, API boundaries, and verification are covered.
- Placeholder scan: no implementation step relies on undefined future business requirements.
- Scope check: this is a full MVP and should be executed task-by-task. If delivery needs to be shorter, implement Tasks 1-5 first as a driver billing vertical slice, then Tasks 6-7.
