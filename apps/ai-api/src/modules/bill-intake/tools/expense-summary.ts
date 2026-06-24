function toAmount(value: string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function money(value: number) {
  return value.toFixed(2);
}

export function calculateExpenseSummary(input: {
  expenses: Array<{ originalName: string; amount: string }>;
  totalExpense?: string | null;
}) {
  const detailTotalNumber = input.expenses.reduce((sum, expense) => sum + (toAmount(expense.amount) ?? 0), 0);
  const detailTotal = money(detailTotalNumber);
  const totalExpenseNumber = toAmount(input.totalExpense);
  const totalExpense = totalExpenseNumber == null ? null : money(totalExpenseNumber);
  const warnings: string[] = [];
  let suggestedMode: "details" | "total" | "needs_review" = input.expenses.length > 0 ? "details" : "total";

  if (totalExpense != null && input.expenses.length > 0 && totalExpense !== detailTotal) {
    warnings.push(`费用明细合计 ${detailTotal} 与识别到的总费用 ${totalExpense} 不一致，请会计确认使用哪一种。`);
    suggestedMode = "needs_review";
  }

  return {
    detailTotal,
    totalExpense,
    suggestedMode,
    warnings,
  };
}
