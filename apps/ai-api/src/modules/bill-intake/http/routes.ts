import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { HaulHubApiClient, ManualCompletedTripPayload } from "../../../clients/haulhub-api-client";
import type { BillIntakeWorkflow } from "../agent/workflow";
import {
  agentMessageSchema,
  aiBillDraftPayloadSchema,
  billInputModeSchema,
  billIntakeInputSchema,
} from "../domain/schemas";
import type { AiBillDraftPayload, ReviewQuestion } from "../domain/types";
import { InMemoryBillIntakeSessionStore, type BillIntakeSessionStore } from "../sessions/session-store";
import { validateDraftForReview } from "../tools";

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
 * 会计确认账单草稿的 HTTP 入参 schema。
 */
const confirmSessionBodySchema = z.object({
  draftPayload: aiBillDraftPayloadSchema.optional(),
});

/**
 * 会话 ID 路由参数 schema。
 */
const sessionParamsSchema = z.object({
  sessionId: z.string().min(1),
});

/**
 * 读取字段识别结果里的有效文本。
 *
 * @param value AI 字段识别值。
 * @returns 去掉空白后的文本；空值返回 undefined。
 */
function optionalFieldText(value: string | null | undefined) {
  const text = value?.trim();
  return text ? text : undefined;
}

/**
 * 生成会计确认提交前的额外校验问题。
 *
 * @param draft 会计确认后的 AI 草稿。
 * @returns 阻止提交的问题列表。
 */
function createConfirmationReviewQuestions(draft: AiBillDraftPayload): ReviewQuestion[] {
  const review = validateDraftForReview(draft);
  const questions = [...review.questions];
  const add = (field: string, message: string) => {
    if (!questions.some((question) => question.field === field && question.message === message)) {
      questions.push({ field, message, severity: "required" });
    }
  };

  if (draft.expenseModeSuggestion === "total" && !optionalFieldText(draft.totalExpense?.value)) {
    add("totalExpense", "请填写总费用。");
  }
  if (draft.expenseModeSuggestion === "details") {
    draft.expenses.forEach((expense, index) => {
      if (!expense.matchedExpenseTypeId) add(`expenses.${index}.expenseTypeId`, "请选择费用类型。");
      if (!optionalFieldText(expense.amount.value)) add(`expenses.${index}.amount`, "请填写费用金额。");
    });
  }

  return questions.filter((question) => question.severity === "required");
}

/**
 * 把 AI 草稿转换成主后端手动补录完成运单 payload。
 *
 * @param draft 会计确认后的 AI 草稿。
 * @returns 主后端 `/admin/trips/manual-completed` 接口 payload。
 */
function buildManualCompletedTripPayload(draft: AiBillDraftPayload): ManualCompletedTripPayload {
  const payload: ManualCompletedTripPayload = {
    vehicleId: draft.vehicle.matchedVehicleId!,
    driverId: draft.driver.matchedDriverId!,
    customerName: optionalFieldText(draft.customerName.value)!,
    loadLocation: optionalFieldText(draft.loadLocation.value)!,
    unloadLocation: optionalFieldText(draft.unloadLocation.value)!,
    actualFreight: optionalFieldText(draft.actualFreight.value)!,
    settledAt: optionalFieldText(draft.settledAt.value)!,
    accountingNote: optionalFieldText(draft.accountingNote?.value),
  };

  if (draft.expenseModeSuggestion === "total") {
    payload.totalExpense = {
      amount: optionalFieldText(draft.totalExpense?.value)!,
      note: optionalFieldText(draft.accountingNote?.value),
    };
  } else {
    payload.expenses = draft.expenses.map((expense) => ({
      expenseTypeId: expense.matchedExpenseTypeId!,
      amount: optionalFieldText(expense.amount.value)!,
      occurredAt: optionalFieldText(expense.occurredAt?.value),
      note: optionalFieldText(expense.note) ?? expense.originalName,
    }));
  }

  return payload;
}

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
  apiClient: HaulHubApiClient,
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

  app.post("/bill-intake/sessions/:sessionId/confirm", async (request, reply) => {
    const params = sessionParamsSchema.parse(request.params);
    const parsed = confirmSessionBodySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({
        message: parsed.error.issues[0]?.message ?? "账单识别会话确认请求无效。",
      });
    }

    const session = sessionStore.get(params.sessionId);
    if (!session) {
      return reply.code(404).send({ message: "账单识别会话不存在。" });
    }

    const draft = parsed.data.draftPayload ?? session.currentDraft;
    if (!draft) {
      return reply.code(409).send({ message: "当前会话还没有可确认的账单草稿。" });
    }

    const reviewQuestions = createConfirmationReviewQuestions(draft);
    if (reviewQuestions.length > 0) {
      return reply.code(409).send({
        message: "账单草稿仍有必填信息需要会计确认。",
        reviewQuestions,
      });
    }

    const payload = buildManualCompletedTripPayload(draft);
    try {
      const submission = await apiClient.createManualCompletedTrip({
        teamId: session.teamId,
        userId: session.userId,
        payload,
      });
      return { submission, payload };
    } catch (error) {
      const message = error instanceof Error ? error.message : "主后端账单校验失败。";
      return reply.code(409).send({ message, payload });
    }
  });
}
