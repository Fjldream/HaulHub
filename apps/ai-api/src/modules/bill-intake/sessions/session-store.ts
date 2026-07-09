import { randomUUID } from "node:crypto";
import type { AgentMessage, AiBillDraftPayload, BillIntakeResult, ReviewQuestion } from "../domain/types";

/**
 * 账单识别会话的内存状态。
 *
 * 第一版会话只保存在 AI 服务进程内，用于本地跑通 Agent 多轮追问流程；后续生产化时可以替换为数据库存储。
 */
export type BillIntakeSession = {
  id: string;
  teamId: string;
  userId: string;
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
 * 会话存储需要支持的最小能力。
 *
 * 该接口隔离了内存实现和 HTTP 路由，后续切换为主后端持久化时不需要重写路由编排逻辑。
 */
export type BillIntakeSessionStore = {
  create(input: CreateBillIntakeSessionInput): BillIntakeSession | Promise<BillIntakeSession>;
  get(sessionId: string): BillIntakeSession | null | Promise<BillIntakeSession | null>;
  appendMessage(
    sessionId: string,
    message: AgentMessage,
  ): BillIntakeSession | null | Promise<BillIntakeSession | null>;
  updateAfterAnalysis(
    sessionId: string,
    input: { imageUrls: string[]; result: BillIntakeResult },
  ): BillIntakeSession | null | Promise<BillIntakeSession | null>;
};

/**
 * 基于 Map 的开发版账单识别会话存储。
 *
 * 注意：该实现不跨进程、不持久化，服务重启后会话会丢失；它的价值是先把对话式 Agent 体验跑通。
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
   * 复制会话对象，避免调用方直接修改内存中的真实状态。
   *
   * @param session 原始会话对象。
   * @returns 可安全返回给路由层的会话副本。
   */
  private clone(session: BillIntakeSession): BillIntakeSession {
    return structuredClone(session);
  }
}
