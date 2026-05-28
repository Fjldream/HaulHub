"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { AdminFeedbackProvider } from "@/components/admin/admin-feedback-provider";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const message = error.message || "页面加载失败，请稍后重试";

  return (
    <AdminFeedbackProvider>
      <main className="admin-error-page">
        <section className="admin-error-card">
          <div className="admin-error-icon">
            <AlertTriangle size={30} />
          </div>
          <div>
            <span>HaulHub 管理端</span>
            <h1>页面加载失败</h1>
            <p>{message}</p>
          </div>
          <button className="primary-button" onClick={reset} type="button">
            <RotateCcw size={16} />
            重新加载
          </button>
        </section>
      </main>
    </AdminFeedbackProvider>
  );
}
