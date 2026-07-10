import { describe, expect, it } from "vitest";
import {
  applyDraftExpenseType,
  buildBillIntakeAnalyzePayload,
  buildConversationMessageViews,
  buildImageMaterialPayload,
  buildToolTraceViews,
  createEditableField,
  readSubmittedTripId,
  createReviewQuestionFieldSet,
  normalizeReviewQuestionField,
  updateDraftFieldValue,
  updateDraftVehicle,
  validateAiBillDraftBeforeSubmit,
  type AiBillDraftPayload,
} from "./ai-bill-intake-model";

const sampleDraft: AiBillDraftPayload = {
  vehicle: {
    value: "沪A12345",
    confidence: "medium",
    needsReview: true,
    matchedVehicleId: "vehicle-1",
  },
  driver: {
    value: "张三",
    confidence: "medium",
    needsReview: true,
    matchedDriverId: "driver-1",
  },
  customerName: createEditableField("老客户"),
  loadLocation: createEditableField("上海仓"),
  unloadLocation: createEditableField("杭州仓"),
  actualFreight: createEditableField("800"),
  settledAt: createEditableField("2026-07-08"),
  expenseModeSuggestion: "details",
  expenses: [
    {
      originalName: "油费",
      matchedExpenseTypeId: "fuel",
      matchedExpenseTypeName: "油费",
      amount: createEditableField("100"),
      note: "识别自收据",
      needsReview: true,
    },
  ],
  accountingNote: createEditableField("AI识别"),
};

