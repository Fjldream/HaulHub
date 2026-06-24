import { buildApp } from "./app";
import { getAiApiConfig } from "./config/env";

const config = getAiApiConfig();
const app = buildApp();

await app.listen({ host: "0.0.0.0", port: config.port });
