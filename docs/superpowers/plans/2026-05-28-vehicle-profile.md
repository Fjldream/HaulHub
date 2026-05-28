# Vehicle Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the admin vehicle management area into a production-ready vehicle operation profile with richer vehicle fields, dynamic list status, KPI cards, an archive card, and a trip/maintenance timeline.

**Architecture:** Extend the existing SQLite/Prisma vehicle model with optional archive fields, expose them through the existing admin vehicle API, and compute detail-page KPIs in the Next.js server page from existing trips and maintenance records. Keep image upload out of scope for now by storing an optional image URL and using a stable truck placeholder when empty.

**Tech Stack:** Prisma, Fastify API, Next.js App Router server components, existing admin CSS and lucide-react.

---

### Task 1: Vehicle Data Fields

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260528000000_vehicle_profile_fields/migration.sql`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/admin-web/src/lib/api-client.ts`

- [ ] Add optional vehicle fields: `brandModel`, `loadCapacityTons`, `registeredAt`, `insuranceExpiresAt`, `inspectionExpiresAt`, `maintenanceDueAt`, `imageUrl`.
- [ ] Update vehicle serializer and create/update validation to pass those fields through.
- [ ] Update admin-web `ApiVehicle` type.
- [ ] Run API lint and a Prisma generate check.

### Task 2: Vehicle Forms

**Files:**
- Modify: `apps/admin-web/src/app/vehicles/new/page.tsx`
- Modify: `apps/admin-web/src/app/vehicles/[vehicleId]/page.tsx`

- [ ] Add the new archive fields to the create action and new vehicle form.
- [ ] Move vehicle editing on the detail page into a compact archive panel with the extended fields.

### Task 3: Vehicle List UI

**Files:**
- Modify: `apps/admin-web/src/app/vehicles/page.tsx`
- Modify: `apps/admin-web/src/app/globals.css`

- [ ] Show list tabs for all, idle, transporting, and maintenance.
- [ ] Compute idle/transporting from unfinished trip count returned by the API.
- [ ] Show vehicle brand/model, load capacity, driver, maintenance due date, maintenance reminders, and the retained promotional card.

### Task 4: Vehicle Profile Detail UI

**Files:**
- Modify: `apps/admin-web/src/app/vehicles/[vehicleId]/page.tsx`
- Modify: `apps/admin-web/src/app/globals.css`

- [ ] Compute current-month trip count, total maintenance cost, total profit, status counts, and timeline rows from existing trips and maintenance.
- [ ] Build the detail page with top metrics, truck image card, archive info, health placeholder, timeline, driver binding, and recent maintenance.
- [ ] Add responsive CSS so the layout remains usable on narrow screens.
- [ ] Run admin build and manually request the vehicle page.
