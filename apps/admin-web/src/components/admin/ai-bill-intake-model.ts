export type AiFieldConfidence = "high" | "medium" | "low";

export type AiBillInputMode = "image" | "text" | "mixed";

export interface AiFieldGuess {
  value: string | null;
  confidence: AiFieldConfidence;
  evidence?: string;
  needsReview: boolean;
}

export interface AiVehicleGuess extends AiFieldGuess {
  matchedVehicleId?: string;
  candidates?: Array<{ id: string; plateNumber: string }>;
}

export interface AiDriverGuess extends AiFieldGuess {
  matchedDriverId?: string;
  candidates?: Array<{ id: string; name: string; phone?: string }>;
}

export interface AiExpenseGuess {
  originalName: string;
  matchedExpenseTypeId?: string;
  matchedExpenseTypeName?: string;
  amount: AiFieldGuess;
  occurredAt?: AiFieldGuess;
  note?: string;
  needsReview: boolean;
}

export interface AiBillDraftPayload {
  vehicle: AiVehicleGuess;
  driver: AiDriverGuess;
  customerName: AiFieldGuess;
  loadLocation: AiFieldGuess;
  unloadLocation: AiFieldGuess;
  actualFreight: AiFieldGuess;
  settledAt: AiFieldGuess;
  expenseModeSuggestion: "details" | "total" | "needs_review";
  expenses: AiExpenseGuess[];
  totalExpense?: AiFieldGuess;
  accountingNote?: AiFieldGuess;
}

export interface AiReviewQuestion {
  field: string;
  message: string;
  severity: "required" | "warning";
}

export interface AiToolTraceItem {
  index: number;
  name: string;
  callId?: string | null;
  status: "success" | "error";
  input?: unknown;
  error?: string;
}

export interface AiBillIntakeResult {
  provider: string;
  providerRequestId?: string;
  rawAgentResult: unknown;
  draftPayload: AiBillDraftPayload;
  reviewQuestions: AiReviewQuestion[];
  warnings: string[];
  reply: string;
  toolTrace: AiToolTraceItem[];
}

export interface AiBillIntakeSession {
  id: string;
  teamId: string;
  userId: string;
  status?: string;
  submittedTripId?: string | null;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  imageUrls: string[];
  currentDraft?: AiBillDraftPayload;
  lastResult?: AiBillIntakeResult;
  createdAt: string;
  updatedAt: string;
}

export interface AiBillIntakeSessionSummary {
  id: string;
  teamId?: string;
  userId?: string;
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
}

export interface AiConversationMessageView {
  id: string;
  role: "user" | "assistant";
  roleLabel: string;
  content: string;
}

export interface AiBillIntakeAnalyzePayload {
  inputMode: AiBillInputMode;
  textNote?: string;
  imageUrls: string[];
}

export interface AiBillImageMaterial {
  id: string;
  name: string;
  previewUrl: string;
  aiUrl: string;
  isObjectPreview: boolean;
}

export type AiBillIntakeAnalyzeBuildResult =
  | { ok: true; payload: AiBillIntakeAnalyzePayload }
  | { ok: false; message: string };

/**
 * 创建一个前端可编辑字段，并默认标记为已经由会计确认。
 *
 * @param value 字段文本值。
 * @returns 可写回 AI 草稿的字段结构。
 */
export function createEditableField(value: string | null = ""): AiFieldGuess {
  return {
    value,
    confidence: "high",
    needsReview: false,
  };
}

/**
 * 根据图片和文字输入生成 AI 会话分析请求。
 *
 * @param textNote 会计输入的账单文字或补充说明。
 * @param imageUrls 已上传图片的可访问 URL 列表。
 * @returns 可提交给 AI 服务的请求体；没有材料时返回错误。
 */
export function buildBillIntakeAnalyzePayload(
  textNote: string,
  imageUrls: string[],
): AiBillIntakeAnalyzeBuildResult {
  const normalizedText = textNote.trim();
  const normalizedImageUrls = imageUrls.filter((url) => url.trim()).map((url) => url.trim());
  if (!normalizedText && normalizedImageUrls.length === 0) {
    return { ok: false, message: "请上传图片或输入账单文字。" };
  }

  const inputMode: AiBillInputMode =
    normalizedText && normalizedImageUrls.length > 0
      ? "mixed"
      : normalizedImageUrls.length > 0
        ? "image"
        : "text";

  return {
    ok: true,
    payload: {
      inputMode,
      ...(normalizedText ? { textNote: normalizedText } : {}),
      imageUrls: normalizedImageUrls,
    },
  };
}

/**
 * 从页面图片材料中提取 AI 服务真正需要读取的图片地址。
 *
 * @param materials 页面当前保留的图片材料。
 * @returns 可传给 AI 服务的图片地址列表。
 */
