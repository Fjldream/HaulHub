"use client";

import { App as AntdApp, ConfigProvider } from "antd";
import type { ReactNode } from "react";

export function AdminFeedbackProvider({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider
      theme={{
        token: {
          borderRadius: 8,
          colorError: "#c23b36",
          colorInfo: "#1262b8",
          colorPrimary: "#1262b8",
          fontFamily:
            'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", Arial, sans-serif',
        },
        components: {
          Message: {
            contentBg: "#ffffff",
            contentPadding: "12px 16px",
          },
        },
      }}
    >
      <AntdApp message={{ maxCount: 3 }}>{children}</AntdApp>
    </ConfigProvider>
  );
}
