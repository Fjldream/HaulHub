import { describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import { buildApp } from "../../../app";
import type { BillIntakeWorkflow } from "../agent/workflow";
import { registerBillIntakeRoutes } from "../http/routes";
import type { BillIntakeSession, BillIntakeSessionStore } from "../sessions/session-store";

type TestFetcher = (url: URL, init?: RequestInit) => Promise<Response>;

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

const confirmedDraftPayload = {
  vehicle: { value: "沪A12345", matchedVehicleId: "vehicle-1", confidence: "high", needsReview: false },
  driver: { value: "司机老王", matchedDriverId: "driver-1", confidence: "high", needsReview: false },
  customerName: { value: "宏达建材", confidence: "high", needsReview: false },
  loadLocation: { value: "福州", confidence: "high", needsReview: false },
  unloadLocation: { value: "厦门", confidence: "high", needsReview: false },
  actualFreight: { value: "1800.00", confidence: "high", needsReview: false },
  settledAt: { value: "2026-06-22", confidence: "high", needsReview: false },
  expenseModeSuggestion: "details",
  expenses: [
    {
      originalName: "油费",
      matchedExpenseTypeId: "expense-type-1",
      matchedExpenseTypeName: "油费",
      amount: { value: "200.00", confidence: "high", needsReview: false },
      occurredAt: { value: "2026-06-22", confidence: "high", needsReview: false },
      needsReview: false,
    },
  ],
  accountingNote: { value: "AI识别，会计已确认", confidence: "high", needsReview: false },
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

  it("uses HaulHub persistent session store when the service token is configured", async () => {
    const previousProvider = process.env.AI_BILL_PROVIDER;
    const previousToken = process.env.HAULHUB_SERVICE_TOKEN;
    process.env.AI_BILL_PROVIDER = "mock";
    process.env.HAULHUB_SERVICE_TOKEN = "service-token";
    const now = new Date().toISOString();
    const fetchMock = vi.fn<TestFetcher>(async () =>
      new Response(
        JSON.stringify({
          session: {
            id: "ai-session-from-api",
            teamId: "team-1",
            userId: "accountant-1",
            messages: [],
            imageUrls: [],
            reviewQuestions: [],
            warnings: [],
            createdAt: now,
            updatedAt: now,
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const app = buildApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/bill-intake/sessions",
        payload: { teamId: "team-1", userId: "accountant-1" },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().session.id).toBe("ai-session-from-api");
      const [url] = fetchMock.mock.calls[0]!;
      expect(url.toString()).toBe("http://localhost:4000/internal/ai-bill-intake/sessions");
    } finally {
      if (previousProvider === undefined) delete process.env.AI_BILL_PROVIDER;
      else process.env.AI_BILL_PROVIDER = previousProvider;
      if (previousToken === undefined) delete process.env.HAULHUB_SERVICE_TOKEN;
      else process.env.HAULHUB_SERVICE_TOKEN = previousToken;
      vi.unstubAllGlobals();
      await app.close();
    }
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

  it("awaits async bill intake session stores in HTTP routes", async () => {
    const now = new Date().toISOString();
    const session: BillIntakeSession = {
      id: "session-async-1",
      teamId: "team-1",
      userId: "accountant-1",
      messages: [],
      imageUrls: [],
      reviewQuestions: [],
      warnings: [],
      createdAt: now,
      updatedAt: now,
    };
    const asyncStore = {
      create: async () => session,
      get: async () => session,
      appendMessage: async () => session,
      updateAfterAnalysis: async () => session,
    } as unknown as BillIntakeSessionStore;
    const app = Fastify({ logger: false });
    registerBillIntakeRoutes(
      app,
      { analyze: async () => ({}) } as unknown as BillIntakeWorkflow,
      {
        async getTeamBillingContext() {
          return { vehicles: [], drivers: [], expenseTypes: [] };
        },
        async createManualCompletedTrip() {
          return { trip: { id: "trip-created" } };
        },
      },
      asyncStore,
    );

    const response = await app.inject({
      method: "POST",
      url: "/bill-intake/sessions",
      payload: { teamId: "team-1", userId: "accountant-1" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().session.id).toBe("session-async-1");
  });

  it("lists bill intake sessions through the configured session store", async () => {
    const app = Fastify({ logger: false });
    registerBillIntakeRoutes(
      app,
      { analyze: async () => ({}) } as unknown as BillIntakeWorkflow,
      {
        async getTeamBillingContext() {
          return { vehicles: [], drivers: [], expenseTypes: [] };
        },
        async createManualCompletedTrip() {
          return { trip: { id: "trip-created" } };
        },
      },
      {
        create: async () => ({}) as BillIntakeSession,
        get: async () => null,
        appendMessage: async () => null,
        updateAfterAnalysis: async () => null,
        list: async () => [
          {
            id: "ai-session-1",
            teamId: "team-1",
            userId: "accountant-1",
            status: "active",
            submittedTripId: null,
            customerName: "宏达建材",
            reviewQuestionCount: 1,
            warningCount: 0,
            imageCount: 1,
            messageCount: 2,
            createdAt: "2026-07-09T00:00:00.000Z",
            updatedAt: "2026-07-09T00:01:00.000Z",
          },
        ],
        markSubmitted: async () => null,
      } as unknown as BillIntakeSessionStore,
    );

    const response = await app.inject({
      method: "GET",
      url: "/bill-intake/sessions?teamId=team-1&userId=accountant-1",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().sessions[0]).toMatchObject({
      id: "ai-session-1",
      customerName: "宏达建材",
      reviewQuestionCount: 1,
    });
  });

  it("submits a confirmed bill intake draft to HaulHub API", async () => {
    const submissions: unknown[] = [];
    const app = buildApp({
      workflow: { analyze: async () => ({}) } as unknown as BillIntakeWorkflow,
      apiClient: {
        async getTeamBillingContext() {
          return { vehicles: [], drivers: [], expenseTypes: [] };
        },
        async createManualCompletedTrip(input: unknown) {
          submissions.push(input);
          return { trip: { id: "trip-created", status: "completed" } };
        },
      },
    });

    const createResponse = await app.inject({
      method: "POST",
      url: "/bill-intake/sessions",
      payload: { teamId: "team-1", userId: "accountant-1" },
    });
    const sessionId = createResponse.json().session.id as string;

    const response = await app.inject({
      method: "POST",
      url: `/bill-intake/sessions/${sessionId}/confirm`,
      payload: { draftPayload: confirmedDraftPayload },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().submission.trip.status).toBe("completed");
    expect(submissions).toEqual([
      {
        teamId: "team-1",
        userId: "accountant-1",
        payload: {
          vehicleId: "vehicle-1",
          driverId: "driver-1",
          customerName: "宏达建材",
          loadLocation: "福州",
          unloadLocation: "厦门",
          actualFreight: "1800.00",
          settledAt: "2026-06-22",
          accountingNote: "AI识别，会计已确认",
          expenses: [
            {
              expenseTypeId: "expense-type-1",
              amount: "200.00",
              occurredAt: "2026-06-22",
              note: "油费",
            },
          ],
        },
      },
    ]);
  });

  it("marks a bill intake session as submitted after successful confirmation", async () => {
    const submittedSessions: unknown[] = [];
    const now = new Date().toISOString();
    const session: BillIntakeSession = {
      id: "ai-session-1",
      teamId: "team-1",
      userId: "accountant-1",
      messages: [],
      imageUrls: [],
      currentDraft: confirmedDraftPayload as unknown as BillIntakeSession["currentDraft"],
      reviewQuestions: [],
      warnings: [],
      createdAt: now,
      updatedAt: now,
    };
    const app = Fastify({ logger: false });
    registerBillIntakeRoutes(
      app,
      { analyze: async () => ({}) } as unknown as BillIntakeWorkflow,
      {
        async getTeamBillingContext() {
          return { vehicles: [], drivers: [], expenseTypes: [] };
        },
        async createManualCompletedTrip() {
          return { trip: { id: "trip-created", status: "completed" } };
        },
      },
      {
        create: async () => session,
        get: async () => session,
        appendMessage: async () => session,
        updateAfterAnalysis: async () => session,
        list: async () => [],
        markSubmitted: async (sessionId: string, input: { submittedTripId: string }) => {
          submittedSessions.push({ sessionId, ...input });
          return { ...session, status: "submitted", submittedTripId: input.submittedTripId };
        },
      } as unknown as BillIntakeSessionStore,
    );

    const response = await app.inject({
      method: "POST",
      url: "/bill-intake/sessions/ai-session-1/confirm",
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    expect(submittedSessions).toEqual([{ sessionId: "ai-session-1", submittedTripId: "trip-created" }]);
  });

  it("rejects confirming a draft that still needs accountant review", async () => {
    const submissions: unknown[] = [];
    const app = buildApp({
      workflow: { analyze: async () => ({}) } as unknown as BillIntakeWorkflow,
      apiClient: {
        async getTeamBillingContext() {
          return { vehicles: [], drivers: [], expenseTypes: [] };
        },
        async createManualCompletedTrip(input: unknown) {
          submissions.push(input);
          return { trip: { id: "trip-created" } };
        },
      },
    });

    const createResponse = await app.inject({
      method: "POST",
      url: "/bill-intake/sessions",
      payload: { teamId: "team-1", userId: "accountant-1" },
    });
    const sessionId = createResponse.json().session.id as string;

    const response = await app.inject({
      method: "POST",
      url: `/bill-intake/sessions/${sessionId}/confirm`,
      payload: { draftPayload },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().reviewQuestions.map((question: { field: string }) => question.field)).toContain("vehicle");
    expect(submissions).toEqual([]);
  });
});
