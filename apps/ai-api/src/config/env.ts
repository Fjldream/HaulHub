/**
 * AI 服务运行时配置。
 *
 * 这些配置只属于独立的 `apps/ai-api` 服务，不直接影响主业务后端。
 * 其中 OpenAI Key 和模型配置后续可以替换为国内模型 Provider 的配置。
 */
export type AiApiConfig = {
  port: number;
  provider: "openai" | "mock";
  model: string;
  openAiTimeoutMs: number;
  openAiApiKey: string;
  openAiProxyUrl?: string;
  haulHubApiBaseUrl: string;
  haulHubServiceToken: string;
  sessionStore: "memory" | "haulhub";
};

/**
 * 从环境变量读取 AI 服务配置，并提供本地开发默认值。
 *
 * 这里保持为函数而不是模块级常量，避免 `.env` 尚未加载时提前读取 `process.env`。
 */
export function getAiApiConfig(env: Record<string, string | undefined> = process.env): AiApiConfig {
  const provider = env.AI_BILL_PROVIDER === "mock" ? "mock" : "openai";
  const sessionStore =
    env.AI_BILL_SESSION_STORE === "memory" ? "memory" : env.HAULHUB_SERVICE_TOKEN ? "haulhub" : "memory";
  return {
    port: Number(env.AI_API_PORT ?? 4100),
    provider,
    model: env.AI_BILL_MODEL ?? "gpt-5.5",
    openAiTimeoutMs: Number(env.OPENAI_TIMEOUT_MS ?? 120_000),
    openAiApiKey: env.OPENAI_API_KEY ?? "",
    openAiProxyUrl: env.OPENAI_PROXY_URL?.trim() || env.HTTPS_PROXY?.trim() || env.HTTP_PROXY?.trim() || undefined,
    haulHubApiBaseUrl: env.HAULHUB_API_BASE_URL ?? "http://localhost:4000",
    haulHubServiceToken: env.HAULHUB_SERVICE_TOKEN ?? "",
    sessionStore,
  };
}
