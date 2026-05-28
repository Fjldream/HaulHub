import { redirect } from "next/navigation";

export function actionErrorMessage(error: unknown, fallback = "操作失败，请稍后重试") {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export function redirectWithActionError(path: string, error: unknown, fallback?: string): never {
  const url = new URL(path, "http://localhost");
  url.searchParams.set("error", actionErrorMessage(error, fallback));
  redirect(`${url.pathname}${url.search}`);
}
