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
});
