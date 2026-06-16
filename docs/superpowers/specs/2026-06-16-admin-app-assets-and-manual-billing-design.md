# App Admin Assets and Manual Billing Design

## Background

HaulHub already supports a web admin flow for manually entering completed bills. The mobile app admin side currently has five bottom modules: trips, maintenance, expense types, reports, and drivers. The new requirement is to bring completed-bill entry to app admins and add complete vehicle management without increasing the bottom navigation count.

This design keeps existing backend rules and mobile workflows intact. It reuses current admin APIs where possible and adds app-side UI, client mapping, validations, and tests around those APIs.

Note on labels: this document stays ASCII-safe because this Windows workspace has mixed terminal encodings. Implementation must render Simplified Chinese UI labels. Exact labels are recorded below as Unicode code points where needed.

## Goals

- Add app admin manual completed bill entry so admins can record off-system completed transport bills and include them in profit reports.
- Merge driver management and vehicle management under one bottom navigation module labeled `\u8D44\u4EA7` (Assets).
- Provide full mobile vehicle management: list, search, create, edit, status changes, driver binding, and driver unbinding.
- Preserve existing trip, driver, maintenance, expense type, report, and driver-side app behavior.
- Build to enterprise release standard: deterministic validation, clear user feedback, regression tests, linting, build verification, and H5 manual smoke testing.

## Non-Goals

- Do not add receipt image upload to app manual billing in this phase. Receipts remain optional and can be handled later through existing detail/back-office capabilities.
- Do not add a sixth bottom navigation item.
- Do not redesign the whole admin mobile app shell.
- Do not change core backend profit calculation semantics unless a test shows an existing API contract mismatch.

## Navigation Design

### Bottom Navigation

The current bottom item `\u53F8\u673A` (Drivers) becomes `\u8D44\u4EA7` (Assets). Its icon can remain people/asset-oriented or switch to an inventory-style icon if available in the existing Material Symbols font.

The bottom modules remain:

1. Trips
2. Maintenance
3. Expense Types
4. Profit Reports
5. Assets

### Assets Page

`pages/admin/drivers/index` remains the route to minimize routing churn, but its visible page identity changes to `\u8D44\u4EA7\u7BA1\u7406` (Asset Management).

The page has a top segmented control:

- `\u53F8\u673A` (Drivers)
- `\u8F66\u8F86` (Vehicles)

The active tab controls the content below. The existing driver workflow moves under the Drivers tab. The new vehicle workflow lives under the Vehicles tab.

## Manual Completed Billing Design

### Entry

On `pages/admin/trips/index`, the right-top plus button opens an action menu:

- `\u65B0\u589E\u8D9F\u6B21` (New Trip)
- `\u8865\u5F55\u8D26\u5355` (Manual Bill)

New Trip opens the existing create trip sheet. Manual Bill opens a new manual completed bill sheet.

### Form Fields

The manual billing sheet contains:

- Vehicle: required, only available vehicles.
- Driver: required, filtered to active drivers bound to the selected vehicle.
- Customer name: required.
- Actual freight: required money value, max two decimal places.
- Completed/settled date: required date, default today.
- Load location: required text.
- Unload location: required text.
- Accounting note: optional.
- Expense mode:
  - Detail expenses
  - Total expense only

In Detail expenses mode, each row includes:

- Expense type: required enabled expense type.
- Amount: required money value, max two decimal places.
- Occurred date: required date, default completed/settled date.
- Note: optional.

In Total expense only mode:

- Total expense: required money value, max two decimal places.

The current mode is exclusive. Submitting sends only the active mode's expense data.

### Preview

The sheet shows a save-before preview:

- Actual freight
- Expense total
- Estimated profit
- Profit rate

The preview is app-side only and mirrors the web admin calculation:

`profit = actualFreight - expenseTotal`

`profitRate = profit / actualFreight`

When actual freight is zero or invalid, profit rate displays "not calculable" in Simplified Chinese.

### Submit Behavior

The app calls:

`POST /admin/trips/manual-completed`

Payload:

- `vehicleId`
- `driverId`
- `customerName`
- `loadLocation`
- `unloadLocation`
- `actualFreight`
- `settledAt`
- `accountingNote`
- Either `expenses` or `totalExpense`

On success:

- Close the sheet.
- Insert the returned completed trip into the current list when it matches the active filter.
- Show success toast.
- Profit report uses the already implemented backend settlement snapshot and report logic.

### Validation and Feedback

App-side validation blocks invalid submissions before network calls:

- Missing vehicle or driver.
- Driver not bound to selected vehicle.
- Missing customer, load location, unload location.
- Invalid actual freight.
- Expense mode has neither valid detail rows nor valid total.
- Detail rows with missing type, invalid amount, or missing occurred date.

API errors are surfaced through existing `getApiErrorMessage`, so backend messages such as unavailable vehicle, unavailable driver, and binding mismatch remain visible.

## Vehicle Management Design

