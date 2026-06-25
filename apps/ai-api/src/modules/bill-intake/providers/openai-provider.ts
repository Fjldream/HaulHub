import OpenAI from "openai";
import { z } from "zod";
import type { AgentProvider, AgentTool } from "./agent-provider";
import {
  aiBillDraftPayloadSchema,
  billIntakeResultSchema,
  reviewQuestionSchema,
  type BillIntakeInput,
} from "../domain/schemas";

/**
 * OpenAI Responses API 返回项的最小结构。
 *
 * 这里不绑定完整 SDK 类型，方便测试中注入轻量 fake client。
 */
type ResponseOutputItem = {
  type?: string;
  call_id?: string | null;
  name?: string | null;
  arguments?: string;
};

/**
 * Provider 运行时只关心的 OpenAI 响应字段。
 */
type OpenAiResponseLike = {
  id?: string;
  output?: ResponseOutputItem[];
  output_text?: string;
};

/**
 * 可替换的 Responses API 客户端接口。
 *
 * 生产环境使用 OpenAI SDK，测试环境使用 fake client。
 */
type ResponsesClient = {
  responses: {
    create(request: unknown): Promise<OpenAiResponseLike>;
  };
};

/**
 * 模型最终必须返回的结构化结果 schema。
 *
 * 这个 schema 会传给 OpenAI Structured Outputs，同时也会在本地再次校验。
 */
const agentResultSchema = z.object({
  draftPayload: aiBillDraftPayloadSchema,
  reviewQuestions: z.array(reviewQuestionSchema).default([]),
  warnings: z.array(z.string()).default([]),
  reply: z.string().optional(),
});

/**
 * 构建传给模型的用户输入内容。
 *
 * 文本、图片 URL、对话历史和当前草稿会被合并成一次多模态输入；会计手写补充信息
 * 在 prompt 数据中显式标注为优先级最高。
 */
function buildUserContent(input: BillIntakeInput) {
  const text = JSON.stringify({
    teamId: input.teamId,
    userId: input.userId,
    inputMode: input.inputMode,
    textNote: input.textNote,
    messages: input.messages,
    currentDraft: input.currentDraft,
    priority: "会计输入文字 > 图片识别结果 > 模型推断",
  });

  return [
    { type: "input_text", text },
    ...input.imageUrls.map((imageUrl) => ({ type: "input_image", image_url: imageUrl })),
  ];
}

/**
 * 构建 Responses API 的结构化输出格式。
 */
function jsonSchemaFormat() {
  return {
    type: "json_schema",
    name: "ai_bill_agent_result",
    strict: true,
    schema: z.toJSONSchema(agentResultSchema),
  };
}

/**
 * 解析模型发起工具调用时传入的 JSON 参数。
 */
function parseToolArguments(value: string | undefined) {
  if (!value) return {};
  return JSON.parse(value) as unknown;
}

/**
 * OpenAI Responses API 的 AgentProvider 实现。
 *
 * 它负责把 HaulHub 的账单识别输入转换为 OpenAI 请求，执行工具调用循环，并把最终
 * JSON 输出校验成 `BillIntakeResult`。它不保存草稿，也不创建正式账单。
 */
export class OpenAiResponsesAgentProvider implements AgentProvider {
  private client?: ResponsesClient;

  constructor(private readonly options: { apiKey: string; model: string; client?: ResponsesClient }) {
    this.client = options.client;
  }

  /**
   * 获取 Responses API 客户端。
   *
   * OpenAI SDK 会在没有 Key 时立刻抛错，所以这里延迟到真正调用模型时再初始化。
   * 这样 AI 服务可以在未配置模型 Key 的本地环境中先启动健康检查和非模型路由。
   */
  private getClient() {
    this.client ??= new OpenAI({ apiKey: this.options.apiKey }) as unknown as ResponsesClient;
    return this.client;
  }

  /**
   * 运行一次模型识别。
   *
   * 当模型返回 function_call 时，本方法会执行对应工具，并把工具结果传回同一个 Responses
   * 会话，直到模型给出最终结构化草稿或达到循环上限。
   */
  async run(input: BillIntakeInput, tools: AgentTool[]) {
    const toolDefinitions = tools.map((tool) => ({
      type: "function",
      name: tool.name,
      description: tool.description,
      parameters: { type: "object", additionalProperties: true },
    }));

    const client = this.getClient();
    let response = await client.responses.create({
      model: this.options.model,
      input: [
        {
          role: "system",
          content:
            "你是 HaulHub 的账单补录 Agent。你只生成待会计确认的草稿，不允许直接入账。缺失、冲突或低置信度信息必须提出确认问题。识别不到的费用类型归到其他，并在备注保留原始费用名。",
        },
        {
          role: "user",
          content: buildUserContent(input),
        },
      ],
      tools: toolDefinitions,
      text: { format: jsonSchemaFormat() },
    });

    for (let index = 0; index < 8; index += 1) {
      const calls = (response.output ?? []).filter((item) => item.type === "function_call");
      if (calls.length === 0) break;

      const toolOutputs = [];
      for (const call of calls) {
        const tool = tools.find((item) => item.name === call.name);
        if (!tool) {
          throw new Error(`Unknown AI bill tool: ${call.name ?? "unknown"}`);
        }
        const parsedInput = tool.inputSchema.parse(parseToolArguments(call.arguments));
        const output = await tool.execute(parsedInput, input);
        toolOutputs.push({
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify(output),
        });
      }

      response = await client.responses.create({
        model: this.options.model,
        previous_response_id: response.id,
        input: toolOutputs,
        tools: toolDefinitions,
        text: { format: jsonSchemaFormat() },
      });
    }

    const parsed = agentResultSchema.parse(JSON.parse(response.output_text || "{}"));
    return billIntakeResultSchema.parse({
      provider: "openai",
      providerRequestId: response.id,
      rawAgentResult: response,
      draftPayload: parsed.draftPayload,
      reviewQuestions: parsed.reviewQuestions,
      warnings: parsed.warnings,
      reply: parsed.reply ?? "已生成 AI 草稿，请会计确认。",
    });
  }
}
