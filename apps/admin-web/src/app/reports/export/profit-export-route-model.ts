import { buildProfitOverviewRange } from "@/components/admin/profit-report-model";
import type { AdminSession } from "@/lib/admin-session";

const profitExportPeriods = ["week", "month", "year"] as const;

type ProfitExportPeriod = (typeof profitExportPeriods)[number];

function normalizeProfitExportPeriod(value: string | null): ProfitExportPeriod {
  const period = value?.trim();
  return profitExportPeriods.some((allowedPeriod) => allowedPeriod === period)
    ? (period as ProfitExportPeriod)
    : "month";
}

export function buildProfitExportQuery(searchParams: URLSearchParams, now = new Date()) {
  const { from, to } = buildProfitOverviewRange(
    searchParams.get("from") ?? undefined,
    searchParams.get("to") ?? undefined,
    now,
  );
  const query = new URLSearchParams();
  query.set("from", from);
  query.set("to", to);
  query.set("period", normalizeProfitExportPeriod(searchParams.get("period")));

  return query.toString();
}

export function buildProfitExportHeaders(
  session: Pick<AdminSession, "userId" | "role" | "activeTeamId">,
) {
  return {
    "x-user-id": session.userId,
    "x-user-role": session.role,
    ...(session.activeTeamId ? { "x-team-id": session.activeTeamId } : {}),
  };
}
