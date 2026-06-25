import type { z } from "zod";
import type { BillIntakeInput, BillIntakeResult } from "../domain/types";

/**
 * Agent 可以调用的工具定义。
 *
 * `inputSchema` 负责校验模型传入的工具参数；`execute` 才是真正执行确定性业务逻辑的地方。
 * 这个边界保证模型只能通过受控工具访问 HaulHub 上下文。
 */
export type AgentTool<Input = unknown> = {
  name: string;
  description: string;
  inputSchema: z.ZodType<Input>;
  execute(input: Input, context: BillIntakeInput): Promise<unknown>;
};

/**
 * 模型供应商适配接口。
 *
 * OpenAI、DeepSeek 或其它模型供应商只要实现这个接口，就能被 `BillIntakeWorkflow` 使用。
 */
export type AgentProvider = {
  run(input: BillIntakeInput, tools: AgentTool[]): Promise<BillIntakeResult>;
};
