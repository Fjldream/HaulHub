import { resolve } from "node:path";

function toPrismaFileUrl(path: string): string {
  return `file:${path.replace(/\\/g, "/")}`;
}

export function ensureDatabaseUrl(
  env: Record<string, string | undefined> = process.env,
  appRoot = process.cwd(),
): string {
  if (env.DATABASE_URL) {
    return env.DATABASE_URL;
  }

  const databaseUrl = toPrismaFileUrl(resolve(appRoot, "prisma/dev.db"));
  env.DATABASE_URL = databaseUrl;
  return databaseUrl;
}
