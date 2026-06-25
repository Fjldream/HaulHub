import type { ExpenseTypeContext } from "./context";

/**
 * 根据原始费用名称匹配系统费用类型。
 *
 * 匹配不到时不会自动创建费用类型，而是归到已有“其他”类型，并保留原始费用名。
 */
export function matchExpenseType(input: { originalName: string; expenseTypes: ExpenseTypeContext[] }) {
  const originalName = input.originalName.trim();
  const enabledTypes = input.expenseTypes.filter((type) => type.enabled);
  const exact = enabledTypes.find((type) => type.name === originalName);
  if (exact) {
    return {
      expenseTypeId: exact.id,
      expenseTypeName: exact.name,
      confidence: "high" as const,
      note: "",
      needsReview: false,
    };
  }

  const fuzzy = enabledTypes.find((type) => originalName.includes(type.name) || type.name.includes(originalName));
  if (fuzzy) {
    return {
      expenseTypeId: fuzzy.id,
      expenseTypeName: fuzzy.name,
      confidence: "medium" as const,
      note: "",
      needsReview: true,
    };
  }

  const other = enabledTypes.find((type) => type.name === "其他") ?? enabledTypes[0];
  return {
    expenseTypeId: other?.id ?? "",
    expenseTypeName: other?.name ?? "其他",
    confidence: "low" as const,
    note: `原始费用名：${originalName}`,
    needsReview: true,
  };
}
