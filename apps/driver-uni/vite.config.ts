import { defineConfig } from "vite";
import uniPlugin from "@dcloudio/vite-plugin-uni";

const uni = (
  typeof uniPlugin === "function"
    ? uniPlugin
    : (uniPlugin as unknown as { default: typeof uniPlugin }).default
) as typeof uniPlugin;

export default defineConfig({
  plugins: [uni()],
});
