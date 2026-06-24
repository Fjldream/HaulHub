import type { HaulHubApiClient } from "../../../clients/haulhub-api-client";
import type { AgentProvider } from "../providers/agent-provider";
import { createBillIntakeTools } from "./tool-registry";
import { validateDraftForReview } from "../tools";
import { billIntakeInputSchema, billIntakeResultSchema, type BillIntakeInput } from "../domain/schemas";

export class BillIntakeWorkflow {
  constructor(
    private readonly options: {
      provider: AgentProvider;
      apiClient: HaulHubApiClient;
    },
  ) {}

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