### Vehicle List

The Vehicles tab includes:

- Summary counters:
  - Vehicle total
  - Available vehicles
  - Maintenance/disabled vehicles
- Search by plate number, vehicle type, brand model, or bound driver name.
- Vehicle cards showing:
  - Plate number
  - Status badge: available / maintenance / disabled, rendered in Simplified Chinese.
  - Vehicle type and brand model
  - Bound drivers
  - Active trip count or operational hint when available from API
  - Expiry hints for insurance, inspection, or maintenance due date when data exists

### Create/Edit Sheet

Vehicle sheet fields:

- Plate number: required.
- Vehicle type: optional.
- Brand/model: optional.
- Load capacity in tons: optional decimal.
- Registered date: optional date.
- Insurance expiry date: optional date.
- Inspection expiry date: optional date.
- Next maintenance date: optional date.
- Vehicle image URL: optional text, reusing current API shape.
- Note: optional.
- Status: visible on edit only, values `available`, `maintenance`, and `disabled`.

Create calls:

`POST /admin/vehicles`

Edit calls:

`POST /admin/vehicles/:vehicleId`

### Driver Binding in Vehicle Sheet

When editing an existing vehicle, show a binding panel:

- Current bound drivers, with unbind actions.
- Picker of active drivers not already bound.
- Bind action.

Binding calls:

- `POST /admin/vehicles/:vehicleId/drivers`
- `POST /admin/vehicles/:vehicleId/drivers/:driverId/unbind`

The existing driver-side binding panel remains available under the Drivers tab. Both panels refresh shared driver and vehicle lists after changes.

### Vehicle Validation and Feedback

App-side validation:

- Plate number required.
- Load capacity must be blank or a non-negative decimal.
- Date fields must be blank or valid picker values.
- Status required on edit.
- Bind driver requires an active driver selection.

Backend validation and uniqueness errors are shown through existing API error handling.

## Client Data Model

`apps/driver-uni/src/api/client.ts` should expose app admin vehicle APIs with typed models:

- `AdminVehicle`
- `AdminVehicleDriver`
- `fetchAdminVehicles`
- `createAdminVehicle`
- `updateAdminVehicle`
- `bindAdminVehicleDriver`
- `unbindAdminVehicleDriver`

Existing `AdminVehicleOption` may be retained for simple pickers, but the new vehicle tab should use the richer vehicle model returned by `/admin/vehicles`.

Manual billing APIs and model helpers should be isolated from page UI:

- `createAdminManualCompletedTrip`
- preview helpers for expense totals, profit, profit rate
- validation helpers for manual billing form state
- validation helpers for vehicle form state

These helpers are tested without depending on the Uni runtime.

## UI Standards

- Keep the existing mobile admin visual language: compact cards, bottom sheets, segmented controls, icon buttons, and restrained blue/neutral palette.
- Avoid adding marketing-style sections or decorative-only graphics.
- Keep forms scrollable with fixed bottom-safe-area padding.
- Use segmented controls for the Assets Drivers/Vehicles tabs and manual billing detail/total expense mode.
- Use clear empty states and disabled button states.
- Long text must wrap or ellipsize within cards; buttons must not overflow on narrow devices.

## Testing Strategy

### Unit Tests

Add tests under `apps/driver-uni/src` for pure helpers:

- Manual billing preview calculates freight, expenses, profit, and profit rate.
- Manual billing validation rejects missing required fields.
- Manual billing validation enforces exclusive detail-vs-total expense modes.
- Driver filtering returns only active drivers bound to the selected vehicle.
- Vehicle form validation rejects missing plate and invalid capacity.
- Vehicle binding picker excludes already-bound drivers.

### API Regression Tests

Backend endpoints already have coverage for manual completed billing and vehicle management. Add or adjust API tests only if app implementation reveals a missing contract or serializer gap.

### Full Verification

Before completion:

- `npm --workspace apps/driver-uni run test`
- `npm --workspace apps/driver-uni run lint`
- `npm --workspace apps/driver-uni run build:h5`
- `npm test`
- `npm run lint`

### Manual H5 Smoke Test

Run driver H5 and verify:

1. Admin can open Trips, tap plus, choose Manual Bill.
2. Selecting a vehicle filters drivers.
3. Detail expense mode previews correct profit.
4. Total expense mode previews correct profit.
5. Invalid submission shows user-facing feedback.
6. Successful manual billing creates a completed trip and appears in reports.
7. Bottom nav shows the Simplified Chinese label for Assets.
8. Assets page switches between Drivers and Vehicles.
9. Vehicle create/edit/status/bind/unbind flows work without breaking existing driver flows.

## Rollout Notes

- Because this is mobile app admin functionality, H5 build verification is required before release.
- If packaging for mini program or native app is part of the release train, run the existing platform build after H5 passes.
- No database migration is expected for this scope.
- Existing dirty local files and logs must not be reverted or bundled into feature commits unless they are intentionally part of this release.

