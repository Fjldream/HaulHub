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
