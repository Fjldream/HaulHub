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
