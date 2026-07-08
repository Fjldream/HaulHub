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
  openAiApiKey: string;
  haulHubApiBaseUrl: string;
  haulHubServiceToken: string;
};

/**
 * 从环境变量读取 AI 服务配置，并提供本地开发默认值。
 *
 * 这里保持为函数而不是模块级常量，避免 `.env` 尚未加载时提前读取 `process.env`。
 */
export function getAiApiConfig(env: Record<string, string | undefined> = process.env): AiApiConfig {
  const provider = env.AI_BILL_PROVIDER === "mock" ? "mock" : "openai";
  return {
    port: Number(env.AI_API_PORT ?? 4100),
    provider,
    model: env.AI_BILL_MODEL ?? "gpt-5.5",
    openAiApiKey: env.OPENAI_API_KEY ?? "",
    haulHubApiBaseUrl: env.HAULHUB_API_BASE_URL ?? "http://localhost:4000",
    haulHubServiceToken: env.HAULHUB_SERVICE_TOKEN ?? "",
  };
}
