import type {
  AiBillDraftPayload,
  AiBillIntakeAnalyzePayload,
  AiBillIntakeResult,
  AiBillIntakeSession,
  AiBillIntakeSessionSummary,
  AiReviewQuestion,
} from "@/components/admin/ai-bill-intake-model";

type Fetcher = typeof fetch;

export interface CreateAiBillIntakeSessionResponse {
  session: AiBillIntakeSession;
}

export interface ListAiBillIntakeSessionsResponse {
  sessions: AiBillIntakeSessionSummary[];
}

export interface GetAiBillIntakeSessionResponse {
  session: AiBillIntakeSession;
}

export interface AnalyzeAiBillIntakeSessionResponse {
  session: AiBillIntakeSession;
  result: AiBillIntakeResult;
}

export interface ConfirmAiBillIntakeSessionResponse {
  submission?: unknown;
  payload?: unknown;
  session?: AiBillIntakeSession;
}

export interface AiBillIntakeUploadResponse {
  file: {
    storageKey: string;
    url: string;
    mimeType: string | null;
    sizeBytes: number | null;
  };
}

export class AiBillIntakeClientError extends Error {
  readonly reviewQuestions: AiReviewQuestion[];
  readonly payload?: unknown;

  /**
   * 创建前端可识别的 AI 账单接口错误。
   *
   * @param message 展示给会计看的错误消息。
   * @param options 后端返回的结构化校验信息。
   */
  constructor(message: string, options: { reviewQuestions?: AiReviewQuestion[]; payload?: unknown } = {}) {
    super(message);
    this.name = "AiBillIntakeClientError";
    this.reviewQuestions = options.reviewQuestions ?? [];
    this.payload = options.payload;
  }
}

/**
 * 读取 JSON 响应；空响应会返回空对象，避免页面因为解析失败丢失原始 HTTP 状态。
 *
 * @param response 浏览器 fetch 响应。
 * @returns 解析后的 JSON 对象。
 */
async function readJsonResponse(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * 通过管理端代理调用 AI 账单接口。
 *
 * @param path 管理端代理路径。
 * @param body JSON 请求体。
 * @param fetcher 可注入 fetch，便于单元测试。
 * @returns 后端 JSON 响应。
 */
async function postJson<T>(path: string, body: unknown, fetcher: Fetcher = fetch): Promise<T> {
  const response = await fetcher(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await readJsonResponse(response);
  if (!response.ok) {
    throw new AiBillIntakeClientError(String(payload.message ?? "AI 账单接口请求失败。"), {
      reviewQuestions: Array.isArray(payload.reviewQuestions)
        ? (payload.reviewQuestions as AiReviewQuestion[])
        : [],
      payload: payload.payload,
    });
  }

  return payload as T;
}

/**
 * 通过管理端代理发起 GET 请求并读取 JSON 响应。
 *
 * @param path 管理端代理路径。
 * @param fetcher 可注入 fetch，便于单元测试。
 * @returns 后端 JSON 响应。
 */
async function getJson<T>(path: string, fetcher: Fetcher = fetch): Promise<T> {
  const response = await fetcher(path, { method: "GET" });
  const payload = await readJsonResponse(response);
  if (!response.ok) {
    throw new AiBillIntakeClientError(String(payload.message ?? "AI 账单接口请求失败。"), {
      reviewQuestions: Array.isArray(payload.reviewQuestions)
        ? (payload.reviewQuestions as AiReviewQuestion[])
        : [],
      payload: payload.payload,
    });
  }

  return payload as T;
}

/**
 * 创建一轮 AI 账单识别会话。
 *
 * @param fetcher 可注入 fetch，便于单元测试。
 * @returns AI 会话信息。
 */
export function createAiBillIntakeSession(
  fetcher: Fetcher = fetch,
): Promise<CreateAiBillIntakeSessionResponse> {
  return postJson<CreateAiBillIntakeSessionResponse>("/api/ai-bill-intake/sessions", {}, fetcher);
}

/**
 * 查询当前会计的 AI 补录历史会话。
 *
 * @param fetcher 可注入 fetch，便于单元测试。
 * @returns 会话历史摘要列表。
 */
export function listAiBillIntakeSessions(fetcher: Fetcher = fetch): Promise<ListAiBillIntakeSessionsResponse> {
  return getJson<ListAiBillIntakeSessionsResponse>("/api/ai-bill-intake/sessions", fetcher);
}

/**
 * 读取指定 AI 补录会话详情。
 *
 * @param sessionId AI 会话 ID。
 * @param fetcher 可注入 fetch，便于单元测试。
 * @returns 完整会话详情。
 */
export function getAiBillIntakeSession(
  sessionId: string,
  fetcher: Fetcher = fetch,
): Promise<GetAiBillIntakeSessionResponse> {
  return getJson<GetAiBillIntakeSessionResponse>(
    `/api/ai-bill-intake/sessions/${encodeURIComponent(sessionId)}`,
    fetcher,
  );
}

/**
 * 基于当前会话材料和对话上下文触发 Agent 分析。
 *
 * @param sessionId AI 会话 ID。
 * @param payload 会计输入的图片/文字材料。
 * @param fetcher 可注入 fetch，便于单元测试。
 * @returns 最新会话和分析结果。
 */
export function analyzeAiBillIntakeSession(
  sessionId: string,
  payload: AiBillIntakeAnalyzePayload,
  fetcher: Fetcher = fetch,
): Promise<AnalyzeAiBillIntakeSessionResponse> {
  return postJson<AnalyzeAiBillIntakeSessionResponse>(
    `/api/ai-bill-intake/sessions/${encodeURIComponent(sessionId)}/analyze`,
    payload,
    fetcher,
  );
}

/**
 * 把会计确认后的草稿提交给 AI 服务，再由 AI 服务转交主后端校验和入账。
 *
 * @param sessionId AI 会话 ID。
 * @param draftPayload 会计最终确认的 AI 草稿。
 * @param fetcher 可注入 fetch，便于单元测试。
 * @returns 主后端提交结果。
 */
export function confirmAiBillIntakeSession(
  sessionId: string,
  draftPayload: AiBillDraftPayload,
  fetcher: Fetcher = fetch,
): Promise<ConfirmAiBillIntakeSessionResponse> {
  return postJson<ConfirmAiBillIntakeSessionResponse>(
    `/api/ai-bill-intake/sessions/${encodeURIComponent(sessionId)}/confirm`,
    { draftPayload },
    fetcher,
  );
}

/**
 * 上传账单图片到主后端文件服务，并返回 AI 可读取的图片 URL。
 *
 * @param file 会计选择的图片文件。
 * @param fetcher 可注入 fetch，便于单元测试。
 * @returns 上传后的文件信息。
 */
export async function uploadAiBillIntakeImage(
  file: File,
  fetcher: Fetcher = fetch,
): Promise<AiBillIntakeUploadResponse> {
  const formData = new FormData();
  formData.set("file", file);
  const response = await fetcher("/api/ai-bill-intake/uploads", {
    method: "POST",
    body: formData,
  });
  const payload = await readJsonResponse(response);
  if (!response.ok) {
    throw new AiBillIntakeClientError(String(payload.message ?? "账单图片上传失败。"));
  }

  return payload as unknown as AiBillIntakeUploadResponse;
}