export function buildImageMaterialPayload(materials: AiBillImageMaterial[]): string[] {
  return materials.map((material) => material.aiUrl).filter((url) => url.trim());
}

/**
 * 从确认提交结果中提取主后端创建出的账单 ID。
 *
 * @param response AI confirm 接口响应。
 * @returns 账单 ID；响应里没有有效 ID 时返回空字符串。
 */
export function readSubmittedTripId(response: unknown): string {
  const submission = (response as { submission?: { trip?: { id?: unknown } } }).submission;
  return typeof submission?.trip?.id === "string" ? submission.trip.id : "";
}

/**
 * 把 AI 会话消息转换成工作台可展示的最近对话列表。
 *
 * @param session 当前 AI 补录会话。
 * @param limit 最多展示的消息条数。
 * @returns 已过滤空消息并附带角色展示文案的对话项。
 */
export function buildConversationMessageViews(
  session: AiBillIntakeSession | null,
  limit = 6,
): AiConversationMessageView[] {
  if (!session) return [];

  return session.messages
    .map((message, index) => ({
      id: `${index}-${message.role}`,
      role: message.role,
      roleLabel: message.role === "user" ? "会计" : "Agent",
      content: message.content.trim(),
    }))
    .filter((message) => message.content)
    .slice(-limit);
}

/**
 * 把会计手动编辑过的字段写回草稿，并清除该字段的待确认标记。
 *
 * @param draft 当前 AI 草稿。
 * @param field 需要更新的顶层字段名。
 * @param value 会计确认后的字段值。
 * @returns 更新后的新草稿对象。
 */
export function updateDraftFieldValue(
  draft: AiBillDraftPayload,
  field: keyof Pick<
    AiBillDraftPayload,
    "customerName" | "loadLocation" | "unloadLocation" | "actualFreight" | "settledAt" | "totalExpense" | "accountingNote"
  >,
  value: string,
): AiBillDraftPayload {
  return {
    ...draft,
    [field]: {
      ...(draft[field] ?? createEditableField()),
      value,
      confidence: "high",
      needsReview: false,
    },
  };
}

/**
 * 把会计选择的已有车辆写回 AI 草稿。
 *
 * @param draft 当前 AI 草稿。
 * @param vehicle 会计选择的车辆。
 * @returns 更新后的新草稿对象。
 */
export function updateDraftVehicle(
  draft: AiBillDraftPayload,
  vehicle: { id: string; plateNumber: string },
): AiBillDraftPayload {
  return {
    ...draft,
    vehicle: {
      ...draft.vehicle,
      value: vehicle.plateNumber,
      matchedVehicleId: vehicle.id,
      confidence: "high",
      needsReview: false,
    },
  };
}

/**
 * 把会计选择的已有司机写回 AI 草稿。
 *
 * @param draft 当前 AI 草稿。
 * @param driver 会计选择的司机。
 * @returns 更新后的新草稿对象。
 */
export function updateDraftDriver(
  draft: AiBillDraftPayload,
  driver: { id: string; name: string },
): AiBillDraftPayload {
  return {
    ...draft,
    driver: {
      ...draft.driver,
      value: driver.name,
      matchedDriverId: driver.id,
      confidence: "high",
      needsReview: false,
    },
  };
}

/**
 * 更新某一行费用的费用类型匹配结果。
 *
 * @param draft 当前 AI 草稿。
 * @param expenseIndex 费用行下标。
 * @param expenseType 会计选择的费用类型。
 * @returns 更新后的新草稿对象。
 */
export function applyDraftExpenseType(
  draft: AiBillDraftPayload,
  expenseIndex: number,
  expenseType: { id: string; name: string },
): AiBillDraftPayload {
  return {
    ...draft,
    expenses: draft.expenses.map((expense, index) =>
      index === expenseIndex
        ? {
            ...expense,
            matchedExpenseTypeId: expenseType.id,
            matchedExpenseTypeName: expenseType.name,
            needsReview: false,
          }
        : expense,
    ),
  };
}

/**
 * 更新某一行费用的金额、日期或备注。
 *
 * @param draft 当前 AI 草稿。
 * @param expenseIndex 费用行下标。
 * @param patch 需要覆盖到费用行上的字段。
 * @returns 更新后的新草稿对象。
 */
export function updateDraftExpense(
  draft: AiBillDraftPayload,
  expenseIndex: number,
  patch: Partial<Pick<AiExpenseGuess, "amount" | "occurredAt" | "note" | "originalName">>,
): AiBillDraftPayload {
  return {
    ...draft,
    expenses: draft.expenses.map((expense, index) =>
      index === expenseIndex
        ? {
            ...expense,
            ...patch,
            needsReview: false,
          }
        : expense,
    ),
  };
}

