import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

function toPrismaFileUrl(path: string): string {
  return `file:${path.replace(/\\/g, "/")}`;
}

function normalizeDatabaseUrl(databaseUrl: string, appRoot: string): string {
  if (!databaseUrl.startsWith("file:")) {
    return databaseUrl;
  }

  const filePath = databaseUrl.slice("file:".length);
  if (!filePath || filePath.startsWith("/") || /^[A-Za-z]:[\\/]/.test(filePath) || isAbsolute(filePath)) {
    return databaseUrl;
  }

  const normalizedPath = filePath.replace(/\\/g, "/");
  const base = normalizedPath.startsWith("./apps/api/") || normalizedPath.startsWith("apps/api/")
    ? resolve(appRoot, "../..")
    : appRoot;

  return toPrismaFileUrl(resolve(base, filePath));
}

function parseEnvFile(contents: string) {
  const entries: Record<string, string> = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    entries[key] = value;
  }
  return entries;
}

export function loadLocalEnvFiles(
  env: Record<string, string | undefined> = process.env,
  appRoot = process.cwd(),
) {
  const workspaceRoot = resolve(appRoot, "../..");
  const candidates = [resolve(workspaceRoot, ".env"), resolve(workspaceRoot, "deploy/.env")];

  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue;
    const entries = parseEnvFile(readFileSync(filePath, "utf8"));
    for (const [key, value] of Object.entries(entries)) {
      if (env[key] === undefined) {
        env[key] = value;
      }
    }
  }
}

export function ensureDatabaseUrl(
  env: Record<string, string | undefined> = process.env,
  appRoot = process.cwd(),
): string {
  if (env.DATABASE_URL) {
    env.DATABASE_URL = normalizeDatabaseUrl(env.DATABASE_URL, appRoot);
    return env.DATABASE_URL;
  }

  const databaseUrl = toPrismaFileUrl(resolve(appRoot, "prisma/dev.db"));
  env.DATABASE_URL = databaseUrl;
  return databaseUrl;
}
