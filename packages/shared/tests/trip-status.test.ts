import { describe, expect, it } from "vitest";
import {
  assertTripStatusTransition,
  canTransitionTripStatus,
} from "../src/trips/status";

describe("trip status transitions", () => {
  it("allows the normal settlement flow", () => {
    expect(canTransitionTripStatus("assigned", "in_progress")).toBe(true);
    expect(canTransitionTripStatus("in_progress", "submitted")).toBe(true);
    expect(canTransitionTripStatus("submitted", "under_review")).toBe(true);
    expect(canTransitionTripStatus("under_review", "completed")).toBe(true);
  });

  it("allows returned trips to be resubmitted", () => {
    expect(canTransitionTripStatus("under_review", "returned")).toBe(true);
    expect(canTransitionTripStatus("returned", "submitted")).toBe(true);
  });

  it("rejects invalid direct transitions", () => {
    expect(canTransitionTripStatus("assigned", "completed")).toBe(false);
    expect(() => assertTripStatusTransition("assigned", "completed")).toThrow(
      "Invalid trip status transition: assigned -> completed",
    );
  });
});