describe("ai bill intake model", () => {
  it("requires at least one text or image material before analysis", () => {
    expect(buildBillIntakeAnalyzePayload("   ", [])).toEqual({
      ok: false,
      message: "请上传图片或输入账单文字。",
    });
  });

  it("detects text, image and mixed input modes", () => {
    expect(buildBillIntakeAnalyzePayload("  运费 800  ", [])).toEqual({
      ok: true,
      payload: { inputMode: "text", textNote: "运费 800", imageUrls: [] },
    });
    expect(buildBillIntakeAnalyzePayload("", ["https://example.com/a.jpg"])).toEqual({
      ok: true,
      payload: { inputMode: "image", imageUrls: ["https://example.com/a.jpg"] },
    });
    expect(buildBillIntakeAnalyzePayload("油费 100", ["https://example.com/a.jpg"])).toEqual({
      ok: true,
      payload: { inputMode: "mixed", textNote: "油费 100", imageUrls: ["https://example.com/a.jpg"] },
    });
  });

  it("builds analysis image urls from AI-readable material urls only", () => {
    expect(
      buildImageMaterialPayload([
        {
          id: "image-1",
          name: "receipt.jpg",
          previewUrl: "blob:http://localhost/preview",
          aiUrl: "data:image/jpeg;base64,abc",
          isObjectPreview: true,
        },
        {
          id: "image-2",
          name: "remote.jpg",
          previewUrl: "https://example.com/receipt.jpg",
          aiUrl: "https://example.com/receipt.jpg",
          isObjectPreview: false,
        },
      ]),
    ).toEqual(["data:image/jpeg;base64,abc", "https://example.com/receipt.jpg"]);
  });

  it("extracts submitted trip id from confirm responses", () => {
    expect(readSubmittedTripId({ submission: { trip: { id: "trip-1" } } })).toBe("trip-1");
    expect(readSubmittedTripId({ submission: { trip: { id: 1 } } })).toBe("");
    expect(readSubmittedTripId({})).toBe("");
  });

  it("builds recent conversation messages for the workbench", () => {
    expect(buildConversationMessageViews(null)).toEqual([]);
    expect(
      buildConversationMessageViews(
        {
          id: "session-1",
          teamId: "team-1",
          userId: "user-1",
          imageUrls: [],
          messages: [
            { role: "user", content: " 初始材料 " },
            { role: "assistant", content: "请补充车辆" },
            { role: "user", content: "   " },
            { role: "user", content: "车辆是沪A12345" },
          ],
          createdAt: "2026-07-09T00:00:00.000Z",
          updatedAt: "2026-07-09T00:00:00.000Z",
        },
        2,
      ),
    ).toEqual([
      { id: "1-assistant", role: "assistant", roleLabel: "Agent", content: "请补充车辆" },
      { id: "3-user", role: "user", roleLabel: "会计", content: "车辆是沪A12345" },
    ]);
  });

  it("marks edited text fields as accountant-confirmed", () => {
    const draft = updateDraftFieldValue(sampleDraft, "customerName", "新客户");

    expect(draft.customerName).toMatchObject({
      value: "新客户",
      confidence: "high",
      needsReview: false,
    });
    expect(sampleDraft.customerName.value).toBe("老客户");
  });

  it("updates vehicle match when the accountant chooses an existing vehicle", () => {
    const draft = updateDraftVehicle(sampleDraft, { id: "vehicle-2", plateNumber: "沪B54321" });

    expect(draft.vehicle).toMatchObject({
      value: "沪B54321",
      matchedVehicleId: "vehicle-2",
      confidence: "high",
      needsReview: false,
    });
  });

  it("updates an expense type match without mutating the original draft", () => {
    const draft = applyDraftExpenseType(sampleDraft, 0, { id: "other", name: "其他" });

    expect(draft.expenses[0]).toMatchObject({
      matchedExpenseTypeId: "other",
      matchedExpenseTypeName: "其他",
      needsReview: false,
    });
    expect(sampleDraft.expenses[0].matchedExpenseTypeId).toBe("fuel");
  });

  it("builds required review questions before confirming an incomplete draft", () => {
    const invalidDraft: AiBillDraftPayload = {
      ...sampleDraft,
      vehicle: { ...sampleDraft.vehicle, matchedVehicleId: undefined },
      driver: { ...sampleDraft.driver, matchedDriverId: undefined },
      customerName: createEditableField(" "),
      loadLocation: createEditableField(""),
      unloadLocation: createEditableField(null),
      actualFreight: createEditableField(""),
      settledAt: createEditableField(""),
      expenseModeSuggestion: "details",
      expenses: [
        {
          ...sampleDraft.expenses[0],
          matchedExpenseTypeId: undefined,
          amount: createEditableField(""),
        },
      ],
    };

    expect(validateAiBillDraftBeforeSubmit(invalidDraft)).toEqual([
      { field: "vehicle", message: "请选择车辆。", severity: "required" },
      { field: "driver", message: "请选择司机。", severity: "required" },
      { field: "customerName", message: "请填写客户名称。", severity: "required" },
      { field: "loadLocation", message: "请填写装货地。", severity: "required" },
      { field: "unloadLocation", message: "请填写卸货地。", severity: "required" },
      { field: "actualFreight", message: "请填写实际运费。", severity: "required" },
      { field: "settledAt", message: "请选择完成日期。", severity: "required" },
      { field: "expenses.0.type", message: "第 1 行费用请选择费用类型。", severity: "required" },
      { field: "expenses.0.amount", message: "第 1 行费用请填写金额。", severity: "required" },
    ]);
  });

  it("requires total expense when the draft uses total expense mode", () => {
    expect(
      validateAiBillDraftBeforeSubmit({
        ...sampleDraft,
        expenseModeSuggestion: "total",
        totalExpense: createEditableField(""),
      }),
    ).toEqual([{ field: "totalExpense", message: "请填写总费用。", severity: "required" }]);
  });

  it("normalizes backend review question field paths for workbench controls", () => {
    expect(normalizeReviewQuestionField("expenses.0.expenseTypeId")).toBe("expenses.0.type");
    expect(normalizeReviewQuestionField("expenses.1.matchedExpenseTypeId")).toBe("expenses.1.type");
    expect(normalizeReviewQuestionField("expenseMode")).toBe("expenseMode");
  });

  it("creates a normalized required review field set", () => {
    expect(
      createReviewQuestionFieldSet([
        { field: "expenses.0.expenseTypeId", message: "请选择费用类型。", severity: "required" },
        { field: "driver", message: "请确认司机。", severity: "warning" },
        { field: "totalExpense", message: "请填写总费用。", severity: "required" },
      ]),
    ).toEqual(new Set(["expenses.0.type", "totalExpense"]));
  });

  it("builds readable tool trace views for the workbench", () => {
    expect(
      buildToolTraceViews([
        { index: 2, name: "validate_draft_for_review", status: "success" },
        { index: 1, name: "match_driver", status: "error", error: "司机未找到" },
        { index: 0, name: "unknown_tool", status: "success", callId: "call-1" },
      ]),
    ).toEqual([
      {
        id: "0-unknown_tool-call-1",
        label: "unknown_tool",
        status: "success",
        statusLabel: "成功",
      },
      {
        id: "1-match_driver-no-call",
        label: "匹配司机",
        status: "error",
        statusLabel: "失败",
        detail: "司机未找到",
      },
      {
        id: "2-validate_draft_for_review-no-call",
        label: "校验草稿",
        status: "success",
        statusLabel: "成功",
      },
    ]);
  });
});
