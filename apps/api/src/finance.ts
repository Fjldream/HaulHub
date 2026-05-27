import {
  calculateExpenseTotal,
  calculateProfit,
  calculateProfitRate,
} from "@haulhub/shared";

export function calculateSettlement(actualFreight: string, expenseAmounts: string[]) {
  const expenseTotal = calculateExpenseTotal(expenseAmounts);
  const profit = calculateProfit(actualFreight, expenseTotal);
  const profitRate = calculateProfitRate(actualFreight, profit);

  return {
    actualFreight,
    expenseTotal,
    profit,
    profitRate,
  };
}
