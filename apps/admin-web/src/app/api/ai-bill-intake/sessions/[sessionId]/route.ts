import { forwardAiBillIntakeRequest, getAiBillIntakeIdentity } from "@/lib/ai-bill-intake-proxy";

interface SessionRouteContext {
  params: Promise<{ sessionId: string }> | { sessionId: string };
}

/**
 * 读取动态路由中的 AI 会话 ID。
 *
 * @param context Next route handler 上下文。
 * @returns 会话 ID。
 */
async function getSessionId(context: SessionRouteContext): Promise<string> {
  const params = await context.params;
  return params.sessionId;
}

/**
 * 获取 AI 账单识别会话详情。
 *
 * @param _request 当前 HTTP 请求。
 * @param context 动态路由上下文。
 * @returns AI 服务返回的会话详情。
 */
export async function GET(_request: Request, context: SessionRouteContext) {
  const identity = await getAiBillIntakeIdentity();
  if (!identity.ok) {
    return identity.response;
  }

  const sessionId = await getSessionId(context);
  return forwardAiBillIntakeRequest(`/bill-intake/sessions/${encodeURIComponent(sessionId)}`, {
    method: "GET",
  });
}
