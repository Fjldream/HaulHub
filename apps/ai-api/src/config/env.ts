export type AiApiConfig = {
  port: number;
  provider: "openai";
  model: string;
  openAiApiKey: string;
  haulHubApiBaseUrl: string;
  haulHubServiceToken: string;
};

export function getAiApiConfig(env: Record<string, string | undefined> = process.env): AiApiConfig {
  return {
    port: Number(env.AI_API_PORT ?? 4100),
    provider: "openai",
    model: env.AI_BILL_MODEL ?? "gpt-5.5",
    openAiApiKey: env.OPENAI_API_KEY ?? "",
    haulHubApiBaseUrl: env.HAULHUB_API_BASE_URL ?? "http://localhost:4000",
    haulHubServiceToken: env.HAULHUB_SERVICE_TOKEN ?? "",
  };
}
