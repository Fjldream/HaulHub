import { describe, expect, it } from "vitest";
import { ensureDatabaseUrl } from "../src/env";

describe("API environment", () => {
  it("uses the local SQLite database when DATABASE_URL is not set", () => {
    const env: Record<string, string | undefined> = {};

    const databaseUrl = ensureDatabaseUrl(env, "E:\\code\\HaulHub\\apps\\api");

    expect(databaseUrl).toBe("file:E:/code/HaulHub/apps/api/prisma/dev.db");
    expect(env.DATABASE_URL).toBe(databaseUrl);
  });
});
