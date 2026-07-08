import { getAdminSession } from "@/lib/admin-session";

const aiApiBaseUrl = (
  process.env.NEXT_INTERNAL_AI_API_BASE_URL ??
  process.env.AI_INTERNAL_API_BASE_URL ??
  process.env.AI_API_BASE_URL ??
  "http://localhost:4100"
).replace(/\/$/, "");

interface AiBillIntakeIdentity {
  teamId: string;
  userId: string;
}

type AiBillIntakeIdentityResult =
  | { ok: true; identity: AiBillIntakeIdentity }
  | { ok: false; response: Response };

/**
 * 从后台登录态中读取 AI 账单识别需要的团队和用户身份。
 *
 * @returns 身份信息；未登录或未选择团队时返回 JSON 错误响应。
 */
export async function getAiBillIntakeIdentity(): Promise<AiBillIntakeIdentityResult> {
  const session = await getAdminSession();
  if (!session) {
    return { ok: false, response: Response.json({ message: "请先登录后台。" }, { status: 401 }) };
  }
  if (!session.activeTeamId) {
    return { ok: false, response: Response.json({ message: "请先选择团队。" }, { status: 400 }) };
  }

  return {
    ok: true,
    identity: {
      teamId: session.activeTeamId,
      userId: session.userId,
    },
  };
}

/**
 * 安全读取前端传入的 JSON 请求体。
 *
 * @param request Next route 收到的请求。
 * @returns JSON 对象；空请求体返回空对象。
 */
export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * 构建独立 AI 服务的完整请求 URL。
 *
 * @param path AI 服务内部路径。
 * @returns 可直接传给 fetch 的 URL。
 */
function buildAiBillIntakeUrl(path: string): string {
  return `${aiApiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * 把管理端 API 请求转发给独立 AI 服务。
 *
 * @param path AI 服务路径。
 * @param init 转发请求参数。
 * @returns 保留状态码和 JSON 内容的响应。
 */
export async function forwardAiBillIntakeRequest(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown },
): Promise<Response> {
  try {
    const response = await fetch(buildAiBillIntakeUrl(path), {
      method: init.method,
      headers: init.body == null ? undefined : { "content-type": "application/json" },
      body: init.body == null ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });
    const text = await response.text();
    return new Response(text || "{}", {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 服务暂时不可用。";
    return Response.json({ message }, { status: 502 });
  }
}
