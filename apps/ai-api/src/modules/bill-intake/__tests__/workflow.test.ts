import { describe, expect, it } from "vitest";
import type { AgentProvider } from "../providers/agent-provider";
import type { AiBillDraftPayload } from "../domain/types";
import { BillIntakeWorkflow } from "../agent/workflow";

const completeDraft: AiBillDraftPayload = {
  vehicle: { value: "闽A12345", matchedVehicleId: "vehicle-1", confidence: "high", needsReview: false },
  driver: { value: "老王", matchedDriverId: "driver-1", confidence: "high", needsReview: false },
  customerName: { value: "宏达建材", confidence: "high", needsReview: false },
  loadLocation: { value: "福州", confidence: "high", needsReview: false },
  unloadLocation: { value: "厦门", confidence: "high", needsReview: false },
  actualFreight: { value: "1800.00", confidence: "high", needsReview: false },
  settledAt: { value: "2026-06-22", confidence: "high", needsReview: false },
  expenseModeSuggestion: "total",
  expenses: [],
  totalExpense: { value: "200.00", confidence: "high", needsReview: false },
};

describe("BillIntakeWorkflow", () => {
  it("runs the provider with registered tools", async () => {
    const toolNames: string[] = [];
    const provider: AgentProvider = {
      async run(_input, tools) {
        toolNames.push(...tools.map((tool) => tool.name));
        return {
          provider: "test",
          rawAgentResult: {},
          draftPayload: completeDraft,
          reviewQuestions: [],
          warnings: [],
          reply: "已生成草稿。",
        };
      },
    };
    const workflow = new BillIntakeWorkflow({
      provider,
      apiClient: {
        async getTeamBillingContext() {
          return { vehicles: [], drivers: [], expenseTypes: [] };
        },
      },
    });

    const result = await workflow.analyze({
      teamId: "team-1",
      userId: "accountant-1",
      inputMode: "text",
      textNote: "宏达建材 福州到厦门 运费1800",
      imageUrls: [],
      messages: [],
    });

    expect(result.reply).toBe("已生成草稿。");
    expect(toolNames).toContain("get_team_billing_context");
    expect(toolNames).toContain("validate_draft_for_review");
  });

  it("adds deterministic review questions after provider output", async () => {
    const provider: AgentProvider = {
      async run() {
        return {
          provider: "test",
          rawAgentResult: {},
          draftPayload: {
            ...completeDraft,
            vehicle: { value: null, confidence: "low", needsReview: true },
          },
          reviewQuestions: [],
          warnings: [],
          reply: "已生成草稿。",
        };
      },
    };
    const workflow = new BillIntakeWorkflow({
      provider,
      apiClient: {
        async getTeamBillingContext() {
          return { vehicles: [], drivers: [], expenseTypes: [] };
        },
      },
    });

    const result = await workflow.analyze({
      teamId: "team-1",
      userId: "accountant-1",
      inputMode: "text",
      textNote: "宏达建材 福州到厦门 运费1800",
      imageUrls: [],
      messages: [],
    });

    expect(result.reviewQuestions.map((question) => question.field)).toContain("vehicle");
  });
});
