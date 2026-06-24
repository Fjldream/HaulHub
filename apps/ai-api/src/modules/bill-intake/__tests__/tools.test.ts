import { describe, expect, it } from "vitest";
import {
  calculateExpenseSummary,
  matchDriver,
  matchExpenseType,
  matchVehicle,
  validateDraftForReview,
} from "../tools";

const expenseTypes = [
  { id: "expense-fuel", name: "油费", enabled: true },
  { id: "expense-other", name: "其他", enabled: true },
];

describe("bill intake tools", () => {
  it("matches unknown expense names to other and preserves the original name", () => {
    expect(matchExpenseType({ originalName: "压车费", expenseTypes })).toEqual({
      expenseTypeId: "expense-other",
      expenseTypeName: "其他",
      confidence: "low",
      note: "原始费用名：压车费",
      needsReview: true,
    });
  });

  it("matches an exact plate number uniquely", () => {
    expect(
      matchVehicle({
        plateNumber: "闽A12345",
        vehicles: [
          { id: "vehicle-1", plateNumber: "闽A12345", status: "available" },
          { id: "vehicle-2", plateNumber: "闽A54321", status: "available" },
        ],
      }),
    ).toMatchObject({
      bestMatchId: "vehicle-1",
      confidence: "high",
      unique: true,
    });
  });

  it("prefers a driver bound to the matched vehicle", () => {
    expect(
      matchDriver({
        driverName: "老王",
        vehicleId: "vehicle-1",
        drivers: [
          { id: "driver-1", name: "老王", status: "active", boundVehicleIds: ["vehicle-1"] },
          { id: "driver-2", name: "老王", status: "active", boundVehicleIds: ["vehicle-2"] },
        ],
      }),
    ).toMatchObject({
      bestMatchId: "driver-1",
      confidence: "medium",
      unique: true,
      boundToVehicle: true,
    });
  });

  it("detects detail total and recognized total conflicts", () => {
    expect(
      calculateExpenseSummary({
        expenses: [
          { originalName: "油费", amount: "300.00" },
          { originalName: "过路费", amount: "120.00" },
        ],
        totalExpense: "500.00",
      }),
    ).toEqual({
      detailTotal: "420.00",
      totalExpense: "500.00",
      suggestedMode: "needs_review",
      warnings: ["费用明细合计 420.00 与识别到的总费用 500.00 不一致，请会计确认使用哪一种。"],
    });
  });

  it("asks review questions for missing required fields", () => {
    expect(
      validateDraftForReview({
        vehicle: { value: null, confidence: "low", needsReview: true },
        driver: { value: "老王", confidence: "low", needsReview: true },
        customerName: { value: "", confidence: "low", needsReview: true },
        loadLocation: { value: "福州", confidence: "medium", needsReview: true },
        unloadLocation: { value: null, confidence: "low", needsReview: true },
        actualFreight: { value: "1800.00", confidence: "high", needsReview: false },
        settledAt: { value: "2026-06-22", confidence: "high", needsReview: false },
        expenseModeSuggestion: "details",
        expenses: [],
      }).questions.map((item) => item.field),
    ).toEqual(["vehicle", "driver", "customerName", "loadLocation", "unloadLocation", "expenses"]);
  });
});
