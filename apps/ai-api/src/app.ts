import cors from "@fastify/cors";
import Fastify from "fastify";
import { BillIntakeWorkflow } from "./modules/bill-intake/agent/workflow";
import { registerBillIntakeRoutes } from "./modules/bill-intake/http/routes";
import { getAiApiConfig } from "./config/env";
import { HttpHaulHubApiClient, type HaulHubApiClient } from "./clients/haulhub-api-client";
import { OpenAiResponsesAgentProvider } from "./modules/bill-intake/providers/openai-provider";
import type { AgentProvider } from "./modules/bill-intake/providers/agent-provider";

export function createDefaultWorkflow() {
  const dependencies = createDefaultDependencies();
  return new BillIntakeWorkflow(dependencies);
}

function createDefaultDependencies() {
  const config = getAiApiConfig();
  return {
    provider: new OpenAiResponsesAgentProvider({
      apiKey: config.openAiApiKey,
      model: config.model,
    }),
    apiClient: new HttpHaulHubApiClient({
      baseUrl: config.haulHubApiBaseUrl,
      serviceToken: config.haulHubServiceToken,
    }),
  };
}

export function buildApp(
  dependencies: {
    workflow?: BillIntakeWorkflow;
    provider?: AgentProvider;
    apiClient?: HaulHubApiClient;
  } = {},
) {
  const app = Fastify({ logger: false });
  const defaultDependencies = dependencies.workflow ? null : createDefaultDependencies();
  const workflow = dependencies.workflow ?? new BillIntakeWorkflow({
    provider: dependencies.provider ?? defaultDependencies!.provider,
    apiClient: dependencies.apiClient ?? defaultDependencies!.apiClient,
  });

  app.register(cors);

  app.get("/health", async () => ({
    ok: true,
    service: "haulhub-ai-api",
  }));

  registerBillIntakeRoutes(app, workflow);

  return app;
}
