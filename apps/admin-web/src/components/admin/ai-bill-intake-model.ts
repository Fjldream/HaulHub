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
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  imageUrls: string[];
  currentDraft?: AiBillDraftPayload;
  lastResult?: AiBillIntakeResult;
  createdAt: string;
  updatedAt: string;
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
 * 为表单字段生成风险提示样式。
 *
 * @param field AI 字段识别结果。
 * @returns 可直接追加到表单控件上的 className。
 */
export function draftFieldReviewClass(field: AiFieldGuess | undefined): string {
  if (!field?.needsReview) return "";
  return field.confidence === "low" ? "needs-review high-risk" : "needs-review";
}
