import {
  forwardAiBillIntakeRequest,
  getAiBillIntakeIdentity,
  readJsonBody,
} from "@/lib/ai-bill-intake-proxy";

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
 * 提交会计确认后的 AI 草稿。
 *
 * @param request 当前 HTTP 请求。
 * @param context 动态路由上下文。
 * @returns AI 服务和主后端的确认提交结果。
 */
export async function POST(request: Request, context: SessionRouteContext) {
  const identity = await getAiBillIntakeIdentity();
  if (!identity.ok) {
    return identity.response;
  }

  const sessionId = await getSessionId(context);
  const body = await readJsonBody(request);
  return forwardAiBillIntakeRequest(`/bill-intake/sessions/${encodeURIComponent(sessionId)}/confirm`, {
    method: "POST",
    body,
  });
}
