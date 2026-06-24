import OpenAI from "openai";
import { z } from "zod";
import type { AgentProvider, AgentTool } from "./agent-provider";
import {
  aiBillDraftPayloadSchema,
  billIntakeResultSchema,
  reviewQuestionSchema,
  type BillIntakeInput,
} from "../domain/schemas";

type ResponseOutputItem = {
  type?: string;
  call_id?: string | null;
  name?: string | null;
  arguments?: string;
};

type OpenAiResponseLike = {
  id?: string;
  output?: ResponseOutputItem[];
  output_text?: string;
};

type ResponsesClient = {
  responses: {
    create(request: unknown): Promise<OpenAiResponseLike>;
  };
};

const agentResultSchema = z.object({
  draftPayload: aiBillDraftPayloadSchema,
  reviewQuestions: z.array(reviewQuestionSchema).default([]),
  warnings: z.array(z.string()).default([]),
  reply: z.string().optional(),
});

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

function jsonSchemaFormat() {
  return {
    type: "json_schema",
    name: "ai_bill_agent_result",
    strict: true,
    schema: z.toJSONSchema(agentResultSchema),
  };
}

function parseToolArguments(value: string | undefined) {
  if (!value) return {};
  return JSON.parse(value) as unknown;
}

export class OpenAiResponsesAgentProvider implements AgentProvider {
  private readonly client: ResponsesClient;

  constructor(private readonly options: { apiKey: string; model: string; client?: ResponsesClient }) {
    this.client = options.client ?? (new OpenAI({ apiKey: options.apiKey }) as unknown as ResponsesClient);
  }

  async run(input: BillIntakeInput, tools: AgentTool[]) {
    const toolDefinitions = tools.map((tool) => ({
      type: "function",
      name: tool.name,
      description: tool.description,
      parameters: { type: "object", additionalProperties: true },
    }));

    let response = await this.client.responses.create({
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

      response = await this.client.responses.create({
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
