import { describe, expect, it } from "vitest";
import { getReceiptImageFile, receiptFileLabel, receiptImagePayload } from "./receipt-upload-model";

describe("receipt upload model", () => {
  it("requires the accountant to choose an image file", () => {
    const formData = new FormData();

    expect(getReceiptImageFile(formData)).toEqual({
      ok: false,
      message: "请选择票据图片",
    });
  });

  it("rejects an empty file selection", () => {
    const formData = new FormData();
    formData.set("receiptImageFile", new File([""], "empty.jpg", { type: "image/jpeg" }));

    expect(getReceiptImageFile(formData)).toEqual({
      ok: false,
      message: "请选择票据图片",
    });
  });

  it("builds a receipt payload from the uploaded file result", () => {
    const file = new File(["fake-image"], "receipt.png", { type: "image/png" });

    expect(
      receiptImagePayload({
        storageKey: "uploads/receipt.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 1024,
        file,
      }),
    ).toEqual({
      storageKey: "uploads/receipt.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 1024,
    });
  });

  it("shows a compact file label for the upload control", () => {
    expect(receiptFileLabel("receipt.jpg")).toBe("receipt.jpg");
    expect(receiptFileLabel("")).toBe("未选择图片");
    expect(receiptFileLabel(null)).toBe("未选择图片");
  });
});
