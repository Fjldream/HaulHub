"use client";

import { ImagePlus } from "lucide-react";
import { useId, useState, type ChangeEvent } from "react";
import { receiptFileLabel } from "./receipt-upload-model";

interface ReceiptUploadFormProps {
  action: (formData: FormData) => void | Promise<void>;
  tripId: string;
  expenseId: string;
  expenseName: string;
}

export function ReceiptUploadForm({
  action,
  tripId,
  expenseId,
  expenseName,
}: ReceiptUploadFormProps) {
  const inputId = useId();
  const [fileName, setFileName] = useState("");

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFileName(event.target.files?.[0]?.name ?? "");
  }

  return (
    <form className="receipt-upload-form" action={action}>
      <input type="hidden" name="tripId" value={tripId} />
      <input type="hidden" name="expenseId" value={expenseId} />
      <input
        id={inputId}
        className="receipt-file-input"
        name="receiptImageFile"
        type="file"
        accept="image/*"
        aria-label={`${expenseName}票据图片`}
        onChange={handleFileChange}
        required
      />
      <label className="receipt-file-button" htmlFor={inputId}>
        <ImagePlus size={14} />
        选择图片
      </label>
      <span className="receipt-file-name" title={receiptFileLabel(fileName)}>
        {receiptFileLabel(fileName)}
      </span>
      <button className="text-button" type="submit">
        上传票据
      </button>
    </form>
  );
}
