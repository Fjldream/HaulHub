export type TripStatus =
  | "assigned"
  | "in_progress"
  | "submitted"
  | "under_review"
  | "completed"
  | "returned"
  | "cancelled";

const allowedTransitions: Record<TripStatus, readonly TripStatus[]> = {
  assigned: ["in_progress", "cancelled"],
  in_progress: ["submitted"],
  submitted: ["under_review"],
  under_review: ["completed", "returned"],
  completed: [],
  returned: ["submitted"],
  cancelled: [],
};

export function canTransitionTripStatus(
  from: TripStatus,
  to: TripStatus,
): boolean {
  return allowedTransitions[from].includes(to);
}

export function assertTripStatusTransition(
  from: TripStatus,
  to: TripStatus,
): void {
  if (!canTransitionTripStatus(from, to)) {
    throw new Error(`Invalid trip status transition: ${from} -> ${to}`);
  }
}
