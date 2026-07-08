import cors from "@fastify/cors";
import Fastify from "fastify";
import { BillIntakeWorkflow } from "./modules/bill-intake/agent/workflow";
import { registerBillIntakeRoutes } from "./modules/bill-intake/http/routes";
import { getAiApiConfig } from "./config/env";
import { HttpHaulHubApiClient, type HaulHubApiClient } from "./clients/haulhub-api-client";
import { OpenAiResponsesAgentProvider } from "./modules/bill-intake/providers/openai-provider";
import { MockBillIntakeAgentProvider } from "./modules/bill-intake/providers/mock-provider";
import type { AgentProvider } from "./modules/bill-intake/providers/agent-provider";

/**
 * 创建生产环境默认的账单识别工作流。
 *
 * 默认工作流会使用 OpenAI Provider 和主业务后端 HTTP 客户端。
 * 测试时通常不走这个函数，而是通过 `buildApp()` 注入假的 workflow/provider。
 */
export function createDefaultWorkflow() {
  const dependencies = createDefaultDependencies();
  return new BillIntakeWorkflow(dependencies);
}

/**
 * 创建生产默认依赖。
 *
 * 这里集中装配模型 Provider 和 HaulHub API 客户端，避免路由层直接关心外部服务细节。
 */
function createDefaultDependencies() {
  const config = getAiApiConfig();
  const provider =
    config.provider === "mock"
      ? new MockBillIntakeAgentProvider()
      : new OpenAiResponsesAgentProvider({
          apiKey: config.openAiApiKey,
          model: config.model,
          timeoutMs: config.openAiTimeoutMs,
        });

  return {
    provider,
    apiClient: new HttpHaulHubApiClient({
      baseUrl: config.haulHubApiBaseUrl,
      serviceToken: config.haulHubServiceToken,
    }),
  };
}

/**
 * 构建 AI API 的 Fastify 应用。
 *
 * `dependencies` 参数用于测试或本地替换 Provider。生产环境不传时会自动使用默认 OpenAI
 * Provider 和主业务后端客户端。
 */
export function buildApp(
  dependencies: {
    workflow?: BillIntakeWorkflow;
    provider?: AgentProvider;
    apiClient?: HaulHubApiClient;
  } = {},
) {
  const app = Fastify({ logger: false });
  const defaultDependencies = createDefaultDependencies();
  const apiClient = dependencies.apiClient ?? defaultDependencies.apiClient;
  const workflow = dependencies.workflow ?? new BillIntakeWorkflow({
    provider: dependencies.provider ?? defaultDependencies!.provider,
    apiClient,
  });

  app.register(cors);

  app.get("/health", async () => ({
    ok: true,
    service: "haulhub-ai-api",
  }));

  registerBillIntakeRoutes(app, workflow, apiClient);

  return app;
}
