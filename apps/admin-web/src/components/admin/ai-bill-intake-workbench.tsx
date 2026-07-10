"use client";

import {
  Bot,
  CheckCircle2,
  Clock3,
  ImagePlus,
  Loader2,
  MessageSquareText,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  AiBillIntakeClientError,
  type AnalyzeAiBillIntakeSessionResponse,
  analyzeAiBillIntakeSession,
  confirmAiBillIntakeSession,
  createAiBillIntakeSession,
  getAiBillIntakeSession,
  listAiBillIntakeSessions,
} from "@/lib/ai-bill-intake-client";
import type { ApiDriver, ApiExpenseType, ApiVehicle } from "@/lib/api-client";
import {
  applyDraftExpenseType,
  buildBillIntakeAnalyzePayload,
  buildConversationMessageViews,
  buildImageMaterialPayload,
  createEditableField,
  draftFieldReviewClass,
  readSubmittedTripId,
  updateDraftDriver,
  updateDraftExpense,
  updateDraftFieldValue,
  updateDraftVehicle,
  validateAiBillDraftBeforeSubmit,
  type AiBillImageMaterial,
  type AiBillDraftPayload,
  type AiBillIntakeResult,
  type AiBillIntakeSession,
  type AiBillIntakeSessionSummary,
  type AiExpenseGuess,
  type AiReviewQuestion,
} from "./ai-bill-intake-model";

interface AiBillIntakeWorkbenchProps {
  vehicles: ApiVehicle[];
  drivers: ApiDriver[];
  expenseTypes: ApiExpenseType[];
}

/**
 * 从 AI 或后端错误中读取可展示给会计的错误消息。
 *
 * @param error 捕获到的异常。
 * @returns 适合展示在页面上的错误文本。
 */
function readableError(error: unknown): string {
  return error instanceof Error ? error.message : "AI 账单处理失败，请稍后重试。";
}

/**
 * 创建一行空费用明细，供会计手工补充。
 *
 * @param expenseTypes 当前团队可用的费用类型。
 * @returns 可写回 AI 草稿的费用行。
 */
function createBlankExpense(expenseTypes: ApiExpenseType[]): AiExpenseGuess {
  const firstType = expenseTypes[0];
  return {
    originalName: firstType?.name ?? "费用",
    matchedExpenseTypeId: firstType?.id,
    matchedExpenseTypeName: firstType?.name,
    amount: createEditableField(""),
    occurredAt: createEditableField(""),
    note: "",
    needsReview: true,
  };
}

/**
 * 把会计本地选择的图片转成 OpenAI 可读取的 data URL。
 *
 * @param file 会计上传的账单图片。
 * @returns 可直接传给 AI 服务的图片 data URL。
 */
function readImageFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("账单图片读取失败。"));
    });
    reader.addEventListener("error", () => reject(new Error("账单图片读取失败。")));
    reader.readAsDataURL(file);
  });
}

/**
 * 生成页面内部使用的图片材料 ID。
 *
 * @returns 可作为 React key 和删除标识的唯一 ID。
 */
