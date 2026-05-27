import Decimal from "decimal.js";

function toMoney(value: string): Decimal {
  return new Decimal(value || "0");
}

function formatDecimal(value: Decimal): string {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

export function calculateExpenseTotal(amounts: string[]): string {
  return formatDecimal(
    amounts.reduce((total, amount) => total.plus(toMoney(amount)), new Decimal(0)),
  );
}

export function calculateProfit(
  actualFreight: string,
  expenseTotal: string,
): string {
  return formatDecimal(toMoney(actualFreight).minus(toMoney(expenseTotal)));
}

export function calculateProfitRate(
  actualFreight: string,
  profit: string,
): string | null {
  const freight = toMoney(actualFreight);
  if (freight.isZero()) {
    return null;
  }

  return toMoney(profit)
    .div(freight)
    .toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
    .toFixed(4);
}

export function formatCny(amount: string): string {
  return `¥${formatDecimal(toMoney(amount))}`;
}
