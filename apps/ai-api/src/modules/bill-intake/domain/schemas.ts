import { z } from "zod";

/**
 * AI 对某个字段识别结果的置信度。
 *
 * 置信度只用于提示会计风险，不代表后端业务校验已经通过。
 */
export const confidenceSchema = z.enum(["high", "medium", "low"]);
/** AI 字段置信度类型。 */
export type Confidence = z.infer<typeof confidenceSchema>;

/**
 * 单个账单字段的识别猜测。
 *
 * `needsReview` 为 true 时，前端应突出显示该字段，或者由 Agent 继续向会计追问。
 */
export const fieldGuessSchema = z.object({
  value: z.string().nullable(),
  confidence: confidenceSchema,
  evidence: z.string().optional(),
  needsReview: z.boolean(),
});
/** 单个账单字段的识别猜测类型。 */
export type FieldGuess = z.infer<typeof fieldGuessSchema>;

/**
 * Agent 需要会计确认的问题。
 *
 * `required` 会阻止最终确认，`warning` 只做风险提示。
 */
export const reviewQuestionSchema = z.object({
  field: z.string(),
  message: z.string(),
  severity: z.enum(["required", "warning"]),
});
/** Agent 待确认问题类型。 */
export type ReviewQuestion = z.infer<typeof reviewQuestionSchema>;

/**
 * 一条费用明细的识别结果。
 *
 * 费用类型匹配不到时应落到“其他”，并在 `note` 中保留原始费用名。
 */
export const expenseGuessSchema = z.object({
  originalName: z.string(),
  matchedExpenseTypeId: z.string().optional(),
  matchedExpenseTypeName: z.string().optional(),
  amount: fieldGuessSchema,
  occurredAt: fieldGuessSchema.optional(),
  note: z.string().optional(),
  needsReview: z.boolean(),
});
/** 费用明细识别结果类型。 */
export type ExpenseGuess = z.infer<typeof expenseGuessSchema>;

/**
 * AI 账单补录草稿的核心结构。
 *
 * 这个结构是 AI 服务、管理端表单和业务 API 草稿保存之间的共同协议。
 * 它只表示“建议填写成什么”，不表示账单已经可以正式入账。
 */
export const aiBillDraftPayloadSchema = z.object({
  vehicle: fieldGuessSchema.extend({
    matchedVehicleId: z.string().optional(),
    candidates: z.array(z.object({ id: z.string(), plateNumber: z.string() })).optional(),
  }),
  driver: fieldGuessSchema.extend({
    matchedDriverId: z.string().optional(),
    candidates: z.array(z.object({ id: z.string(), name: z.string(), phone: z.string().optional() })).optional(),
  }),
  customerName: fieldGuessSchema,
  loadLocation: fieldGuessSchema,
  unloadLocation: fieldGuessSchema,
  actualFreight: fieldGuessSchema,
  settledAt: fieldGuessSchema,
  expenseModeSuggestion: z.enum(["details", "total", "needs_review"]),
  expenses: z.array(expenseGuessSchema),
  totalExpense: fieldGuessSchema.optional(),
  accountingNote: fieldGuessSchema.optional(),
});
/** AI 账单补录草稿类型。 */
export type AiBillDraftPayload = z.infer<typeof aiBillDraftPayloadSchema>;

/**
 * 会计提交给 Agent 的原始材料类型。
 */
export const billInputModeSchema = z.enum(["image", "text", "mixed"]);
/** 原始材料输入类型。 */
export type BillInputMode = z.infer<typeof billInputModeSchema>;

/**
 * 会计和 Agent 的对话消息。
 *
 * 对话会作为上下文传回模型，用于补全缺失字段或修正当前草稿。
 */
export const agentMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});
/** Agent 对话消息类型。 */
export type AgentMessage = z.infer<typeof agentMessageSchema>;

/**
 * 一次账单识别请求。
 *
 * 请求中必须带团队和用户信息，便于工具调用时按团队范围查询车辆、司机和费用类型。
 */
export const billIntakeInputSchema = z.object({
  teamId: z.string().min(1),
  userId: z.string().min(1),
  inputMode: billInputModeSchema,
  textNote: z.string().optional(),
  imageUrls: z.array(z.string().url()).default([]),
  messages: z.array(agentMessageSchema).default([]),
  currentDraft: aiBillDraftPayloadSchema.optional(),
});
/** 账单识别请求类型。 */
export type BillIntakeInput = z.infer<typeof billIntakeInputSchema>;

/**
 * Agent 工具调用轨迹。
 *
 * 该结构用于记录模型实际调用了哪些确定性工具，以及调用顺序、入参和失败原因，方便后端做兜底校验。
 */
export const toolTraceItemSchema = z.object({
  index: z.number().int().positive(),
  name: z.string(),
  callId: z.string().nullable().optional(),
  status: z.enum(["success", "error"]),
  input: z.unknown().optional(),
  error: z.string().optional(),
});
/** Agent 工具调用轨迹类型。*/
export type ToolTraceItem = z.infer<typeof toolTraceItemSchema>;

/**
 * Agent 账单识别结果。
 *
 * 结果包含模型原始返回、结构化草稿、工具调用轨迹和会计待确认问题；调用方不能直接把它当正式账单入库。
 */
export const billIntakeResultSchema = z.object({
  provider: z.string(),
  providerRequestId: z.string().optional(),
  rawAgentResult: z.unknown(),
  draftPayload: aiBillDraftPayloadSchema,
  reviewQuestions: z.array(reviewQuestionSchema),
  warnings: z.array(z.string()),
  reply: z.string(),
  toolTrace: z.array(toolTraceItemSchema).default([]),
});
/** Agent 账单识别结果类型。 */
export type BillIntakeResult = z.infer<typeof billIntakeResultSchema>;
