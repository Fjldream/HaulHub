import { describe, expect, it, vi } from "vitest";
import { analyzeAiBillIntakeSession, createAiBillIntakeSession } from "./ai-bill-intake-client";

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
      analyzeAiBillIntakeSession("session-1", {
        inputMode: "text",
        textNote: "只有油费",
        imageUrls: [],
      }, fetcher),
    ).rejects.toThrow("账单草稿仍有必填信息需要确认。");
  });
});
