import { z } from "zod";
import type { TeamBillingContext } from "../modules/bill-intake/tools";

/**
 * 主业务后端返回给 AI 服务的团队账单上下文 schema。
 *
 * AI 服务只需要这些只读上下文来做匹配和提问，不直接访问业务数据库。
 */
const teamBillingContextSchema = z.object({
  vehicles: z.array(z.object({ id: z.string(), plateNumber: z.string(), status: z.string() })),
  drivers: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      phone: z.string().optional(),
      status: z.string(),
      boundVehicleIds: z.array(z.string()).optional(),
    }),
  ),
  expenseTypes: z.array(z.object({ id: z.string(), name: z.string(), enabled: z.boolean() })),
});

/**
 * AI 服务访问主业务后端的最小客户端接口。
 *
 * 后续如果主业务 API 的认证方式变化，只需要替换这个接口的实现，不影响 Agent 工具和 Workflow。
 */
export type HaulHubApiClient = {
  getTeamBillingContext(input: { teamId: string; userId: string }): Promise<TeamBillingContext>;
};

/**
 * 通过 HTTP 调用主业务后端的客户端实现。
 *
 * 这个类只负责和 `apps/api` 通信，并用 Zod 校验返回结构，避免脏数据进入 Agent。
 */
export class HttpHaulHubApiClient implements HaulHubApiClient {
  constructor(private readonly options: { baseUrl: string; serviceToken: string }) {}

  /**
   * 获取当前团队用于账单识别的车辆、司机、绑定关系和费用类型。
   */
  async getTeamBillingContext(input: { teamId: string; userId: string }) {
    const url = new URL("/internal/ai-billing/context", this.options.baseUrl);
    url.searchParams.set("teamId", input.teamId);
    url.searchParams.set("userId", input.userId);

    const response = await fetch(url, {
      headers: {
        authorization: `Bearer ${this.options.serviceToken}`,
      },
    });
    if (!response.ok) {
      throw new Error(`HaulHub API context request failed: ${response.status}`);
    }

    return teamBillingContextSchema.parse(await response.json());
  }
}
