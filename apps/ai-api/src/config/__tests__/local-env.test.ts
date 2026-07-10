import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadAiApiLocalEnvFiles } from "../local-env";

describe("AI API local environment", () => {
  it("loads app local variables without overriding existing process values", () => {
    const workspace = mkdtempSync(join(tmpdir(), "haulhub-ai-env-"));
    const appRoot = join(workspace, "apps", "ai-api");
    mkdirSync(appRoot, { recursive: true });
    writeFileSync(
      join(appRoot, ".env.local"),
      [
        "OPENAI_API_KEY=local-openai-key",
        "AI_BILL_MODEL=gpt-4o-mini",
        "HAULHUB_SERVICE_TOKEN=local-service-token",
      ].join("\n"),
    );
    const env: Record<string, string | undefined> = {
      AI_BILL_MODEL: "existing-model",
    };

    loadAiApiLocalEnvFiles(env, appRoot);

    expect(env.OPENAI_API_KEY).toBe("local-openai-key");
    expect(env.AI_BILL_MODEL).toBe("existing-model");
    expect(env.HAULHUB_SERVICE_TOKEN).toBe("local-service-token");
  });
});
