import type { HaulHubApiClient } from "../../../clients/haulhub-api-client";
import type { AgentProvider } from "../providers/agent-provider";
import { createBillIntakeTools } from "./tool-registry";
import { matchDriver, matchExpenseType, matchVehicle, validateDraftForReview } from "../tools";
import {
  aiBillDraftPayloadSchema,
  billIntakeInputSchema,
  billIntakeResultSchema,
  type AiBillDraftPayload,
  type BillIntakeInput,
  type BillIntakeResult,
} from "../domain/schemas";

/**
 * 判断指定工具是否在本轮 Agent 执行中成功调用过。
 *
 * @param result Agent Provider 返回的识别结果。
 * @param toolName 需要检查的工具名称。
 * @returns 工具存在成功调用记录时返回 true，否则返回 false。
 */
function hasSuccessfulToolCall(result: BillIntakeResult, toolName: string) {
  return result.toolTrace.some((item) => item.name === toolName && item.status === "success");
}

/**
 * 根据工具调用轨迹生成后端最低工具链校验 warning。
 *
 * 这里不把工具链写死成阻断流程，只提示模型是否跳过了关键确定性工具；最终仍然返回草稿给会计确认。
 *
 * @param result Agent Provider 返回的识别结果。
 * @returns 需要追加到结果中的工具链 warning。
 */
function createToolTraceWarnings(result: BillIntakeResult) {
  const warnings: string[] = [];
  if (result.toolTrace.length === 0) {
    warnings.push("Agent 未调用任何确定性工具，请重点复核 get_team_billing_context 和 validate_draft_for_review 是否被跳过。");
    return warnings;
  }

  if (!hasSuccessfulToolCall(result, "get_team_billing_context")) {
    warnings.push("Agent 未成功调用 get_team_billing_context，车辆、司机和费用类型匹配可能缺少团队上下文。");
  }
  if (!hasSuccessfulToolCall(result, "validate_draft_for_review")) {
    warnings.push("Agent 未成功调用 validate_draft_for_review，后端已执行确定性复核，但需要关注模型是否跳过最终校验。");
  }
  if (result.draftPayload.vehicle.value && !hasSuccessfulToolCall(result, "match_vehicle")) {
    warnings.push("Agent 识别到了车辆信息，但未成功调用 match_vehicle。");
  }
  if (result.draftPayload.driver.value && !hasSuccessfulToolCall(result, "match_driver")) {
    warnings.push("Agent 识别到了司机信息，但未成功调用 match_driver。");
  }
  if (result.draftPayload.expenses.length > 0 && !hasSuccessfulToolCall(result, "match_expense_type")) {
    warnings.push("Agent 识别到了费用明细，但未成功调用 match_expense_type。");
  }

  for (const item of result.toolTrace) {
    if (item.status === "error") {
      warnings.push(`Agent 工具 ${item.name} 调用失败：${item.error ?? "未知错误"}`);
    }
  }

  return warnings;
}

/**
 * 判断草稿是否存在可以用确定性工具补齐的匹配缺口。
 *
 * @param draft Provider 返回的账单草稿。
 * @returns 草稿存在车牌、司机或费用名但缺少系统 ID 时返回 true。
 */
function needsDeterministicMatchBackfill(draft: AiBillDraftPayload) {
  return Boolean(
    (draft.vehicle.value && !draft.vehicle.matchedVehicleId) ||
      (draft.driver.value && !draft.driver.matchedDriverId) ||
      draft.expenses.some((expense) => expense.originalName && !expense.matchedExpenseTypeId),
  );
}

/**
 * 账单识别 Agent 的业务编排层。
 *
 * Workflow 负责把模型 Provider、工具注册表和确定性复核组合起来。它不直接创建正式账单，
 * 只返回待会计确认的草稿和问题清单。
 */
export class BillIntakeWorkflow {
  constructor(
    private readonly options: {
      provider: AgentProvider;
      apiClient: HaulHubApiClient;
    },
  ) {}

  /**
   * 用确定性匹配工具补齐 Provider 漏填的车辆、司机和费用类型 ID。
   *
   * @param input 本次识别请求上下文。
   * @param draft Provider 返回的原始草稿。
   * @returns 补齐系统 ID 后的草稿；没有可补齐缺口时返回原草稿。
   */
  private async backfillDeterministicMatches(input: BillIntakeInput, draft: AiBillDraftPayload) {
    if (!needsDeterministicMatchBackfill(draft)) {
      return draft;
    }

    const context = await this.options.apiClient.getTeamBillingContext({
      teamId: input.teamId,
      userId: input.userId,
    });
    const nextDraft: AiBillDraftPayload = structuredClone(draft);

    if (nextDraft.vehicle.value && !nextDraft.vehicle.matchedVehicleId) {
      const vehicleMatch = matchVehicle({
        plateNumber: nextDraft.vehicle.value,
        vehicles: context.vehicles,
      });
      nextDraft.vehicle = {
        ...nextDraft.vehicle,
        candidates: vehicleMatch.candidates,
        matchedVehicleId: vehicleMatch.bestMatchId,
        confidence: vehicleMatch.confidence,
        needsReview: !vehicleMatch.unique,
      };
    }

    if (nextDraft.driver.value && !nextDraft.driver.matchedDriverId) {
      const driverMatch = matchDriver({
        driverName: nextDraft.driver.value,
        vehicleId: nextDraft.vehicle.matchedVehicleId,
        drivers: context.drivers,
      });
      nextDraft.driver = {
        ...nextDraft.driver,
        candidates: driverMatch.candidates,
        matchedDriverId: driverMatch.bestMatchId,
        confidence: driverMatch.confidence,
        needsReview: !driverMatch.unique,
      };
    }

    nextDraft.expenses = nextDraft.expenses.map((expense) => {
      if (!expense.originalName || expense.matchedExpenseTypeId) {
        return expense;
      }

      const expenseTypeMatch = matchExpenseType({
        originalName: expense.originalName,
        expenseTypes: context.expenseTypes,
      });
      return {
        ...expense,
        matchedExpenseTypeId: expenseTypeMatch.expenseTypeId,
        matchedExpenseTypeName: expenseTypeMatch.expenseTypeName,
        note: expense.note || expenseTypeMatch.note,
        needsReview: expenseTypeMatch.needsReview,
      };
    });

    return aiBillDraftPayloadSchema.parse(nextDraft);
  }

  /**
   * 分析一次会计提交的图片/文字材料，并生成 AI 草稿。
   *
   * 模型输出后会再次执行确定性复核，确保缺失字段不会因为模型遗漏提问而被放过。
   */
  async analyze(input: BillIntakeInput) {
    const parsedInput = billIntakeInputSchema.parse(input);
    const result = billIntakeResultSchema.parse(
      await this.options.provider.run(parsedInput, createBillIntakeTools(this.options.apiClient)),
    );
    const draftPayload = await this.backfillDeterministicMatches(parsedInput, result.draftPayload);
    const review = validateDraftForReview(draftPayload);

    return billIntakeResultSchema.parse({
      ...result,
      draftPayload,
      reviewQuestions: review.questions.length > 0 ? review.questions : result.reviewQuestions,
      warnings: [...result.warnings, ...review.warnings, ...createToolTraceWarnings(result)],
    });
  }
}
