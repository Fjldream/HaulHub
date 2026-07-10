import { describe, expect, it } from "vitest";
import { getAiApiConfig } from "../env";

describe("AI API runtime config", () => {
  it("reads the optional OpenAI proxy URL", () => {
    const config = getAiApiConfig({
      OPENAI_API_KEY: "test-key",
      OPENAI_PROXY_URL: "http://127.0.0.1:7897",
    });

    expect(config.openAiProxyUrl).toBe("http://127.0.0.1:7897");
  });
});
