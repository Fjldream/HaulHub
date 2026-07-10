import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildApp } from "./app";
import { getAiApiConfig } from "./config/env";
import { loadAiApiLocalEnvFiles } from "./config/local-env";

/**
 * AI 服务启动入口。
 *
 * 这个服务独立监听 `AI_API_PORT`，后续可以和主业务 API 分开部署、扩缩容和配置模型密钥。
 */
const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadAiApiLocalEnvFiles(process.env, appRoot);

const config = getAiApiConfig();
const app = buildApp();

await app.listen({ host: "0.0.0.0", port: config.port });
