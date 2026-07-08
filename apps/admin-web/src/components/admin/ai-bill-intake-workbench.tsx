"use client";

import {
  Bot,
  CheckCircle2,
  ImagePlus,
  Loader2,
  MessageSquareText,
  Plus,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import {
  AiBillIntakeClientError,
  analyzeAiBillIntakeSession,
  confirmAiBillIntakeSession,
  createAiBillIntakeSession,
  uploadAiBillIntakeImage,
} from "@/lib/ai-bill-intake-client";
import type { ApiDriver, ApiExpenseType, ApiVehicle } from "@/lib/api-client";
import {
  applyDraftExpenseType,
  buildBillIntakeAnalyzePayload,
  createEditableField,
  draftFieldReviewClass,
  updateDraftDriver,
  updateDraftExpense,
  updateDraftFieldValue,
  updateDraftVehicle,
  type AiBillDraftPayload,
  type AiBillIntakeResult,
  type AiBillIntakeSession,
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
 * 从确认提交结果中提取新建账单 ID。
 *
 * @param response AI confirm 接口响应。
 * @returns 主后端创建出的账单 ID；没有返回时为空。
 */
function readSubmittedTripId(response: unknown): string {
  const submission = (response as { submission?: { trip?: { id?: unknown } } }).submission;
  return typeof submission?.trip?.id === "string" ? submission.trip.id : "";
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [session, setSession] = useState<AiBillIntakeSession | null>(null);
  const [result, setResult] = useState<AiBillIntakeResult | null>(null);
  const [draft, setDraft] = useState<AiBillDraftPayload | null>(null);
  const [textNote, setTextNote] = useState("");
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [reviewQuestions, setReviewQuestions] = useState<AiReviewQuestion[]>([]);
  const [error, setError] = useState("");
  const [successTripId, setSuccessTripId] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === draft?.vehicle.matchedVehicleId) ?? null;
  const boundDriverIds = new Set(selectedVehicle?.boundDrivers?.map((driver) => driver.id) ?? []);
  const eligibleDrivers =
    selectedVehicle == null ? drivers : drivers.filter((driver) => boundDriverIds.has(driver.id));
  const effectiveExpenseMode = draft?.expenseModeSuggestion === "total" ? "total" : "details";
  const visibleQuestions = reviewQuestions.length > 0 ? reviewQuestions : result?.reviewQuestions ?? [];

  /**
   * 更新当前草稿，并清理确认后的状态提示。
   *
   * @param nextDraft 新的 AI 草稿。
   */
  function commitDraft(nextDraft: AiBillDraftPayload) {
    setDraft(nextDraft);
    setSuccessTripId("");
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
    return created.session.id;
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
      const uploadedUrls: string[] = [];
      for (const file of files) {
        const uploaded = await uploadAiBillIntakeImage(file);
        uploadedUrls.push(uploaded.file.url);
      }
      setImageUrls((current) => Array.from(new Set([...current, ...uploadedUrls])));
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
    setImageUrls((current) => Array.from(new Set([...current, nextUrl])));
    setImageUrlInput("");
    setError("");
  }

  /**
   * 触发 Agent 根据当前图片和文字材料生成或修正草稿。
   */
  async function runAnalysis() {
    const built = buildBillIntakeAnalyzePayload(textNote, imageUrls);
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
      setSession(analyzed.session);
      setResult(analyzed.result);
      setDraft(analyzed.result.draftPayload);
      setReviewQuestions(analyzed.result.reviewQuestions);
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
   * 把会计确认后的草稿提交给后端做最终校验和入账。
   */
  async function confirmDraft() {
    if (!draft || !session?.id) {
      setError("请先完成一次 AI 识别，再确认提交。");
      return;
    }
    setIsConfirming(true);
    setError("");
    setReviewQuestions([]);
    try {
      const confirmed = await confirmAiBillIntakeSession(session.id, draft);
      setSuccessTripId(readSubmittedTripId(confirmed));
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
          </div>
        </div>
        <button
          className="primary-button"
          type="button"
          disabled={isAnalyzing || isUploading}
          onClick={runAnalysis}
        >
          {isAnalyzing ? <Loader2 size={16} /> : <Sparkles size={16} />}
          {draft ? "重新分析" : "开始识别"}
        </button>
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

          <div className="ai-image-list">
            {imageUrls.length > 0 ? (
              imageUrls.map((url) => (
                <figure key={url} className="ai-image-preview">
                  {/* 用户上传的账单图片来源域名不固定，不能提前纳入 next/image 远程白名单。 */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="账单材料预览" />
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="移除图片"
                    onClick={() => setImageUrls((current) => current.filter((item) => item !== url))}
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
              disabled={!draft || isConfirming}
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
                    className={draftFieldReviewClass(draft.vehicle)}
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
                    className={draftFieldReviewClass(draft.driver)}
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
                    className={draftFieldReviewClass(draft.customerName)}
                    value={draft.customerName.value ?? ""}
                    onChange={(event) => commitDraft(updateDraftFieldValue(draft, "customerName", event.target.value))}
                  />
                </label>
                <label>
                  实际运费
                  <input
                    className={draftFieldReviewClass(draft.actualFreight)}
                    inputMode="decimal"
                    value={draft.actualFreight.value ?? ""}
                    onChange={(event) => commitDraft(updateDraftFieldValue(draft, "actualFreight", event.target.value))}
                  />
                </label>
                <label>
                  完成日期
                  <input
                    className={draftFieldReviewClass(draft.settledAt)}
                    type="date"
                    value={draft.settledAt.value ?? ""}
                    onChange={(event) => commitDraft(updateDraftFieldValue(draft, "settledAt", event.target.value))}
                  />
                </label>
                <label>
                  装货地
                  <input
                    className={draftFieldReviewClass(draft.loadLocation)}
                    value={draft.loadLocation.value ?? ""}
                    onChange={(event) => commitDraft(updateDraftFieldValue(draft, "loadLocation", event.target.value))}
                  />
                </label>
                <label>
                  卸货地
                  <input
                    className={draftFieldReviewClass(draft.unloadLocation)}
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
