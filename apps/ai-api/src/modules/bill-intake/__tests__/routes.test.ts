import { describe, expect, it } from "vitest";
import { buildApp } from "../../../app";
import type { BillIntakeWorkflow } from "../agent/workflow";

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

describe("AI API app", () => {
  it("starts health routes without requiring an OpenAI key", async () => {
    const previousKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const app = buildApp();

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    process.env.OPENAI_API_KEY = previousKey;
  });

  it("returns health status", async () => {
    const app = buildApp({
      workflow: { analyze: async () => ({}) } as unknown as BillIntakeWorkflow,
    });

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, service: "haulhub-ai-api" });
  });

  it("analyzes bill intake requests through the workflow", async () => {
    const calls: unknown[] = [];
    const app = buildApp({
      workflow: {
        analyze: async (input: unknown) => {
          calls.push(input);
          return {
            provider: "test",
            rawAgentResult: {},
            draftPayload,
            reviewQuestions: [{ field: "vehicle", message: "请选择车辆。", severity: "required" }],
            warnings: [],
            reply: "已生成草稿。",
          };
        },
      } as unknown as BillIntakeWorkflow,
    });

    const response = await app.inject({
      method: "POST",
      url: "/bill-intake/analyze",
      payload: {
        teamId: "team-1",
        userId: "accountant-1",
        inputMode: "text",
        textNote: "宏达建材 福州到厦门 运费1800",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(calls).toHaveLength(1);
    expect(response.json().result.reply).toBe("已生成草稿。");
    expect(response.json().result.reviewQuestions[0].field).toBe("vehicle");
  });

  it("keeps bill intake session messages and current draft across follow-up analysis", async () => {
    const calls: unknown[] = [];
    const app = buildApp({
      workflow: {
        analyze: async (input: unknown) => {
          calls.push(input);
          return {
            provider: "test",
            rawAgentResult: {},
            draftPayload,
            reviewQuestions: [{ field: "vehicle", message: "请选择车辆", severity: "required" }],
            warnings: [],
            reply: calls.length === 1 ? "请补充车辆信息" : "已根据补充信息更新草稿",
          };
        },
      } as unknown as BillIntakeWorkflow,
    });

    const createResponse = await app.inject({
      method: "POST",
      url: "/bill-intake/sessions",
      payload: { teamId: "team-1", userId: "accountant-1" },
    });
    expect(createResponse.statusCode).toBe(200);
    const sessionId = createResponse.json().session.id as string;

    const firstAnalysis = await app.inject({
      method: "POST",
      url: `/bill-intake/sessions/${sessionId}/analyze`,
      payload: {
        inputMode: "text",
        textNote: "运费1800，缺少车辆",
      },
    });
    expect(firstAnalysis.statusCode).toBe(200);

    const messageResponse = await app.inject({
      method: "POST",
      url: `/bill-intake/sessions/${sessionId}/messages`,
      payload: { role: "user", content: "车辆是沪A12345" },
    });
    expect(messageResponse.statusCode).toBe(200);

    const secondAnalysis = await app.inject({
      method: "POST",
      url: `/bill-intake/sessions/${sessionId}/analyze`,
      payload: {
        inputMode: "text",
        textNote: "按刚才补充的信息继续识别",
      },
    });
    expect(secondAnalysis.statusCode).toBe(200);

    const sessionResponse = await app.inject({
      method: "GET",
      url: `/bill-intake/sessions/${sessionId}`,
    });
    expect(sessionResponse.statusCode).toBe(200);
    expect(sessionResponse.json().session.messages.map((message: { content: string }) => message.content)).toEqual([
      "运费1800，缺少车辆",
      "请补充车辆信息",
      "车辆是沪A12345",
      "按刚才补充的信息继续识别",
      "已根据补充信息更新草稿",
    ]);

    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({
      teamId: "team-1",
      userId: "accountant-1",
      messages: [{ role: "user", content: "运费1800，缺少车辆" }],
    });
    expect(calls[1]).toMatchObject({
      currentDraft: draftPayload,
      messages: [
        { role: "user", content: "运费1800，缺少车辆" },
        { role: "assistant", content: "请补充车辆信息" },
        { role: "user", content: "车辆是沪A12345" },
        { role: "user", content: "按刚才补充的信息继续识别" },
      ],
    });
    expect(secondAnalysis.json().session.currentDraft).toEqual(draftPayload);
  });
});
