import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { BillIntakeWorkflow } from "../agent/workflow";
import { agentMessageSchema, billInputModeSchema, billIntakeInputSchema } from "../domain/schemas";
import { InMemoryBillIntakeSessionStore, type BillIntakeSessionStore } from "../sessions/session-store";

/**
 * 创建账单识别会话的 HTTP 入参 schema。
 */
const createSessionBodySchema = z.object({
  teamId: z.string().min(1),
  userId: z.string().min(1),
});

/**
 * 会计追加对话消息的 HTTP 入参 schema。
 */
const appendSessionMessageBodySchema = agentMessageSchema.extend({
  role: z.literal("user"),
});

/**
 * 基于已有会话继续分析账单的 HTTP 入参 schema。
 */
const analyzeSessionBodySchema = z.object({
  inputMode: billInputModeSchema,
  textNote: z.string().optional(),
  imageUrls: z.array(z.string().url()).default([]),
});

/**
 * 会话 ID 路由参数 schema。
 */
const sessionParamsSchema = z.object({
  sessionId: z.string().min(1),
});

/**
 * 注册账单识别相关 HTTP 路由。
 *
 * HTTP 层只负责请求校验、会话状态编排和响应包装；实际 Agent 分析交给 `BillIntakeWorkflow`。
 *
 * @param app Fastify 应用实例。
 * @param workflow 账单识别 Agent 工作流。
 * @param sessionStore 会话存储，默认使用进程内内存实现。
 */
export function registerBillIntakeRoutes(
  app: FastifyInstance,
  workflow: BillIntakeWorkflow,
  sessionStore: BillIntakeSessionStore = new InMemoryBillIntakeSessionStore(),
) {
  app.post("/bill-intake/analyze", async (request, reply) => {
    const parsed = billIntakeInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        message: parsed.error.issues[0]?.message ?? "账单分析请求无效。",
      });
    }

    return { result: await workflow.analyze(parsed.data) };
  });

  app.post("/bill-intake/sessions", async (request, reply) => {
    const parsed = createSessionBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        message: parsed.error.issues[0]?.message ?? "账单识别会话创建请求无效。",
      });
    }

    return { session: sessionStore.create(parsed.data) };
  });

  app.get("/bill-intake/sessions/:sessionId", async (request, reply) => {
    const params = sessionParamsSchema.parse(request.params);
    const session = sessionStore.get(params.sessionId);
    if (!session) {
      return reply.code(404).send({ message: "账单识别会话不存在。" });
    }

    return { session };
  });

  app.post("/bill-intake/sessions/:sessionId/messages", async (request, reply) => {
    const params = sessionParamsSchema.parse(request.params);
    const parsed = appendSessionMessageBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        message: parsed.error.issues[0]?.message ?? "账单识别会话消息无效。",
      });
    }

    const session = sessionStore.appendMessage(params.sessionId, parsed.data);
    if (!session) {
      return reply.code(404).send({ message: "账单识别会话不存在。" });
    }

    return { session };
  });

  app.post("/bill-intake/sessions/:sessionId/analyze", async (request, reply) => {
    const params = sessionParamsSchema.parse(request.params);
    const parsed = analyzeSessionBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        message: parsed.error.issues[0]?.message ?? "账单识别会话分析请求无效。",
      });
    }

    let session = sessionStore.get(params.sessionId);
    if (!session) {
      return reply.code(404).send({ message: "账单识别会话不存在。" });
    }

    if (parsed.data.textNote?.trim()) {
      session = sessionStore.appendMessage(params.sessionId, { role: "user", content: parsed.data.textNote })!;
    }

    const result = await workflow.analyze({
      teamId: session.teamId,
      userId: session.userId,
      inputMode: parsed.data.inputMode,
      textNote: parsed.data.textNote,
      imageUrls: parsed.data.imageUrls,
      messages: session.messages,
      currentDraft: session.currentDraft,
    });

    sessionStore.appendMessage(params.sessionId, { role: "assistant", content: result.reply });
    const updatedSession = sessionStore.updateAfterAnalysis(params.sessionId, {
      imageUrls: parsed.data.imageUrls,
      result,
    });

    return { session: updatedSession, result };
  });
}
