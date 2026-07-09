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

/**
 * 创建测试用的 HaulHub API 客户端假实现。
 */
function createApiClientStub() {
  return {
    async getTeamBillingContext() {
      return { vehicles: [], drivers: [], expenseTypes: [] };
    },
    async createManualCompletedTrip() {
      return { trip: { id: "trip-created" } };
    },
  };
}

/**
 * 创建带团队上下文的测试 API 客户端。
 */
function createApiClientWithContext() {
  return {
    async getTeamBillingContext() {
      return {
        vehicles: [{ id: "vehicle-1", plateNumber: "沪A·12345", status: "available" }],
        drivers: [
          {
            id: "driver-1",
            name: "司机老李",
            phone: "13900000001",
            status: "active",
            boundVehicleIds: ["vehicle-1"],
          },
        ],
        expenseTypes: [
          { id: "expense-type-fuel", name: "油费", enabled: true },
          { id: "expense-type-toll", name: "过路费", enabled: true },
          { id: "expense-type-other", name: "其他", enabled: true },
        ],
      };
    },
    async createManualCompletedTrip() {
      return { trip: { id: "trip-created" } };
    },
  };
}

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
          toolTrace: [],
          reply: "已生成草稿。",
        };
      },
    };
    const workflow = new BillIntakeWorkflow({
      provider,
      apiClient: createApiClientStub(),
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
          toolTrace: [],
          reply: "已生成草稿。",
        };
      },
    };
    const workflow = new BillIntakeWorkflow({
      provider,
      apiClient: createApiClientStub(),
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

  it("adds warnings when the provider skips required deterministic tools", async () => {
    const provider: AgentProvider = {
      async run() {
        return {
          provider: "test",
          rawAgentResult: {},
          draftPayload: completeDraft,
          reviewQuestions: [],
          warnings: [],
          reply: "draft ready",
          toolTrace: [],
        };
      },
    };
    const workflow = new BillIntakeWorkflow({
      provider,
      apiClient: createApiClientStub(),
    });

    const result = await workflow.analyze({
      teamId: "team-1",
      userId: "accountant-1",
      inputMode: "text",
      textNote: "瀹忚揪寤烘潗 绂忓窞鍒板帵闂?杩愯垂1800",
      imageUrls: [],
      messages: [],
    });

    expect(result.toolTrace).toEqual([]);
    expect(result.warnings.join("\n")).toContain("get_team_billing_context");
    expect(result.warnings.join("\n")).toContain("validate_draft_for_review");
  });

  it("fills missing match ids from recognized draft text before review", async () => {
    const provider: AgentProvider = {
      async run() {
        return {
          provider: "test",
          rawAgentResult: {},
          draftPayload: {
            ...completeDraft,
            vehicle: { value: "沪A·12345", confidence: "medium", needsReview: true },
            driver: { value: "司机老李", confidence: "medium", needsReview: true },
            expenseModeSuggestion: "details",
            expenses: [
              {
                originalName: "油费",
                amount: { value: "100", confidence: "high", needsReview: false },
                needsReview: true,
              },
              {
                originalName: "过路费",
                amount: { value: "50", confidence: "high", needsReview: false },
                needsReview: true,
              },
            ],
            totalExpense: undefined,
          },
          reviewQuestions: [],
          warnings: [],
          reply: "请确认车辆和司机信息。",
          toolTrace: [],
        };
      },
    };
    const workflow = new BillIntakeWorkflow({
      provider,
      apiClient: createApiClientWithContext(),
    });

    const result = await workflow.analyze({
      teamId: "team-1",
      userId: "accountant-1",
      inputMode: "text",
      textNote: "车辆是沪A·12345，司机是司机老李，油费100，过路费50。",
      imageUrls: [],
      messages: [],
    });

    expect(result.draftPayload.vehicle).toMatchObject({
      matchedVehicleId: "vehicle-1",
      confidence: "high",
      needsReview: false,
    });
    expect(result.draftPayload.driver).toMatchObject({
      matchedDriverId: "driver-1",
      confidence: "high",
      needsReview: false,
    });
    expect(result.draftPayload.expenses.map((expense) => expense.matchedExpenseTypeId)).toEqual([
      "expense-type-fuel",
      "expense-type-toll",
    ]);
    expect(result.reviewQuestions.map((question) => question.field)).not.toContain("vehicle");
    expect(result.reviewQuestions.map((question) => question.field)).not.toContain("driver");
  });
});
