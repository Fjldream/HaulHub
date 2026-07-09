import { forwardAiBillIntakeRequest, getAiBillIntakeIdentity } from "@/lib/ai-bill-intake-proxy";

/**
 * 创建 AI 账单识别会话。
 *
 * @returns AI 服务返回的会话信息。
 */
export async function POST() {
  const identity = await getAiBillIntakeIdentity();
  if (!identity.ok) {
    return identity.response;
  }

  return forwardAiBillIntakeRequest("/bill-intake/sessions", {
    method: "POST",
    body: identity.identity,
  });
}

/**
 * 查询当前会计的 AI 账单识别历史会话。
 *
 * @returns AI 服务返回的会话历史摘要列表。
 */
export async function GET() {
  const identity = await getAiBillIntakeIdentity();
  if (!identity.ok) {
    return identity.response;
  }

  const query = new URLSearchParams({
    teamId: identity.identity.teamId,
    userId: identity.identity.userId,
  });
  return forwardAiBillIntakeRequest(`/bill-intake/sessions?${query.toString()}`, {
    method: "GET",
  });
}