function createImageMaterialId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `image-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * 释放本地图片预览占用的浏览器 URL。
 *
 * @param material 需要清理的图片材料。
 */
function revokeImageMaterialPreview(material: AiBillImageMaterial) {
  if (material.isObjectPreview) {
    URL.revokeObjectURL(material.previewUrl);
  }
}

/**
 * 把历史会话里的图片地址还原成工作台可展示和可再次提交的图片材料。
 *
 * @param imageUrls 会话保存的图片 URL 列表。
 * @returns 工作台图片材料列表。
 */
function createHistoryImageMaterials(imageUrls: string[]): AiBillImageMaterial[] {
  return imageUrls.map((imageUrl, index) => ({
    id: createImageMaterialId(),
    name: `历史图片 ${index + 1}`,
    previewUrl: imageUrl,
    aiUrl: imageUrl,
    isObjectPreview: false,
  }));
}

/**
 * 生成历史会话列表里用于快速识别业务内容的标题。
 *
 * @param summary 历史会话摘要。
 * @returns 可展示的会话标题。
 */
function formatSessionSummaryTitle(summary: AiBillIntakeSessionSummary): string {
  return summary.customerName || summary.lastReply || "未命名账单会话";
}

/**
 * 生成历史会话列表里展示路线、金额和日期的辅助文本。
 *
 * @param summary 历史会话摘要。
 * @returns 可展示的摘要辅助文本。
 */
function formatSessionSummarySubtitle(summary: AiBillIntakeSessionSummary): string {
  const route = [summary.loadLocation, summary.unloadLocation].filter(Boolean).join(" → ");
  const details = [route, summary.actualFreight ? `运费 ${summary.actualFreight}` : "", summary.settledAt]
    .filter(Boolean)
    .join(" · ");
  return details || `更新于 ${formatSessionTime(summary.updatedAt)}`;
}

/**
 * 把会话状态转换成会计容易理解的中文标签。
 *
 * @param status 后端保存的会话状态。
 * @returns 中文状态标签。
 */
function formatSessionStatus(status: string): string {
  if (status === "submitted") return "已提交";
  if (status === "cancelled") return "已取消";
  return "处理中";
}

/**
 * 把后端时间格式化成历史列表里的短时间文案。
 *
 * @param value ISO 时间字符串。
 * @returns 本地化后的短时间；解析失败时返回原始文本。
 */
function formatSessionTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * AI 账单补录工作台。
 *
 * @param props 工作台需要的车辆、司机和费用类型上下文。
 * @returns 后台可直接使用的 AI 补录页面。
 */
export function AiBillIntakeWorkbench({
  vehicles,
  drivers,
  expenseTypes,
}: AiBillIntakeWorkbenchProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageMaterialsRef = useRef<AiBillImageMaterial[]>([]);
  const [session, setSession] = useState<AiBillIntakeSession | null>(null);
  const [result, setResult] = useState<AiBillIntakeResult | null>(null);
  const [draft, setDraft] = useState<AiBillDraftPayload | null>(null);
  const [textNote, setTextNote] = useState("");
  const [followUpNote, setFollowUpNote] = useState("");
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [imageMaterials, setImageMaterials] = useState<AiBillImageMaterial[]>([]);
  const [reviewQuestions, setReviewQuestions] = useState<AiReviewQuestion[]>([]);
  const [sessionSummaries, setSessionSummaries] = useState<AiBillIntakeSessionSummary[]>([]);
  const [error, setError] = useState("");
  const [successTripId, setSuccessTripId] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSendingFollowUp, setIsSendingFollowUp] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isRestoringSession, setIsRestoringSession] = useState(false);
  const [activeHistorySessionId, setActiveHistorySessionId] = useState("");
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === draft?.vehicle.matchedVehicleId) ?? null;
  const boundDriverIds = new Set(selectedVehicle?.boundDrivers?.map((driver) => driver.id) ?? []);
  const eligibleDrivers =
    selectedVehicle == null ? drivers : drivers.filter((driver) => boundDriverIds.has(driver.id));
  const effectiveExpenseMode = draft?.expenseModeSuggestion === "total" ? "total" : "details";
  const visibleQuestions = reviewQuestions.length > 0 ? reviewQuestions : result?.reviewQuestions ?? [];
  const requiredQuestionFields = new Set(
    visibleQuestions.filter((question) => question.severity === "required").map((question) => question.field),
  );
  const conversationMessages = buildConversationMessageViews(session);
  const isWorkbenchBusy = isUploading || isSendingFollowUp || isAnalyzing || isConfirming || isRestoringSession;
  const operationStatus = isUploading
    ? "正在读取图片，稍等一下。"
    : isRestoringSession
      ? "正在恢复历史会话。"
    : isSendingFollowUp
      ? "Agent 正在根据补充信息修正草稿。"
    : isAnalyzing
      ? "Agent 正在识别账单并调用工具匹配车辆、司机和费用类型。"
      : isConfirming
        ? "正在提交后端做最终校验。"
        : "";

  /**
   * 从后端加载当前会计最近的 AI 补录会话摘要。
   */
  const refreshSessionHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const response = await listAiBillIntakeSessions();
      setSessionSummaries(response.sessions);
    } catch (historyError) {
      setError(readableError(historyError));
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    imageMaterialsRef.current = imageMaterials;
  }, [imageMaterials]);

  useEffect(() => {
    void Promise.resolve().then(refreshSessionHistory);
  }, [refreshSessionHistory]);

  useEffect(() => {
    return () => {
      for (const material of imageMaterialsRef.current) {
        revokeImageMaterialPreview(material);
      }
    };
  }, []);

  /**
   * 更新当前草稿，并清理确认后的状态提示。
   *
   * @param nextDraft 新的 AI 草稿。
   */
  function commitDraft(nextDraft: AiBillDraftPayload) {
    setDraft(nextDraft);
    setSuccessTripId("");
    setError("");
    setReviewQuestions([]);
  }

  /**
   * 合并 AI 风险提示和提交前校验提示使用的表单控件样式。
   *
   * @param field AI 草稿字段。
   * @param fieldPath 当前控件对应的草稿字段路径。
   * @returns 可直接挂到表单控件上的 className。
   */
  function workbenchFieldReviewClass(field: Parameters<typeof draftFieldReviewClass>[0], fieldPath: string): string {
    return [draftFieldReviewClass(field), requiredQuestionFields.has(fieldPath) ? "needs-review high-risk" : ""]
      .filter(Boolean)
      .join(" ");
  }

  /**
   * 确保当前页面已经创建 AI 会话。
   *
   * @returns 可用于后续 analyze/confirm 的会话 ID。
   */
  async function ensureSessionId(): Promise<string> {
    if (session?.id) return session.id;
    const created = await createAiBillIntakeSession();
    setSession(created.session);
    void refreshSessionHistory();
    return created.session.id;
  }

  /**
   * 把 Agent 分析响应同步到工作台状态。
   *
   * @param analyzed AI 分析接口返回的最新会话和草稿结果。
   */
  function applyAnalyzedSession(analyzed: AnalyzeAiBillIntakeSessionResponse) {
    setSession(analyzed.session);
    setResult(analyzed.result);
    setDraft(analyzed.result.draftPayload);
    setReviewQuestions(analyzed.result.reviewQuestions);
    void refreshSessionHistory();
  }

  /**
   * 清空当前工作台状态，让会计可以开始录入一张新的账单。
   */
  function resetWorkbench() {
    setSession(null);
    setResult(null);
    setDraft(null);
    setTextNote("");
    setFollowUpNote("");
    setImageUrlInput("");
    setReviewQuestions([]);
    setError("");
    setSuccessTripId("");
    setActiveHistorySessionId("");
    setImageMaterials((current) => {
      current.forEach(revokeImageMaterialPreview);
      return [];
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  /**
   * 从历史列表恢复一个 AI 补录会话，并同步图片、草稿、提问信息和对话记录。
   *
   * @param sessionId 需要恢复的 AI 会话 ID。
   */
  async function restoreSession(sessionId: string) {
    setIsRestoringSession(true);
    setActiveHistorySessionId(sessionId);
    setError("");
    setSuccessTripId("");
    try {
      const detail = await getAiBillIntakeSession(sessionId);
      const restoredSession = detail.session;
      const restoredResult = restoredSession.lastResult ?? null;
      setSession(restoredSession);
      setResult(restoredResult);
      setDraft(restoredSession.currentDraft ?? restoredResult?.draftPayload ?? null);
      setReviewQuestions(restoredResult?.reviewQuestions ?? []);
      setTextNote("");
      setFollowUpNote("");
      setImageUrlInput("");
      setImageMaterials((current) => {
        current.forEach(revokeImageMaterialPreview);
        return createHistoryImageMaterials(restoredSession.imageUrls);
      });
    } catch (restoreError) {
      setError(readableError(restoreError));
    } finally {
      setIsRestoringSession(false);
      setActiveHistorySessionId("");
    }
  }

  /**
   * 上传会计选择的一组账单图片。
   *
   * @param event 文件选择事件。
   */
  async function handleImageFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    setIsUploading(true);
    setError("");
    try {
      const materials: AiBillImageMaterial[] = [];
      for (const file of files) {
        const aiUrl = await readImageFileAsDataUrl(file);
        materials.push({
          id: createImageMaterialId(),
          name: file.name || "账单图片",
          previewUrl: URL.createObjectURL(file),
          aiUrl,
          isObjectPreview: true,
        });
      }
      setImageMaterials((current) => [...current, ...materials]);
    } catch (uploadError) {
      setError(readableError(uploadError));
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }

  /**
   * 把手动输入的图片 URL 加入待识别材料。
   */
  function addImageUrl() {
    const nextUrl = imageUrlInput.trim();
    if (!nextUrl) return;
    try {
      new URL(nextUrl);
    } catch {
      setError("请输入有效的图片 URL。");
      return;
    }
    setImageMaterials((current) => {
      if (current.some((material) => material.aiUrl === nextUrl)) return current;
      return [
        ...current,
        {
          id: createImageMaterialId(),
          name: nextUrl,
          previewUrl: nextUrl,
          aiUrl: nextUrl,
          isObjectPreview: false,
        },
      ];
    });
    setImageUrlInput("");
    setError("");
  }

  /**
   * 从工作台中移除指定的图片材料，并释放本地预览资源。
   *
   * @param materialId 需要移除的图片材料 ID。
   */
  function removeImageMaterial(materialId: string) {
    setImageMaterials((current) => {
      const target = current.find((material) => material.id === materialId);
      if (target) {
        revokeImageMaterialPreview(target);
      }
      return current.filter((material) => material.id !== materialId);
    });
  }

  /**
   * 触发 Agent 根据当前图片和文字材料生成或修正草稿。
   */
  async function runAnalysis() {
    const built = buildBillIntakeAnalyzePayload(textNote, buildImageMaterialPayload(imageMaterials));
    if (!built.ok) {
      setError(built.message);
      return;
    }
    setIsAnalyzing(true);
    setError("");
    setReviewQuestions([]);
    try {
      const sessionId = await ensureSessionId();
      const analyzed = await analyzeAiBillIntakeSession(sessionId, built.payload);
      applyAnalyzedSession(analyzed);
      setTextNote("");
    } catch (analysisError) {
      setError(readableError(analysisError));
      if (analysisError instanceof AiBillIntakeClientError) {
        setReviewQuestions(analysisError.reviewQuestions);
      }
    } finally {
      setIsAnalyzing(false);
    }
  }

  /**
   * 发送会计补充信息，并让 Agent 基于同一会话重新修正草稿。
   */
  async function sendFollowUpNote() {
    const nextNote = followUpNote.trim();
    if (!nextNote) {
      setError("请先输入要补充给 Agent 的信息。");
      return;
    }
    if (!session?.id) {
      setError("请先完成一次 AI 识别，再发送补充信息。");
      return;
    }

    const built = buildBillIntakeAnalyzePayload(nextNote, buildImageMaterialPayload(imageMaterials));
    if (!built.ok) {
      setError(built.message);
      return;
    }

    setIsSendingFollowUp(true);
    setError("");
    setReviewQuestions([]);
    try {
      const analyzed = await analyzeAiBillIntakeSession(session.id, built.payload);
      applyAnalyzedSession(analyzed);
      setFollowUpNote("");
    } catch (analysisError) {
      setError(readableError(analysisError));
      if (analysisError instanceof AiBillIntakeClientError) {
        setReviewQuestions(analysisError.reviewQuestions);
      }
    } finally {
      setIsSendingFollowUp(false);
    }
  }

  /**
   * 把会计确认后的草稿提交给后端做最终校验和入账。
   */
  async function confirmDraft() {
    if (!draft || !session?.id) {
      setError("请先完成一次 AI 识别，再确认提交。");
      return;
    }
    const preSubmitQuestions = validateAiBillDraftBeforeSubmit(draft);
    if (preSubmitQuestions.length > 0) {
      setReviewQuestions(preSubmitQuestions);
      setError("请先补全标红的必填信息，再确认提交。");
      return;
    }
    setIsConfirming(true);
    setError("");
    setReviewQuestions([]);
    try {
      const confirmed = await confirmAiBillIntakeSession(session.id, draft);
      const tripId = readSubmittedTripId(confirmed);
      if (confirmed.session) {
        setSession(confirmed.session);
      }
      setSuccessTripId(tripId);
      void refreshSessionHistory();
      if (tripId) {
        router.push(`/trips/${tripId}`);
      }
    } catch (confirmError) {
      setError(readableError(confirmError));
      if (confirmError instanceof AiBillIntakeClientError) {
        setReviewQuestions(confirmError.reviewQuestions);
      }
    } finally {
      setIsConfirming(false);
    }
  }

  /**
   * 切换 AI 草稿的费用录入模式。
   *
   * @param mode 会计选择的费用模式。
   */
  function setExpenseMode(mode: "details" | "total") {
    if (!draft) return;
    commitDraft({
      ...draft,
      expenseModeSuggestion: mode,
      totalExpense: draft.totalExpense ?? createEditableField(""),
      expenses: draft.expenses.length > 0 ? draft.expenses : [createBlankExpense(expenseTypes)],
    });
  }

  return (
    <div className="ai-intake-workbench">
      <section className="ai-agent-strip">
        <div className="ai-agent-main">
          <span className="ai-agent-icon">
            <Bot size={20} />
          </span>
          <div>
            <strong>{result?.reply ?? "上传图片或输入文字后，Agent 会生成补录草稿并指出要确认的信息。"}</strong>
            {visibleQuestions.length > 0 ? (
              <div className="ai-question-list">
                {visibleQuestions.map((question) => (
                  <span className={question.severity} key={`${question.field}-${question.message}`}>
                    {question.message}
                  </span>
                ))}
              </div>
            ) : null}
            {operationStatus ? (
              <span className="ai-operation-status">
                <Loader2 size={14} />
                {operationStatus}
              </span>
            ) : null}
            {conversationMessages.length > 0 ? (
              <div className="ai-conversation-list" aria-label="AI 补录对话记录">
                {conversationMessages.map((message) => (
                  <div className={`ai-conversation-message ${message.role}`} key={message.id}>
                    <span>{message.roleLabel}</span>
                    <p>{message.content}</p>
                  </div>
                ))}
              </div>
            ) : null}
            {result ? (
              <div className="ai-follow-up-row">
                <textarea
                  value={followUpNote}
                  placeholder="补充给 Agent：例如车牌是沪A12345，司机是老李，过路费看不清。"
                  onChange={(event) => setFollowUpNote(event.target.value)}
                />
                <button
                  className="secondary-button"
                  type="button"
                  disabled={!followUpNote.trim() || isWorkbenchBusy}
                  onClick={sendFollowUpNote}
                >
                  {isSendingFollowUp ? <Loader2 size={16} /> : <Send size={16} />}
                  发送补充
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <div className="ai-agent-actions">
          <button className="secondary-button" type="button" disabled={isWorkbenchBusy} onClick={resetWorkbench}>
            <Plus size={16} />
            新建会话
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={isWorkbenchBusy}
            onClick={runAnalysis}
          >
            {isAnalyzing ? <Loader2 size={16} /> : <Sparkles size={16} />}
            {draft ? "重新分析" : "开始识别"}
          </button>
        </div>
      </section>

      {error ? <div className="ai-intake-alert danger">{error}</div> : null}
      {successTripId ? (
        <div className="ai-intake-alert success">
          <CheckCircle2 size={16} />
          已创建补录账单：{successTripId}
        </div>
      ) : null}

      <div className="ai-intake-grid">
        <section className="ai-intake-panel ai-material-panel">
          <div className="ai-panel-head">
            <div>
              <h2>账单材料</h2>
              <p>支持手写收据、微信截图、发票、收据照片，也可以只输入文字。</p>
            </div>
            <button className="secondary-button" type="button" onClick={() => fileInputRef.current?.click()}>
              <ImagePlus size={16} />
              {isUploading ? "上传中" : "上传图片"}
            </button>
            <input
              ref={fileInputRef}
              className="ai-file-input"
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageFiles}
            />
          </div>

          <div className="ai-history-block">
            <div className="ai-history-head">
              <div>
                <strong>历史会话</strong>
                <span>{sessionSummaries.length > 0 ? `最近 ${sessionSummaries.length} 条` : "暂无历史"}</span>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="刷新历史会话"
                disabled={isLoadingHistory}
                onClick={() => void refreshSessionHistory()}
              >
                {isLoadingHistory ? <Loader2 size={15} /> : <RefreshCw size={15} />}
              </button>
            </div>
            <div className="ai-history-list">
              {sessionSummaries.length > 0 ? (
                sessionSummaries.map((summary) => (
                  <button
                    className={summary.id === session?.id ? "ai-history-item active" : "ai-history-item"}
                    disabled={isRestoringSession}
                    key={summary.id}
                    type="button"
                    onClick={() => void restoreSession(summary.id)}
                  >
                    <span className={`ai-history-status ${summary.status}`}>
                      {activeHistorySessionId === summary.id ? "恢复中" : formatSessionStatus(summary.status)}
                    </span>
                    <strong>{formatSessionSummaryTitle(summary)}</strong>
                    <small>{formatSessionSummarySubtitle(summary)}</small>
                    <span className="ai-history-meta">
                      {summary.imageCount} 张图 · {summary.messageCount} 条对话 · {formatSessionTime(summary.updatedAt)}
                    </span>
                  </button>
                ))
              ) : (
                <div className="ai-history-empty">
                  <Clock3 size={18} />
                  <span>{isLoadingHistory ? "正在加载历史会话" : "还没有历史会话"}</span>
                </div>
              )}
            </div>
          </div>

          <div className="ai-image-list">
            {imageMaterials.length > 0 ? (
              imageMaterials.map((material) => (
                <figure key={material.id} className="ai-image-preview">
                  {/* 用户上传的账单图片来源域名不固定，不能提前纳入 next/image 远程白名单。 */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={material.previewUrl} alt={material.name} />
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="移除图片"
                    onClick={() => removeImageMaterial(material.id)}
                  >
                    <X size={15} />
                  </button>
                </figure>
              ))
            ) : (
              <div className="ai-material-empty">
                <MessageSquareText size={28} />
                <strong>还没有图片</strong>
                <span>可以上传图片，也可以直接在下面输入账单文字。</span>
              </div>
            )}
          </div>

          <div className="ai-url-row">
            <input
              value={imageUrlInput}
              placeholder="也可以粘贴图片 URL"
              onChange={(event) => setImageUrlInput(event.target.value)}
            />
            <button className="secondary-button" type="button" onClick={addImageUrl}>
              <Plus size={16} />
              添加
            </button>
          </div>

          <label className="ai-text-material">
            文字材料 / 补充说明
            <textarea
              value={textNote}
              placeholder="例如：沪A12345，张三，7月8日上海到杭州，运费800，油费100，过路费50。"
              onChange={(event) => setTextNote(event.target.value)}
            />
          </label>
        </section>

        <section className="ai-intake-panel ai-draft-panel">
          <div className="ai-panel-head">
            <div>
              <h2>补录草稿</h2>
              <p>会计确认后才会提交，后端仍会做最终校验。</p>
            </div>
            <button
              className="primary-button"
              type="button"
              disabled={!draft || isWorkbenchBusy}
              onClick={confirmDraft}
            >
              {isConfirming ? <Loader2 size={16} /> : <Send size={16} />}
              确认提交
            </button>
          </div>

          {draft ? (
            <div className="ai-draft-form">
              <div className="form-grid">
                <label>
                  车辆
                  <select
                    className={workbenchFieldReviewClass(draft.vehicle, "vehicle")}
                    value={draft.vehicle.matchedVehicleId ?? ""}
                    onChange={(event) => {
                      const vehicle = vehicles.find((item) => item.id === event.target.value);
                      if (vehicle) commitDraft(updateDraftVehicle(draft, vehicle));
                    }}
                  >
                    <option value="">请选择车辆</option>
                    {vehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.plateNumber}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  司机
                  <select
                    className={workbenchFieldReviewClass(draft.driver, "driver")}
                    value={draft.driver.matchedDriverId ?? ""}
                    onChange={(event) => {
                      const driver = drivers.find((item) => item.id === event.target.value);
                      if (driver) commitDraft(updateDraftDriver(draft, driver));
                    }}
                  >
                    <option value="">请选择司机</option>
                    {eligibleDrivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.name} - {driver.phone}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  客户名称
                  <input
                    className={workbenchFieldReviewClass(draft.customerName, "customerName")}
                    value={draft.customerName.value ?? ""}
                    onChange={(event) => commitDraft(updateDraftFieldValue(draft, "customerName", event.target.value))}
                  />
                </label>
                <label>
                  实际运费
                  <input
                    className={workbenchFieldReviewClass(draft.actualFreight, "actualFreight")}
                    inputMode="decimal"
                    value={draft.actualFreight.value ?? ""}
                    onChange={(event) => commitDraft(updateDraftFieldValue(draft, "actualFreight", event.target.value))}
                  />
                </label>
                <label>
                  完成日期
                  <input
                    className={workbenchFieldReviewClass(draft.settledAt, "settledAt")}
                    type="date"
                    value={draft.settledAt.value ?? ""}
                    onChange={(event) => commitDraft(updateDraftFieldValue(draft, "settledAt", event.target.value))}
                  />
                </label>
                <label>
                  装货地
                  <input
                    className={workbenchFieldReviewClass(draft.loadLocation, "loadLocation")}
                    value={draft.loadLocation.value ?? ""}
                    onChange={(event) => commitDraft(updateDraftFieldValue(draft, "loadLocation", event.target.value))}
                  />
                </label>
                <label>
                  卸货地
                  <input
                    className={workbenchFieldReviewClass(draft.unloadLocation, "unloadLocation")}
                    value={draft.unloadLocation.value ?? ""}
                    onChange={(event) => commitDraft(updateDraftFieldValue(draft, "unloadLocation", event.target.value))}
                  />
                </label>
                <label>
                  会计备注
                  <textarea
                    value={draft.accountingNote?.value ?? ""}
                    onChange={(event) => commitDraft(updateDraftFieldValue(draft, "accountingNote", event.target.value))}
                  />
                </label>
              </div>

              <div className="ai-expense-head">
                <div className="segmented-control" aria-label="费用录入模式">
                  <button
                    type="button"
                    className={effectiveExpenseMode === "details" ? "active" : ""}
                    onClick={() => setExpenseMode("details")}
                  >
                    费用明细
                  </button>
                  <button
                    type="button"
                    className={effectiveExpenseMode === "total" ? "active" : ""}
                    onClick={() => setExpenseMode("total")}
                  >
                    总费用
                  </button>
                </div>
                {effectiveExpenseMode === "details" ? (
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() =>
                      commitDraft({ ...draft, expenses: [...draft.expenses, createBlankExpense(expenseTypes)] })
                    }
                  >
                    <Plus size={16} />
                    新增费用
                  </button>
                ) : null}
              </div>

              {effectiveExpenseMode === "details" ? (
                <div className="table-wrap ai-expense-table">
                  <table>
                    <thead>
                      <tr>
                        <th>费用类型</th>
                        <th>金额</th>
                        <th>日期</th>
                        <th>备注</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {draft.expenses.map((expense, index) => (
                        <tr key={`${expense.originalName}-${index}`}>
                          <td>
                            <select
                              className={requiredQuestionFields.has(`expenses.${index}.type`) ? "needs-review high-risk" : ""}
                              value={expense.matchedExpenseTypeId ?? ""}
                              onChange={(event) => {
                                const expenseType = expenseTypes.find((item) => item.id === event.target.value);
                                if (expenseType) commitDraft(applyDraftExpenseType(draft, index, expenseType));
                              }}
                            >
                              <option value="">请选择</option>
                              {expenseTypes.map((type) => (
                                <option key={type.id} value={type.id}>
                                  {type.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              className={workbenchFieldReviewClass(expense.amount, `expenses.${index}.amount`)}
                              inputMode="decimal"
                              value={expense.amount.value ?? ""}
                              onChange={(event) =>
                                commitDraft(
                                  updateDraftExpense(draft, index, { amount: createEditableField(event.target.value) }),
                                )
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="date"
                              value={expense.occurredAt?.value ?? ""}
                              onChange={(event) =>
                                commitDraft(
                                  updateDraftExpense(draft, index, {
                                    occurredAt: createEditableField(event.target.value),
                                  }),
                                )
                              }
                            />
                          </td>
                          <td>
                            <input
                              value={expense.note ?? ""}
                              placeholder={expense.originalName}
                              onChange={(event) =>
                                commitDraft(updateDraftExpense(draft, index, { note: event.target.value }))
                              }
                            />
                          </td>
                          <td>
                            <button
                              className="icon-button"
                              type="button"
                              aria-label="删除费用"
                              onClick={() =>
                                commitDraft({
                                  ...draft,
                                  expenses: draft.expenses.filter((_, itemIndex) => itemIndex !== index),
                                })
                              }
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <label className="ai-total-expense">
                  总费用
                  <input
                    className={workbenchFieldReviewClass(draft.totalExpense, "totalExpense")}
                    inputMode="decimal"
                    value={draft.totalExpense?.value ?? ""}
                    onChange={(event) => commitDraft(updateDraftFieldValue(draft, "totalExpense", event.target.value))}
                  />
                </label>
              )}
            </div>
          ) : (
            <div className="ai-draft-empty">
              <Bot size={32} />
              <strong>等待生成草稿</strong>
              <span>上传材料并点击开始识别后，右侧会出现可编辑的补录表单。</span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
