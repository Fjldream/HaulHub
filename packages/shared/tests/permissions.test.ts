import { describe, expect, it } from "vitest";
import {
  canAccountantReviewTrip,
  canDriverEditTrip,
  stripDriverHiddenFields,
} from "../src/auth/permissions";

describe("permission helpers", () => {
  it("strips fields that must never appear in driver-facing records", () => {
    const visibleRecord = stripDriverHiddenFields({
      id: "trip-1",
      customerName: "恒通物流",
      estimatedFreight: "1200.00",
      actualFreight: "1180.00",
      profit: "360.00",
      profitRate: "0.3051",
      businessReports: [],
    });

    expect(visibleRecord).toEqual({
      id: "trip-1",
      customerName: "恒通物流",
    });
  });

  it("allows driver edits only before accountant review locks the trip", () => {
    expect(canDriverEditTrip("in_progress")).toBe(true);
    expect(canDriverEditTrip("submitted")).toBe(true);
    expect(canDriverEditTrip("returned")).toBe(true);
    expect(canDriverEditTrip("under_review")).toBe(false);
    expect(canDriverEditTrip("completed")).toBe(false);
  });

  it("allows accountant review for submitted and reviewing trips", () => {
    expect(canAccountantReviewTrip("submitted")).toBe(true);
    expect(canAccountantReviewTrip("under_review")).toBe(true);
    expect(canAccountantReviewTrip("assigned")).toBe(false);
  });
});
