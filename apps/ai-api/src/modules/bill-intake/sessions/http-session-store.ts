import { z } from "zod";
import { agentMessageSchema, aiBillDraftPayloadSchema, billIntakeResultSchema, reviewQuestionSchema } from "../domain/schemas";
import type { AgentMessage, BillIntakeResult } from "../domain/types";
import type {
  BillIntakeSession,
  BillIntakeSessionStore,
  BillIntakeSessionSummary,
  CreateBillIntakeSessionInput,
  ListBillIntakeSessionsInput,
} from "./session-store";

type SessionStoreFetcher = (url: URL, init?: RequestInit) => Promise<Response>;

const billIntakeSessionSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  userId: z.string(),
  status: z.string().optional(),
  submittedTripId: z.string().nullable().optional(),
  messages: z.array(agentMessageSchema),
  imageUrls: z.array(z.string()),
  currentDraft: aiBillDraftPayloadSchema.optional(),
  reviewQuestions: z.array(reviewQuestionSchema),
  warnings: z.array(z.string()),
  lastResult: billIntakeResultSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const billIntakeSessionResponseSchema = z.object({
  session: billIntakeSessionSchema,
});

const billIntakeSessionSummarySchema = z.object({
  id: z.string(),
  teamId: z.string(),
  userId: z.string(),
  status: z.string(),
  submittedTripId: z.string().nullable().optional(),
  customerName: z.string().optional(),
  loadLocation: z.string().optional(),
  unloadLocation: z.string().optional(),
  settledAt: z.string().optional(),
  actualFreight: z.string().optional(),
  reviewQuestionCount: z.number(),
  warningCount: z.number(),
  imageCount: z.number(),
  messageCount: z.number(),
  lastReply: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const billIntakeSessionListResponseSchema = z.object({
  sessions: z.array(billIntakeSessionSummarySchema),
});

/**
 * 通过主后端内部接口持久化 AI 补录会话的存储实现。
 *
 * 该类把 ai-api 的会话读写转换成 `apps/api` 的内部 HTTP 调用，让会话在 ai-api 重启后仍可恢复。
 */
export class HttpBillIntakeSessionStore implements BillIntakeSessionStore {
  private readonly fetcher: SessionStoreFetcher;

  constructor(private readonly options: { baseUrl: string; serviceToken: string; fetcher?: SessionStoreFetcher }) {
    this.fetcher = options.fetcher ?? fetch;
  }

  /**
   * 在主后端创建一个新的 AI 补录会话。
   *
   * @param input 会话所属团队和会计用户。
   * @returns 主后端保存后的会话快照。
   */
  async create(input: CreateBillIntakeSessionInput) {
    return this.requestSession("/internal/ai-bill-intake/sessions", {
      method: "POST",
      body: input,
    });
  }

  /**
   * 从主后端查询当前会计的 AI 补录会话历史摘要。
   *
   * @param input 团队、会计用户和可选数量限制。
   * @returns 会话历史摘要列表。
   */
  async list(input: ListBillIntakeSessionsInput) {
    const url = new URL("/internal/ai-bill-intake/sessions", this.options.baseUrl);
    url.searchParams.set("teamId", input.teamId);
    url.searchParams.set("userId", input.userId);
    if (input.limit) url.searchParams.set("limit", String(input.limit));

    const response = await this.request(url, { method: "GET" });
    return billIntakeSessionListResponseSchema.parse(await response.json()).sessions as BillIntakeSessionSummary[];
  }

  /**
   * 从主后端读取指定 AI 补录会话。
   *
   * @param sessionId 会话 ID。
   * @returns 会话存在时返回会话快照，不存在时返回 null。
   */
  async get(sessionId: string) {
    return this.requestNullableSession(`/internal/ai-bill-intake/sessions/${encodeURIComponent(sessionId)}`, {
      method: "GET",
    });
  }

  /**
   * 向主后端追加一条会计或 Agent 对话消息。
   *
   * @param sessionId 会话 ID。
   * @param message 需要追加的对话消息。
   * @returns 更新后的会话快照；会话不存在时返回 null。
   */
  async appendMessage(sessionId: string, message: AgentMessage) {
    return this.requestNullableSession(`/internal/ai-bill-intake/sessions/${encodeURIComponent(sessionId)}/messages`, {
      method: "POST",
      body: message,
    });
  }

  /**
   * 在 Agent 分析完成后持久化图片上下文和识别结果。
   *
   * @param sessionId 会话 ID。
   * @param input 本轮分析使用的图片和 Agent 返回结果。
   * @returns 更新后的会话快照；会话不存在时返回 null。
   */
  async updateAfterAnalysis(sessionId: string, input: { imageUrls: string[]; result: BillIntakeResult }) {
    return this.requestNullableSession(`/internal/ai-bill-intake/sessions/${encodeURIComponent(sessionId)}/analysis`, {
      method: "POST",
      body: input,
    });
  }

  /**
   * 通知主后端指定 AI 补录会话已经成功生成补录运单。
   *
   * @param sessionId 会话 ID。
   * @param input 主后端创建出来的运单 ID。
   * @returns 更新后的会话快照；会话不存在时返回 null。
   */
  async markSubmitted(sessionId: string, input: { submittedTripId: string }) {
    return this.requestNullableSession(`/internal/ai-bill-intake/sessions/${encodeURIComponent(sessionId)}/submission`, {
      method: "POST",
      body: input,
    });
  }

  /**
   * 执行一个必须返回会话的主后端请求。
   *
   * @param path 主后端内部接口路径。
   * @param request 请求方法和 JSON 请求体。
   * @returns 主后端返回的会话快照。
   */
  private async requestSession(path: string, request: { method: string; body?: unknown }) {
    const session = await this.requestNullableSession(path, request);
    if (!session) {
      throw new Error(`HaulHub bill intake session request unexpectedly returned 404: ${path}`);
    }
    return session;
  }

  /**
   * 执行一个允许 404 返回 null 的主后端会话请求。
   *
   * @param path 主后端内部接口路径。
   * @param request 请求方法和 JSON 请求体。
   * @returns 会话快照；主后端返回 404 时返回 null。
   */
  private async requestNullableSession(path: string, request: { method: string; body?: unknown }) {
    const response = await this.request(new URL(path, this.options.baseUrl), { ...request, allowNotFound: true });
    if (response.status === 404) return null;

    return billIntakeSessionResponseSchema.parse(await response.json()).session as BillIntakeSession;
  }

  /**
   * 执行一个携带内部服务 Token 的主后端请求。
   *
   * @param url 完整的主后端内部接口 URL。
   * @param request 请求方法和 JSON 请求体。
   * @returns 主后端 HTTP 响应。
   */
  private async request(url: URL, request: { method: string; body?: unknown; allowNotFound?: boolean }) {
    if (!this.options.serviceToken) {
      throw new Error("HAULHUB_SERVICE_TOKEN is required before requesting HaulHub bill intake sessions.");
    }

    const response = await this.fetcher(url, {
      method: request.method,
      headers: {
        authorization: `Bearer ${this.options.serviceToken}`,
        "content-type": "application/json",
      },
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
    });
    if (response.status === 404 && request.allowNotFound) return response;
    if (!response.ok) {
      throw new Error(`HaulHub bill intake session request failed: ${response.status}`);
    }

    return response;
  }
}
