import type { TripStatus } from "../trips/status";

const driverHiddenFields = [
  "estimatedFreight",
  "actualFreight",
  "profit",
  "profitRate",
  "businessReports",
] as const;

type DriverHiddenField = (typeof driverHiddenFields)[number];

export function stripDriverHiddenFields<T extends Record<string, unknown>>(
  record: T,
): Omit<T, DriverHiddenField> {
  const stripped = { ...record };

  for (const field of driverHiddenFields) {
    delete stripped[field];
  }

  return stripped;
}

export function canDriverEditTrip(status: TripStatus): boolean {
  return status === "in_progress" || status === "submitted" || status === "returned";
}

export function canAccountantReviewTrip(status: TripStatus): boolean {
  return status === "submitted" || status === "under_review";
}
