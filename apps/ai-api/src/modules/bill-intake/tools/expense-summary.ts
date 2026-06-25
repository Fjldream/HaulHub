/**
 * 将模型识别到的金额文本转换为数字。
 *
 * 无法转换时返回 null，让上层校验或会计确认处理。
 */
function toAmount(value: string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * 将金额数字格式化为两位小数字符串。
 */
function money(value: number) {
  return value.toFixed(2);
}

/**
 * 计算费用明细合计，并检查识别到的总费用是否与明细冲突。
 *
 * 冲突时不替会计做决定，而是返回 `needs_review`，交给工作台提示会计选择。
 */
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
