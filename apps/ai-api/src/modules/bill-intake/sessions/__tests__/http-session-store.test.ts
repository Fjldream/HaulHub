import { describe, expect, it, vi } from "vitest";
import { HttpBillIntakeSessionStore } from "../http-session-store";
import type { BillIntakeResult } from "../../domain/types";
import type { BillIntakeSession } from "../session-store";

type TestFetcher = (url: URL, init?: RequestInit) => Promise<Response>;

const now = "2026-07-09T02:30:00.000Z";
const session: BillIntakeSession = {
  id: "ai-session-1",
  teamId: "team-1",
  userId: "accountant-1",
  messages: [],
  imageUrls: [],
  reviewQuestions: [],
  warnings: [],
  createdAt: now,
  updatedAt: now,
};

/**
 * 生成一个主后端会话接口使用的 JSON 响应。
 *
 * @param body 需要序列化返回的响应体。
 * @param status HTTP 状态码。
 * @returns 可供测试 fetcher 返回的 Response。
 */
function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("HttpBillIntakeSessionStore", () => {
  it("creates bill intake sessions through HaulHub internal API", async () => {
    const fetcher = vi.fn<TestFetcher>(async () => jsonResponse({ session }));
    const store = new HttpBillIntakeSessionStore({
      baseUrl: "http://localhost:4000/base-path",
      serviceToken: "service-token",
      fetcher,
    });

    const created = await store.create({ teamId: "team-1", userId: "accountant-1" });

    expect(created.id).toBe("ai-session-1");
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url.toString()).toBe("http://localhost:4000/internal/ai-bill-intake/sessions");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      authorization: "Bearer service-token",
      "content-type": "application/json",
    });
    expect(JSON.parse(String(init?.body))).toEqual({ teamId: "team-1", userId: "accountant-1" });
  });

  it("appends messages and persists analysis results through HaulHub internal API", async () => {
    const analyzedSession = {
      ...session,
      messages: [{ role: "assistant", content: "草稿已生成" }],
      imageUrls: ["data:image/jpeg;base64,abc"],
      warnings: ["需要确认车牌"],
    } satisfies BillIntakeSession;
    const fetcher = vi
      .fn<TestFetcher>()
      .mockResolvedValueOnce(jsonResponse({ session: { ...session, messages: [{ role: "user", content: "运费800" }] } }))
      .mockResolvedValueOnce(jsonResponse({ session: analyzedSession }));
    const result = {
      provider: "test",
      rawAgentResult: {},
      draftPayload: undefined,
      reviewQuestions: [],
      warnings: ["需要确认车牌"],
      reply: "草稿已生成",
    } as unknown as BillIntakeResult;
    const store = new HttpBillIntakeSessionStore({
      baseUrl: "http://localhost:4000",
      serviceToken: "service-token",
      fetcher,
    });

    await store.appendMessage("ai-session-1", { role: "user", content: "运费800" });
    const updated = await store.updateAfterAnalysis("ai-session-1", {
      imageUrls: ["data:image/jpeg;base64,abc"],
      result,
    });

    expect(updated?.warnings).toEqual(["需要确认车牌"]);
    expect(fetcher.mock.calls[0]?.[0].toString()).toBe(
      "http://localhost:4000/internal/ai-bill-intake/sessions/ai-session-1/messages",
    );
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({ role: "user", content: "运费800" });
    expect(fetcher.mock.calls[1]?.[0].toString()).toBe(
      "http://localhost:4000/internal/ai-bill-intake/sessions/ai-session-1/analysis",
    );
    expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body))).toEqual({
      imageUrls: ["data:image/jpeg;base64,abc"],
      result,
    });
  });

  it("lists sessions and marks successful submissions through HaulHub internal API", async () => {
    const submittedSession = { ...session, status: "submitted", submittedTripId: "trip-created" };
    const fetcher = vi
      .fn<TestFetcher>()
      .mockResolvedValueOnce(
        jsonResponse({
          sessions: [
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
              createdAt: now,
              updatedAt: now,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ session: submittedSession }));
    const store = new HttpBillIntakeSessionStore({
      baseUrl: "http://localhost:4000",
      serviceToken: "service-token",
      fetcher,
    });

    const sessions = await store.list({ teamId: "team-1", userId: "accountant-1", limit: 10 });
    const marked = await store.markSubmitted("ai-session-1", { submittedTripId: "trip-created" });

    expect(sessions[0]?.customerName).toBe("宏达建材");
    expect(marked?.submittedTripId).toBe("trip-created");
    expect(fetcher.mock.calls[0]?.[0].toString()).toBe(
      "http://localhost:4000/internal/ai-bill-intake/sessions?teamId=team-1&userId=accountant-1&limit=10",
    );
    expect(fetcher.mock.calls[1]?.[0].toString()).toBe(
      "http://localhost:4000/internal/ai-bill-intake/sessions/ai-session-1/submission",
    );
    expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body))).toEqual({ submittedTripId: "trip-created" });
  });

  it("returns null when the HaulHub session no longer exists", async () => {
    const fetcher = vi.fn<TestFetcher>(async () => jsonResponse({ message: "not found" }, 404));
    const store = new HttpBillIntakeSessionStore({
      baseUrl: "http://localhost:4000",
      serviceToken: "service-token",
      fetcher,
    });

    const missing = await store.get("missing-session");

    expect(missing).toBeNull();
  });

  it("fails before requesting HaulHub API when the internal service token is missing", async () => {
    const fetcher = vi.fn();
    const store = new HttpBillIntakeSessionStore({
      baseUrl: "http://localhost:4000",
      serviceToken: "",
      fetcher,
    });

    await expect(store.create({ teamId: "team-1", userId: "accountant-1" })).rejects.toThrow(
      "HAULHUB_SERVICE_TOKEN",
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
});
