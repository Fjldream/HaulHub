import { describe, expect, it } from "vitest";
import { driverTripTabs, tripStatusFilterForTab } from "./trip-list-model";

describe("driver trip list model", () => {
  it("shows all as the first tab and does not show completed as a separate tab", () => {
    expect(driverTripTabs.map((tab) => tab.key)).toEqual(["all", "assigned", "in_progress", "submitted"]);
    expect(driverTripTabs[0]).toEqual({ key: "all", label: "全部" });
  });

  it("does not send a status filter for the all tab", () => {
    expect(tripStatusFilterForTab("all")).toBeUndefined();
    expect(tripStatusFilterForTab("assigned")).toBe("assigned");
    expect(tripStatusFilterForTab("in_progress")).toBe("in_progress");
    expect(tripStatusFilterForTab("submitted")).toBe("submitted");
  });
});
