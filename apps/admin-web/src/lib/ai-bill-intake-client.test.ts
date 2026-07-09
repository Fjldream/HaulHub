import { describe, expect, it, vi } from "vitest";
import {
  analyzeAiBillIntakeSession,
  createAiBillIntakeSession,
  getAiBillIntakeSession,
  listAiBillIntakeSessions,
} from "./ai-bill-intake-client";

describe("ai bill intake browser client", () => {
  it("creates a session through the admin proxy", async () => {
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify({ session: { id: "session-1" } }), { status: 200 }),
    );

    const result = await createAiBillIntakeSession(fetcher);

    expect(fetcher).toHaveBeenCalledWith("/api/ai-bill-intake/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(result.session.id).toBe("session-1");
  });

  it("throws the proxy error message when analysis fails", async () => {
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify({ message: "账单草稿仍有必填信息需要确认。" }), { status: 409 }),
    );

    await expect(
      analyzeAiBillIntakeSession(
        "session-1",
        {
          inputMode: "text",
          textNote: "只有油费",
          imageUrls: [],
        },
        fetcher,
      ),
    ).rejects.toThrow("账单草稿仍有必填信息需要确认。");
  });

  it("lists and reads persisted sessions through the admin proxy", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            sessions: [
              {
                id: "session-1",
                status: "active",
                customerName: "宏达建材",
                reviewQuestionCount: 1,
                warningCount: 0,
                imageCount: 1,
                messageCount: 2,
                createdAt: "2026-07-09T00:00:00.000Z",
                updatedAt: "2026-07-09T00:01:00.000Z",
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ session: { id: "session-1" } }), { status: 200 }));

    const listed = await listAiBillIntakeSessions(fetcher);
    const detail = await getAiBillIntakeSession("session-1", fetcher);

    expect(fetcher).toHaveBeenNthCalledWith(1, "/api/ai-bill-intake/sessions", {
      method: "GET",
    });
    expect(fetcher).toHaveBeenNthCalledWith(2, "/api/ai-bill-intake/sessions/session-1", {
      method: "GET",
    });
    expect(listed.sessions[0]?.customerName).toBe("宏达建材");
    expect(detail.session.id).toBe("session-1");
  });
});
