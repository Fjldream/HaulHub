import { z } from "zod";
import { describe, expect, it } from "vitest";
import { MockBillIntakeAgentProvider } from "../providers/mock-provider";
import type { AgentTool } from "../providers/agent-provider";
import type { BillIntakeInput } from "../domain/types";

const input: BillIntakeInput = {
  teamId: "team-default",
  userId: "accountant-1",
  inputMode: "text",
  textNote: "客户宏达建材 沪A·12345 司机老李 上海到杭州 运费800 油费100 过路费50 2026-07-08",
  imageUrls: [],
  messages: [],
};

const tools: AgentTool[] = [
  {
    name: "get_team_billing_context",
    description: "获取上下文",
    inputSchema: z.object({}),
    async execute() {
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
  },
  {
    name: "match_vehicle",
    description: "匹配车辆",
    inputSchema: z.object({}),
    async execute() {
      return {
        candidates: [{ id: "vehicle-1", plateNumber: "沪A·12345" }],
        bestMatchId: "vehicle-1",
        confidence: "high",
        unique: true,
      };
    },
  },
  {
    name: "match_driver",
    description: "匹配司机",
    inputSchema: z.object({}),
    async execute() {
      return {
        candidates: [{ id: "driver-1", name: "司机老李", phone: "13900000001" }],
        bestMatchId: "driver-1",
        confidence: "high",
        unique: true,
        boundToVehicle: true,
      };
    },
  },
  {
    name: "match_expense_type",
    description: "匹配费用类型",
    inputSchema: z.object({}),
    async execute(value) {
      const originalName = (value as { originalName: string }).originalName;
      return originalName === "油费"
        ? {
            expenseTypeId: "expense-type-fuel",
            expenseTypeName: "油费",
            confidence: "high",
            note: "",
            needsReview: false,
          }
        : {
            expenseTypeId: "expense-type-toll",
            expenseTypeName: "过路费",
            confidence: "high",
            note: "",
            needsReview: false,
          };
    },
  },
  {
    name: "validate_draft_for_review",
    description: "校验草稿",
    inputSchema: z.object({}),
    async execute() {
      return {
        questions: [],
        warnings: [],
        readyForReview: true,
        blocksSubmit: [],
      };
    },
  },
];

describe("MockBillIntakeAgentProvider", () => {
  it("builds a local draft through the deterministic tool chain", async () => {
    const provider = new MockBillIntakeAgentProvider();

    const result = await provider.run(input, tools);

    expect(result.provider).toBe("mock");
    expect(result.draftPayload.vehicle.matchedVehicleId).toBe("vehicle-1");
    expect(result.draftPayload.driver.matchedDriverId).toBe("driver-1");
    expect(result.draftPayload.customerName.value).toBe("宏达建材");
    expect(result.draftPayload.loadLocation.value).toBe("上海");
    expect(result.draftPayload.unloadLocation.value).toBe("杭州");
    expect(result.draftPayload.actualFreight.value).toBe("800");
    expect(result.draftPayload.expenses).toMatchObject([
      { originalName: "油费", matchedExpenseTypeId: "expense-type-fuel" },
      { originalName: "过路费", matchedExpenseTypeId: "expense-type-toll" },
    ]);
    expect(result.reviewQuestions).toEqual([]);
    expect(result.toolTrace.map((item) => item.name)).toEqual([
      "get_team_billing_context",
      "match_vehicle",
      "match_driver",
      "match_expense_type",
      "match_expense_type",
      "validate_draft_for_review",
    ]);
  });
});
