import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isNavChildActive, isNavItemActive } from "./admin-nav-model";

describe("AdminShellClient logout control", () => {
  it("does not expose logout as an auto-submittable HTML form", () => {
    const source = readFileSync(
      path.resolve(__dirname, "admin-shell-client.tsx"),
      "utf8",
    );

    expect(source).not.toContain('action="/login/logout"');
    expect(source).toContain('type="button"');
  });
});

describe("admin navigation active state", () => {
  it("keeps the reports overview child exact while the reports parent stays active", () => {
    expect(isNavItemActive("/reports", "/reports/monthly")).toBe(true);
    expect(isNavChildActive("/reports", "/reports/monthly")).toBe(false);
    expect(isNavChildActive("/reports/monthly", "/reports/monthly")).toBe(true);
  });

  it("keeps driver archive separate from payroll child pages", () => {
    expect(isNavItemActive("/drivers", "/drivers/payroll/record-1")).toBe(true);
    expect(isNavChildActive("/drivers", "/drivers/payroll/record-1")).toBe(false);
    expect(isNavChildActive("/drivers/payroll", "/drivers/payroll/record-1")).toBe(true);
    expect(isNavChildActive("/drivers", "/drivers/new")).toBe(true);
    expect(isNavChildActive("/drivers", "/drivers/driver-1")).toBe(true);
  });

  it("does not mark vehicle archive active for maintenance pages", () => {
    expect(isNavItemActive("/vehicles", "/vehicles/maintenance")).toBe(false);
    expect(isNavItemActive("/vehicles/maintenance", "/vehicles/maintenance/record-1")).toBe(true);
  });
});
