import { z } from "zod";
import type { HaulHubApiClient } from "../../../clients/haulhub-api-client";
import type { AgentTool } from "../providers/agent-provider";
import {
  calculateExpenseSummary,
  matchDriver,
  matchExpenseType,
  matchVehicle,
  validateDraftForReview,
} from "../tools";
import { aiBillDraftPayloadSchema } from "../domain/schemas";

function defineTool<Input>(tool: AgentTool<Input>): AgentTool<Input> {
  return tool;
}

export function createBillIntakeTools(apiClient: HaulHubApiClient): AgentTool[] {
  return [
    defineTool({
      name: "get_team_billing_context",
      description: "获取当前团队可用车辆、司机、绑定关系和费用类型。",
      inputSchema: z.object({}),
      execute: async (_input, context) =>
        apiClient.getTeamBillingContext({ teamId: context.teamId, userId: context.userId }),
    }),
    defineTool({
      name: "match_vehicle",
      description: "根据车牌或车辆描述匹配系统车辆。",
      inputSchema: z.object({
        plateNumber: z.string().nullable().optional(),
        vehicles: z.array(z.object({ id: z.string(), plateNumber: z.string(), status: z.string() })),
      }),
      execute: async (input) => matchVehicle(input),
    }),
    defineTool({
      name: "match_driver",
      description: "根据司机姓名、手机号和车辆绑定关系匹配司机。",
      inputSchema: z.object({
        driverName: z.string().nullable().optional(),
        phone: z.string().nullable().optional(),
        vehicleId: z.string().nullable().optional(),
        drivers: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            phone: z.string().optional(),
            status: z.string(),
            boundVehicleIds: z.array(z.string()).optional(),
          }),
        ),
      }),
      execute: async (input) => matchDriver(input),
    }),
    defineTool({
      name: "match_expense_type",
      description: "根据原始费用名称匹配系统费用类型，无法匹配时使用其他。",
      inputSchema: z.object({
        originalName: z.string(),
        expenseTypes: z.array(z.object({ id: z.string(), name: z.string(), enabled: z.boolean() })),
      }),
      execute: async (input) => matchExpenseType(input),
    }),
    defineTool({
      name: "calculate_expense_summary",
      description: "计算费用明细合计，并判断明细合计和总费用是否冲突。",
      inputSchema: z.object({
        expenses: z.array(z.object({ originalName: z.string(), amount: z.string() })),
        totalExpense: z.string().nullable().optional(),
      }),
      execute: async (input) => calculateExpenseSummary(input),
    }),
    defineTool({
      name: "validate_draft_for_review",
      description: "检查草稿缺失和冲突字段，生成需要会计确认的问题。",
      inputSchema: z.object({
        draft: aiBillDraftPayloadSchema,
      }),
      execute: async (input) => validateDraftForReview(input.draft),
    }),
  ];
}
