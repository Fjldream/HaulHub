import {
  calculateExpenseTotal,
  calculateProfit,
  calculateProfitRate,
} from "@haulhub/shared";

export type ManualBillingExpenseMode = "details" | "total";

export interface ManualBillingExpenseRow {
  id: string;
  expenseTypeId: string;
  amount: string;
  occurredAt: string;
  note: string;
}

export function calculateManualBillingPreview(
  actualFreight: string,
  mode: ManualBillingExpenseMode,
  expenses: ManualBillingExpenseRow[],
  totalExpense: string,
) {
  const freight = actualFreight || "0";
  const expenseTotal =
    mode === "details"
      ? calculateExpenseTotal(expenses.map((expense) => expense.amount || "0"))
      : calculateExpenseTotal([totalExpense || "0"]);
  const profit = calculateProfit(freight, expenseTotal);

  return {
    actualFreight: freight,
    expenseTotal,
    profit,
    profitRate: calculateProfitRate(freight, profit),
  };
}

export function manualBillingPayload(
  mode: ManualBillingExpenseMode,
  expenses: ManualBillingExpenseRow[],
  totalExpense: string,
  totalExpenseNote = "",
) {
  if (mode === "details") {
    return {
      expenses: expenses.map((expense) => ({
        expenseTypeId: expense.expenseTypeId,
        amount: expense.amount,
        occurredAt: expense.occurredAt,
        note: expense.note,
      })),
    };
  }

  return {
    totalExpense: {
      amount: totalExpense,
      ...(totalExpenseNote ? { note: totalExpenseNote } : {}),
    },
  };
}
