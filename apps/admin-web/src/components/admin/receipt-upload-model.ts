export type ReceiptImageFileResult =
  | { ok: true; file: File }
  | { ok: false; message: string };

export interface UploadedReceiptFile {
  storageKey: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
}

export function getReceiptImageFile(formData: FormData): ReceiptImageFileResult {
  const file = formData.get("receiptImageFile");
  if (!(file instanceof File) || file.size <= 0) {
    return { ok: false, message: "请选择票据图片" };
  }
  if (file.type && !file.type.startsWith("image/")) {
    return { ok: false, message: "仅支持上传图片文件" };
  }
  return { ok: true, file };
}

export function receiptImagePayload({
  storageKey,
  mimeType,
  sizeBytes,
  file,
}: UploadedReceiptFile & { file: File }) {
  return {
    storageKey,
    mimeType: mimeType || file.type || "image/jpeg",
    sizeBytes: sizeBytes || file.size || 1,
  };
}

export function receiptFileLabel(fileName: string | null | undefined) {
  return fileName?.trim() ? fileName : "未选择图片";
}
