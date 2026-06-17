import { describe, expect, it } from "vitest";
import {
  buildProfitExportHeaders,
  buildProfitExportQuery,
} from "./profit-export-route-model";
import type { AdminSession } from "@/lib/admin-session";

const session: AdminSession = {
  userId: "user-1",
  role: "administrator",
  name: "Admin",
  teamId: "team-legacy",
  teamName: "Legacy Team",
  activeTeamId: "team-active",
  activeTeamName: "Active Team",
};

describe("profit export route model", () => {
  it("falls back from invalid export dates", () => {
    const query = buildProfitExportQuery(
      new URLSearchParams("from=abc&to=bad&period=week"),
      new Date(2026, 5, 17),
    );

    expect(query).toBe("from=2026-06-01&to=2026-06-17&period=week");
  });

  it("falls back from impossible export calendar dates", () => {
    const query = buildProfitExportQuery(
      new URLSearchParams("from=2026-02-31&to=2026-06-17&period=year"),
      new Date(2026, 5, 17),
    );

    expect(query).toBe("from=2026-06-01&to=2026-06-17&period=year");
  });

  it("normalizes reversed export date ranges", () => {
    const query = buildProfitExportQuery(
      new URLSearchParams("from=2026-06-17&to=2026-06-01&period=month"),
      new Date(2026, 5, 17),
    );

    expect(query).toBe("from=2026-06-01&to=2026-06-17&period=month");
  });

  it("falls back from invalid export periods", () => {
    const query = buildProfitExportQuery(
      new URLSearchParams("from=2026-06-01&to=2026-06-17&period=quarter"),
      new Date(2026, 5, 17),
    );

    expect(query).toBe("from=2026-06-01&to=2026-06-17&period=month");
  });

  it("includes the active team header for scoped export API calls", () => {
    expect(buildProfitExportHeaders(session)).toEqual({
      "x-user-id": "user-1",
      "x-user-role": "administrator",
      "x-team-id": "team-active",
    });
  });
});
