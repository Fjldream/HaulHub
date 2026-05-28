import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureDatabaseUrl } from "./env";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
ensureDatabaseUrl(process.env, appRoot);

const { buildApp } = await import("./app");

const app = buildApp();
const port = Number(process.env.PORT ?? 4000);

await app.listen({ port, host: "0.0.0.0" });
