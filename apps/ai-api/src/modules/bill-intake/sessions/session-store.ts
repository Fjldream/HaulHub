import { randomUUID } from "node:crypto";
import type { AgentMessage, AiBillDraftPayload, BillIntakeResult, ReviewQuestion } from "../domain/types";

/**
 * 账单识别会话的完整状态。
 *
 * 会话会记录会计和 Agent 的多轮对话、图片上下文、当前草稿和最近一次分析结果。
 */
export type BillIntakeSession = {
  id: string;
  teamId: string;
  userId: string;
  status?: string;
  submittedTripId?: string | null;
  messages: AgentMessage[];
  imageUrls: string[];
  currentDraft?: AiBillDraftPayload;
  reviewQuestions: ReviewQuestion[];
  warnings: string[];
  lastResult?: BillIntakeResult;
  createdAt: string;
  updatedAt: string;
};

/**
 * 创建会话时需要的最小归属信息。
 */
export type CreateBillIntakeSessionInput = {
  teamId: string;
  userId: string;
};

/**
 * 查询账单识别会话历史时需要的归属和分页信息。
 */
export type ListBillIntakeSessionsInput = {
  teamId: string;
  userId: string;
  limit?: number;
};

/**
 * 账单识别会话历史列表使用的轻量摘要。
 */
export type BillIntakeSessionSummary = {
  id: string;
  teamId: string;
  userId: string;
  status: string;
  submittedTripId?: string | null;
  customerName?: string;
  loadLocation?: string;
  unloadLocation?: string;
  settledAt?: string;
  actualFreight?: string;
  reviewQuestionCount: number;
  warningCount: number;
  imageCount: number;
  messageCount: number;
  lastReply?: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * 会话存储需要支持的最小能力。
 *
 * 路由层只依赖这个接口，因此后续可以在内存、主后端 HTTP、Redis 或数据库实现之间切换。
 */
export type BillIntakeSessionStore = {
  create(input: CreateBillIntakeSessionInput): BillIntakeSession | Promise<BillIntakeSession>;
  list(input: ListBillIntakeSessionsInput): BillIntakeSessionSummary[] | Promise<BillIntakeSessionSummary[]>;
  get(sessionId: string): BillIntakeSession | null | Promise<BillIntakeSession | null>;
  appendMessage(
    sessionId: string,
    message: AgentMessage,
  ): BillIntakeSession | null | Promise<BillIntakeSession | null>;
  updateAfterAnalysis(
    sessionId: string,
    input: { imageUrls: string[]; result: BillIntakeResult },
  ): BillIntakeSession | null | Promise<BillIntakeSession | null>;
  markSubmitted(
    sessionId: string,
    input: { submittedTripId: string },
  ): BillIntakeSession | null | Promise<BillIntakeSession | null>;
};

/**
 * 基于 Map 的开发版账单识别会话存储。
 *
 * 该实现不跨进程、不持久化，适合本地开发和单元测试；生产环境会通过 HTTP store 持久化到主后端。
 */
export class InMemoryBillIntakeSessionStore implements BillIntakeSessionStore {
  private readonly sessions = new Map<string, BillIntakeSession>();

  /**
   * 创建一个新的账单识别会话。
   *
   * @param input 会话所属团队和会计用户。
   * @returns 新创建的会话快照。
   */
  create(input: CreateBillIntakeSessionInput) {
    const now = new Date().toISOString();
    const session: BillIntakeSession = {
      id: randomUUID(),
      teamId: input.teamId,
      userId: input.userId,
      status: "active",
      submittedTripId: null,
      messages: [],
      imageUrls: [],
      reviewQuestions: [],
      warnings: [],
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.set(session.id, session);
    return this.clone(session);
  }

  /**
   * 查询当前会计的账单识别历史摘要。
   *
   * @param input 团队、会计用户和可选数量限制。
   * @returns 按更新时间倒序排列的会话摘要。
   */
  list(input: ListBillIntakeSessionsInput) {
    return Array.from(this.sessions.values())
      .filter((session) => session.teamId === input.teamId && session.userId === input.userId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, input.limit ?? 20)
      .map((session) => this.toSummary(session));
  }

  /**
   * 读取会话快照。
   *
   * @param sessionId 会话 ID。
   * @returns 找到时返回会话快照，否则返回 null。
   */
  get(sessionId: string) {
    const session = this.sessions.get(sessionId);
    return session ? this.clone(session) : null;
  }

  /**
   * 向会话追加一条对话消息。
   *
   * @param sessionId 会话 ID。
   * @param message 需要追加的会计或 Agent 消息。
   * @returns 更新后的会话快照；会话不存在时返回 null。
   */
  appendMessage(sessionId: string, message: AgentMessage) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    session.messages.push(message);
    session.updatedAt = new Date().toISOString();
    return this.clone(session);
  }

  /**
   * 在 Agent 分析完成后更新会话草稿、问题、警告和图片上下文。
   *
   * @param sessionId 会话 ID。
   * @param input 本轮分析使用的图片和 Agent 返回结果。
   * @returns 更新后的会话快照；会话不存在时返回 null。
   */
  updateAfterAnalysis(sessionId: string, input: { imageUrls: string[]; result: BillIntakeResult }) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    session.imageUrls = [...session.imageUrls, ...input.imageUrls];
    session.currentDraft = input.result.draftPayload;
    session.reviewQuestions = input.result.reviewQuestions;
    session.warnings = input.result.warnings;
    session.lastResult = input.result;
    session.updatedAt = new Date().toISOString();
    return this.clone(session);
  }

  /**
   * 把会话标记为已完成补录提交。
   *
   * @param sessionId 会话 ID。
   * @param input 主后端创建出来的运单 ID。
   * @returns 更新后的会话快照；会话不存在时返回 null。
   */
  markSubmitted(sessionId: string, input: { submittedTripId: string }) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    session.status = "submitted";
    session.submittedTripId = input.submittedTripId;
    session.updatedAt = new Date().toISOString();
    return this.clone(session);
  }

  /**
   * 把完整会话转换成历史列表摘要。
   *
   * @param session 完整会话快照。
   * @returns 历史列表展示需要的轻量摘要。
   */
  private toSummary(session: BillIntakeSession): BillIntakeSessionSummary {
    return {
      id: session.id,
      teamId: session.teamId,
      userId: session.userId,
      status: session.status ?? "active",
      submittedTripId: session.submittedTripId,
      customerName: session.currentDraft?.customerName.value ?? undefined,
      loadLocation: session.currentDraft?.loadLocation.value ?? undefined,
      unloadLocation: session.currentDraft?.unloadLocation.value ?? undefined,
      settledAt: session.currentDraft?.settledAt.value ?? undefined,
      actualFreight: session.currentDraft?.actualFreight.value ?? undefined,
      reviewQuestionCount: session.reviewQuestions.length,
      warningCount: session.warnings.length,
      imageCount: session.imageUrls.length,
      messageCount: session.messages.length,
      lastReply: session.lastResult?.reply,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  /**
   * 复制会话对象，避免调用方直接修改内存中的真实状态。
   *
   * @param session 原始会话对象。
   * @returns 可安全返回给路由层的会话副本。
   */
  private clone(session: BillIntakeSession): BillIntakeSession {
    return structuredClone(session);
  }
}
