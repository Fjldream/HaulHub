import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { ensureDatabaseUrl, loadLocalEnvFiles } from "../src/env";

describe("API environment", () => {
  it("uses the local SQLite database when DATABASE_URL is not set", () => {
    const env: Record<string, string | undefined> = {};

    const databaseUrl = ensureDatabaseUrl(env, "E:\\code\\HaulHub\\apps\\api");

    expect(databaseUrl).toBe("file:E:/code/HaulHub/apps/api/prisma/dev.db");
    expect(env.DATABASE_URL).toBe(databaseUrl);
  });

  it("loads local development variables from deploy .env without overriding existing values", () => {
    const workspace = mkdtempSync(join(tmpdir(), "haulhub-env-"));
    mkdirSync(join(workspace, "apps", "api"), { recursive: true });
    mkdirSync(join(workspace, "deploy"));
    writeFileSync(
      join(workspace, "deploy", ".env"),
      [
        "AMAP_WEB_SERVICE_KEY=local-map-key",
        "PORT=4100",
        "NEXT_PUBLIC_API_BASE_URL=/api",
      ].join("\n"),
    );
    const env: Record<string, string | undefined> = { PORT: "4000" };

    loadLocalEnvFiles(env, join(workspace, "apps", "api"));

    expect(env.AMAP_WEB_SERVICE_KEY).toBe("local-map-key");
    expect(env.PORT).toBe("4000");
    expect(env.NEXT_PUBLIC_API_BASE_URL).toBe("/api");
  });
});
