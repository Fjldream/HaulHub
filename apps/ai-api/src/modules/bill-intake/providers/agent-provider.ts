import type { z } from "zod";
import type { BillIntakeInput, BillIntakeResult } from "../domain/types";

export type AgentTool<Input = unknown> = {
  name: string;
  description: string;
  inputSchema: z.ZodType<Input>;
  execute(input: Input, context: BillIntakeInput): Promise<unknown>;
};

export type AgentProvider = {
  run(input: BillIntakeInput, tools: AgentTool[]): Promise<BillIntakeResult>;
};
