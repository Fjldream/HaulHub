import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * 解析本地 .env 文件内容。
 *
 * @param contents .env 文件原始文本。
 * @returns 解析后的环境变量键值表。
 */
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

/**
 * 加载 AI 服务本地环境变量文件。
 *
 * 已存在的进程环境变量优先级最高；本地文件只补齐缺失配置，避免覆盖命令行或部署平台注入的真实配置。
 *
 * @param env 待写入的环境变量对象，默认使用 `process.env`。
 * @param appRoot AI 服务应用根目录，通常是 `apps/ai-api`。
 */
export function loadAiApiLocalEnvFiles(
  env: Record<string, string | undefined> = process.env,
  appRoot = process.cwd(),
) {
  const workspaceRoot = resolve(appRoot, "../..");
  const candidates = [
    resolve(appRoot, ".env.local"),
    resolve(appRoot, ".env"),
    resolve(workspaceRoot, ".env"),
    resolve(workspaceRoot, "deploy/.env"),
  ];

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
