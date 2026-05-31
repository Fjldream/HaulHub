import { describe, expect, it } from "vitest";
import { adminSessionMaxAgeSeconds } from "./admin-session";

describe("admin session cookie", () => {
  it("keeps logged-in admins signed in for at least 30 days", () => {
    expect(adminSessionMaxAgeSeconds).toBeGreaterThanOrEqual(60 * 60 * 24 * 30);
  });
});
