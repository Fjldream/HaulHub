import { z } from "zod";
import { describe, expect, it } from "vitest";
import { OpenAiResponsesAgentProvider, createOpenAiResponsesHttpClient } from "../providers/openai-provider";
import type { BillIntakeInput } from "../domain/types";

type RecordedFetchInit = {
  method: string;
  headers: Record<string, string>;
  body: string;
  dispatcher?: unknown;
};

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
  it("creates Responses API requests through the lightweight HTTP client", async () => {
    const requests: Array<{ url: string; init: RecordedFetchInit }> = [];
    const client = createOpenAiResponsesHttpClient({
      apiKey: "test-key",
      fetchFn: async (url, init) => {
        requests.push({ url: String(url), init });
        return new Response(JSON.stringify({ id: "response-1", output: [], output_text: "{\"ok\":true}" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    });

    const response = await client.responses.create({ model: "gpt-4o-mini", input: "ping" });

    expect(response.id).toBe("response-1");
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe("https://api.openai.com/v1/responses");
    expect(requests[0].init.method).toBe("POST");
    expect(requests[0].init.headers).toMatchObject({
      Authorization: "Bearer test-key",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(String(requests[0].init.body))).toEqual({ model: "gpt-4o-mini", input: "ping" });
  });

  it("attaches a proxy dispatcher when OpenAI proxy URL is configured", async () => {
    const requests: Array<{ url: string; init: RecordedFetchInit }> = [];
    const client = createOpenAiResponsesHttpClient({
      apiKey: "test-key",
      proxyUrl: "http://127.0.0.1:7897",
      fetchFn: async (url, init) => {
        requests.push({ url: String(url), init });
        return new Response(JSON.stringify({ id: "response-1", output: [], output_text: "{\"ok\":true}" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    });

    await client.responses.create({ model: "gpt-4o-mini", input: "ping" });

    expect(requests[0].init.dispatcher).toBeDefined();
  });

  it("turns OpenAI error payloads into readable local errors", async () => {
    const client = createOpenAiResponsesHttpClient({
      apiKey: "test-key",
      fetchFn: async () =>
        new Response(
          JSON.stringify({
            error: {
              message: "You exceeded your current quota.",
              code: "insufficient_quota",
            },
          }),
          { status: 429, headers: { "content-type": "application/json" } },
        ),
    });

    await expect(client.responses.create({ model: "gpt-4o-mini", input: "ping" })).rejects.toThrow(
      "OpenAI 额度不足",
    );
  });

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
    expect(result.toolTrace).toEqual([
      {
        index: 1,
        name: "get_team_billing_context",
        callId: "call-1",
        status: "success",
        input: {},
      },
    ]);
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
          type: "json_object",
        },
      },
    });
    expect(JSON.stringify(fake.requests[0])).toContain("input_image");
    expect(JSON.stringify(fake.requests[0])).toContain("https://example.com/bill.jpg");
  });

  it("normalizes null optional match fields returned by the model", async () => {
    const fake = createFakeClient([
      {
        id: "response-1",
        output: [],
        output_text: JSON.stringify({
          draftPayload: {
            ...draftPayload,
            vehicle: { ...draftPayload.vehicle, matchedVehicleId: null },
            driver: {
              ...draftPayload.driver,
              matchedDriverId: null,
              candidates: [{ id: "driver-1", name: "司机老李", phone: null }],
            },
            expenses: [
              {
                originalName: "手写油费",
                matchedExpenseTypeId: null,
                matchedExpenseTypeName: null,
                amount: { value: "100", confidence: "medium", needsReview: false },
                needsReview: true,
              },
            ],
          },
        }),
      },
    ]);
    const provider = new OpenAiResponsesAgentProvider({
      apiKey: "test-key",
      model: "gpt-5.5",
      client: fake.client,
    });

    const result = await provider.run(input, []);

    expect(result.draftPayload.vehicle.matchedVehicleId).toBeUndefined();
    expect(result.draftPayload.driver.matchedDriverId).toBeUndefined();
    expect(result.draftPayload.driver.candidates?.[0].phone).toBeUndefined();
    expect(result.draftPayload.expenses[0].matchedExpenseTypeId).toBeUndefined();
    expect(result.draftPayload.expenses[0].matchedExpenseTypeName).toBeUndefined();
  });

  it("instructs the model to use the deterministic bill intake tool chain", async () => {
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

    await provider.run(input, []);

    const request = fake.requests[0] as { input: Array<{ role: string; content: string }> };
    const systemPrompt = request.input.find((item) => item.role === "system")?.content ?? "";
    expect(systemPrompt).toContain("get_team_billing_context");
    expect(systemPrompt).toContain("match_vehicle");
    expect(systemPrompt).toContain("match_driver");
    expect(systemPrompt).toContain("match_expense_type");
    expect(systemPrompt).toContain("validate_draft_for_review");
    expect(systemPrompt).toContain("不能直接入账");
    expect(systemPrompt).toContain("继续追问");
  });
});
