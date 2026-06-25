import type { AiBillDraftPayload, ReviewQuestion } from "../domain/types";

/**
 * 对 AI 草稿做确定性复核，生成会计必须确认的问题。
 *
 * 这一步是模型输出后的保护层：即使模型没有主动提问，缺失或冲突字段也会在这里被拦出来。
 */
export function validateDraftForReview(draft: AiBillDraftPayload) {
  const questions: ReviewQuestion[] = [];
  const add = (field: string, message: string, severity: "required" | "warning" = "required") => {
    questions.push({ field, message, severity });
  };

  if (!draft.vehicle.matchedVehicleId) add("vehicle", "请选择车辆。");
  if (!draft.driver.matchedDriverId) add("driver", "请选择司机。");
  if (!draft.customerName.value?.trim()) add("customerName", "请填写客户名称。");
  if (!draft.loadLocation.value?.trim() || draft.loadLocation.needsReview) add("loadLocation", "请确认装货地。");
  if (!draft.unloadLocation.value?.trim()) add("unloadLocation", "请填写卸货地。");
  if (!draft.actualFreight.value?.trim()) add("actualFreight", "请填写实际运费。");
  if (!draft.settledAt.value?.trim()) add("settledAt", "请选择完成/结算日期。");
  if (draft.expenseModeSuggestion === "details" && draft.expenses.length === 0) {
    add("expenses", "请补充费用明细或切换为总费用。");
  }
  if (draft.expenseModeSuggestion === "needs_review") {
    add("expenseMode", "费用明细和总费用存在冲突，请选择一种录入方式。");
  }

  return {
    questions,
    warnings: questions.filter((question) => question.severity === "warning").map((question) => question.message),
    readyForReview: true,
    blocksSubmit: questions.filter((question) => question.severity === "required").map((question) => question.field),
  };
}
