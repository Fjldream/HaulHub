import type { HaulHubApiClient } from "../../../clients/haulhub-api-client";
import type { AgentProvider } from "../providers/agent-provider";
import { createBillIntakeTools } from "./tool-registry";
import { validateDraftForReview } from "../tools";
import { billIntakeInputSchema, billIntakeResultSchema, type BillIntakeInput } from "../domain/schemas";

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
   * 分析一次会计提交的图片/文字材料，并生成 AI 草稿。
   *
   * 模型输出后会再次执行确定性复核，确保缺失字段不会因为模型遗漏提问而被放过。
   */
  async analyze(input: BillIntakeInput) {
    const parsedInput = billIntakeInputSchema.parse(input);
    const result = await this.options.provider.run(parsedInput, createBillIntakeTools(this.options.apiClient));
    const review = validateDraftForReview(result.draftPayload);

    return billIntakeResultSchema.parse({
      ...result,
      reviewQuestions: review.questions.length > 0 ? review.questions : result.reviewQuestions,
      warnings: [...result.warnings, ...review.warnings],
    });
  }
}
