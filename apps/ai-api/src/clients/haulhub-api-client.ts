import { z } from "zod";
import type { TeamBillingContext } from "../modules/bill-intake/tools";

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

export type HaulHubApiClient = {
  getTeamBillingContext(input: { teamId: string; userId: string }): Promise<TeamBillingContext>;
};

export class HttpHaulHubApiClient implements HaulHubApiClient {
  constructor(private readonly options: { baseUrl: string; serviceToken: string }) {}

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
