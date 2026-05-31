import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

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
