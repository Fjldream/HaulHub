import { createSSRApp } from "vue";
import App from "./App.vue";
import AppIcon from "@/components/AppIcon.vue";

export function createApp() {
  const app = createSSRApp(App);
  app.component("AppIcon", AppIcon);
  return { app };
}