/**
 * 判断 AI 草稿字段是否已经填写了有效文本。
 *
 * @param field 需要检查的 AI 字段。
 * @returns 字段存在且去掉空白后仍有内容时返回 true。
 */
function hasDraftFieldValue(field: AiFieldGuess | undefined): boolean {
  return Boolean(field?.value?.trim());
}

/**
 * 创建提交前校验使用的必填问题。
 *
 * @param field 发生问题的草稿字段路径。
 * @param message 展示给会计的中文提示。
 * @returns 统一格式的必填确认问题。
 */
function createRequiredReviewQuestion(field: string, message: string): AiReviewQuestion {
  return { field, message, severity: "required" };
}

/**
 * 在会计确认提交前检查草稿里明显缺失的必填信息。
 *
 * @param draft 当前 AI 补录草稿。
 * @returns 需要会计先补充或确认的问题列表；为空表示前端未发现明显缺失项。
 */
export function validateAiBillDraftBeforeSubmit(draft: AiBillDraftPayload): AiReviewQuestion[] {
  const questions: AiReviewQuestion[] = [];

  if (!draft.vehicle.matchedVehicleId) {
    questions.push(createRequiredReviewQuestion("vehicle", "请选择车辆。"));
  }
  if (!draft.driver.matchedDriverId) {
    questions.push(createRequiredReviewQuestion("driver", "请选择司机。"));
  }
  if (!hasDraftFieldValue(draft.customerName)) {
    questions.push(createRequiredReviewQuestion("customerName", "请填写客户名称。"));
  }
  if (!hasDraftFieldValue(draft.loadLocation)) {
    questions.push(createRequiredReviewQuestion("loadLocation", "请填写装货地。"));
  }
  if (!hasDraftFieldValue(draft.unloadLocation)) {
    questions.push(createRequiredReviewQuestion("unloadLocation", "请填写卸货地。"));
  }
  if (!hasDraftFieldValue(draft.actualFreight)) {
    questions.push(createRequiredReviewQuestion("actualFreight", "请填写实际运费。"));
  }
  if (!hasDraftFieldValue(draft.settledAt)) {
    questions.push(createRequiredReviewQuestion("settledAt", "请选择完成日期。"));
  }

  if (draft.expenseModeSuggestion === "total") {
    if (!hasDraftFieldValue(draft.totalExpense)) {
      questions.push(createRequiredReviewQuestion("totalExpense", "请填写总费用。"));
    }
    return questions;
  }

  if (draft.expenses.length === 0) {
    questions.push(createRequiredReviewQuestion("expenses", "请至少保留一行费用明细，或切换为总费用模式。"));
    return questions;
  }

  draft.expenses.forEach((expense, index) => {
    const rowNumber = index + 1;
    if (!expense.matchedExpenseTypeId) {
      questions.push(createRequiredReviewQuestion(`expenses.${index}.type`, `第 ${rowNumber} 行费用请选择费用类型。`));
    }
    if (!hasDraftFieldValue(expense.amount)) {
      questions.push(createRequiredReviewQuestion(`expenses.${index}.amount`, `第 ${rowNumber} 行费用请填写金额。`));
    }
  });

  return questions;
}

/**
 * 把后端和前端可能不一致的 review 字段路径归一化成工作台控件使用的路径。
 *
 * @param field 后端或 Agent 返回的问题字段路径。
 * @returns 前端工作台控件可识别的字段路径。
 */
export function normalizeReviewQuestionField(field: string): string {
  return field
    .replace(/^expenses\.(\d+)\.(expenseTypeId|matchedExpenseTypeId)$/, "expenses.$1.type")
    .replace(/^expenses\.(\d+)\.matchedAmount$/, "expenses.$1.amount");
}

/**
 * 从 reviewQuestions 中提取需要阻止提交的字段集合，并统一字段路径。
 *
 * @param questions Agent、前端或后端返回的问题列表。
 * @returns 只包含 required 问题字段的集合。
 */
export function createReviewQuestionFieldSet(questions: AiReviewQuestion[]): Set<string> {
  return new Set(
    questions
      .filter((question) => question.severity === "required")
      .map((question) => normalizeReviewQuestionField(question.field)),
  );
}

/**
 * 为表单字段生成风险提示样式。
 *
 * @param field AI 字段识别结果。
 * @returns 可直接追加到表单控件上的 className。
 */
export function draftFieldReviewClass(field: AiFieldGuess | undefined): string {
  if (!field?.needsReview) return "";
  return field.confidence === "low" ? "needs-review high-risk" : "needs-review";
}
