import { describe, expect, it } from "vitest";
import {
  calculateExpenseTotal,
  calculateProfit,
  calculateProfitRate,
  formatCny,
} from "../src/trips/finance";

describe("finance helpers", () => {
  it("calculates expense totals with decimal-safe arithmetic", () => {
    expect(calculateExpenseTotal(["0.10", "0.20", "15"])).toBe("15.30");
  });

  it("calculates positive profit", () => {
    expect(calculateProfit("1000.00", "650.50")).toBe("349.50");
  });

  it("calculates negative profit", () => {
    expect(calculateProfit("500.00", "650.50")).toBe("-150.50");
  });

  it("returns null profit rate when actual freight is zero", () => {
    expect(calculateProfitRate("0", "100")).toBeNull();
  });

  it("formats CNY with two decimals", () => {
    expect(formatCny("12")).toBe("¥12.00");
    expect(formatCny("12.345")).toBe("¥12.35");
  });
});
