import { z } from "zod";
import { describe, expect, it } from "vitest";
import { OpenAiResponsesAgentProvider } from "../providers/openai-provider";
import type { BillIntakeInput } from "../domain/types";

const draftPayload = {
  vehicle: { value: null, confidence: "low", needsReview: true },
  driver: { value: null, confidence: "low", needsReview: true },
  customerName: { value: "宏达建材", confidence: "high", needsReview: false },
  loadLocation: { value: "福州", confidence: "high", needsReview: false },
  unloadLocation: { value: "厦门", confidence: "high", needsReview: false },
  actualFreight: { value: "1800.00", confidence: "high", needsReview: false },
  settledAt: { value: "2026-06-22", confidence: "high", needsReview: false },
  expenseModeSuggestion: "details",
  expenses: [],
} as const;

const input: BillIntakeInput = {
  teamId: "team-1",
  userId: "accountant-1",
  inputMode: "text",
  textNote: "宏达建材 福州到厦门 运费1800",
  imageUrls: [],
  messages: [],
};

function createFakeClient(responses: unknown[]) {
  const requests: unknown[] = [];
  return {
    requests,
    client: {
      responses: {
        create: async (request: unknown) => {
          requests.push(request);
          const response = responses.shift();
          if (!response) throw new Error("No fake OpenAI response queued");
          return response;
        },
      },
    },
  };
}

describe("OpenAI bill intake provider", () => {
  it("executes provider tool calls before returning the final draft", async () => {
    const fake = createFakeClient([
      {
        id: "response-1",
        output: [
          {
            type: "function_call",
            call_id: "call-1",
            name: "get_team_billing_context",
            arguments: "{}",
          },
        ],
      },
      {
        id: "response-2",
        output: [],
        output_text: JSON.stringify({
          draftPayload,
          reviewQuestions: [],
          warnings: [],
          reply: "已生成草稿。",
        }),
      },
    ]);
    const toolCalls: unknown[] = [];
    const provider = new OpenAiResponsesAgentProvider({
      apiKey: "test-key",
      model: "gpt-5.5",
      client: fake.client,
    });

    const result = await provider.run(input, [
      {
        name: "get_team_billing_context",
        description: "获取团队账单上下文。",
        inputSchema: z.object({}),
        async execute(value) {
          toolCalls.push(value);
          return { vehicles: [], drivers: [], expenseTypes: [] };
        },
      },
    ]);

    expect(toolCalls).toHaveLength(1);
    expect(result.providerRequestId).toBe("response-2");
    expect(result.reply).toBe("已生成草稿。");
    expect(result.draftPayload.customerName.value).toBe("宏达建材");
  });

  it("sends image urls and a structured output schema to the Responses API", async () => {
    const fake = createFakeClient([
      {
        id: "response-1",
        output: [],
        output_text: JSON.stringify({ draftPayload }),
      },
    ]);
    const provider = new OpenAiResponsesAgentProvider({
      apiKey: "test-key",
      model: "gpt-5.5",
      client: fake.client,
    });

    await provider.run({ ...input, inputMode: "image", imageUrls: ["https://example.com/bill.jpg"] }, []);

    expect(fake.requests[0]).toMatchObject({
      model: "gpt-5.5",
      text: {
        format: {
          type: "json_schema",
          name: "ai_bill_agent_result",
          strict: true,
        },
      },
    });
    expect(JSON.stringify(fake.requests[0])).toContain("input_image");
    expect(JSON.stringify(fake.requests[0])).toContain("https://example.com/bill.jpg");
  });
});
