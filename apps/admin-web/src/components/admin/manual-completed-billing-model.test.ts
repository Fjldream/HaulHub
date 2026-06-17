import { describe, expect, it } from "vitest";
import {
  calculateManualBillingPreview,
  isMoneyDraft,
  manualBillingPayload,
  type ManualBillingExpenseRow,
} from "./manual-completed-billing-model";

const expenseRows: ManualBillingExpenseRow[] = [
  {
    id: "row-1",
    expenseTypeId: "expense-type-1",
    amount: "100.10",
    occurredAt: "2026-05-20",
    note: "Fuel",
  },
  {
    id: "row-2",
    expenseTypeId: "expense-type-2",
    amount: "20.20",
    occurredAt: "2026-05-20",
    note: "Toll",
  },
];

describe("manual completed billing model", () => {
  it("calculates preview totals from detailed expenses", () => {
    expect(calculateManualBillingPreview("500.00", "details", expenseRows, "")).toEqual({
      actualFreight: "500.00",
      expenseTotal: "120.30",
      profit: "379.70",
      profitRate: "0.7594",
    });
  });

  it("calculates preview totals from total expense mode", () => {
    expect(calculateManualBillingPreview("500.00", "total", expenseRows, "77.77").expenseTotal).toBe(
      "77.77",
    );
  });

  it("returns null profit rate when freight is zero", () => {
    expect(calculateManualBillingPreview("0", "total", [], "10").profitRate).toBeNull();
  });

  it("defaults blank preview inputs to zero", () => {
    expect(
      calculateManualBillingPreview(
        "",
        "details",
        [{ id: "row-blank", expenseTypeId: "expense-type-1", amount: "", occurredAt: "", note: "" }],
        "",
      ),
    ).toEqual({
      actualFreight: "0",
      expenseTotal: "0.00",
      profit: "0.00",
      profitRate: null,
    });
  });

  it("does not throw when preview inputs contain invalid money text", () => {
    expect(calculateManualBillingPreview("m", "details", expenseRows, "")).toEqual({
      actualFreight: null,
      expenseTotal: null,
      profit: null,
      profitRate: null,
    });

    expect(
      calculateManualBillingPreview(
        "500.00",
        "details",
        [{ ...expenseRows[0], amount: "m" }],
        "",
      ),
    ).toMatchObject({
      actualFreight: "500.00",
      expenseTotal: null,
      profit: null,
      profitRate: null,
    });
  });

  it("allows only money draft text while the user is typing", () => {
    expect(isMoneyDraft("")).toBe(true);
    expect(isMoneyDraft("120")).toBe(true);
    expect(isMoneyDraft("120.3")).toBe(true);
    expect(isMoneyDraft("120.30")).toBe(true);
    expect(isMoneyDraft(".")).toBe(true);
    expect(isMoneyDraft("120.300")).toBe(false);
    expect(isMoneyDraft("m")).toBe(false);
    expect(isMoneyDraft("12m")).toBe(false);
  });

  it("only serializes the active expense mode", () => {
    expect(manualBillingPayload("details", expenseRows, "77.77")).toEqual({
      expenses: [
        { expenseTypeId: "expense-type-1", amount: "100.10", occurredAt: "2026-05-20", note: "Fuel" },
        { expenseTypeId: "expense-type-2", amount: "20.20", occurredAt: "2026-05-20", note: "Toll" },
      ],
    });
    expect(manualBillingPayload("total", expenseRows, "77.77")).toEqual({
      totalExpense: { amount: "77.77" },
    });
    expect(manualBillingPayload("total", expenseRows, "77.77", "Only total available")).toEqual({
      totalExpense: { amount: "77.77", note: "Only total available" },
    });
  });
});
