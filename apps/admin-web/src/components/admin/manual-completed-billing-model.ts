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

const moneyDraftPattern = /^\d*(?:\.\d{0,2})?$/;

export function isMoneyDraft(value: string) {
  return moneyDraftPattern.test(value.trim());
}

function previewMoney(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "0";
  if (!isMoneyDraft(trimmed) || trimmed === ".") return null;
  return trimmed.endsWith(".") ? `${trimmed}0` : trimmed;
}

export function calculateManualBillingPreview(
  actualFreight: string,
  mode: ManualBillingExpenseMode,
  expenses: ManualBillingExpenseRow[],
  totalExpense: string,
) {
  const freight = previewMoney(actualFreight);
  if (freight == null) {
    return {
      actualFreight: null,
      expenseTotal: null,
      profit: null,
      profitRate: null,
    };
  }

  const expenseAmounts =
    mode === "details"
      ? expenses.map((expense) => previewMoney(expense.amount))
      : [previewMoney(totalExpense)];
  const validExpenseAmounts: string[] = [];
  for (const amount of expenseAmounts) {
    if (amount == null) {
      return {
        actualFreight: freight,
        expenseTotal: null,
        profit: null,
        profitRate: null,
      };
    }
    validExpenseAmounts.push(amount);
  }

  if (validExpenseAmounts.length === 0) {
    return {
      actualFreight: freight,
      expenseTotal: null,
      profit: null,
      profitRate: null,
    };
  }

  const expenseTotal = calculateExpenseTotal(validExpenseAmounts);
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
