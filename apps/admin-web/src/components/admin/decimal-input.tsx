"use client";

import { useState, type InputHTMLAttributes } from "react";
import { decimalInputErrorMessage, isDecimalDraft } from "./decimal-input-model";

type DecimalInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "inputMode" | "pattern" | "value" | "onChange"
> & {
  labelText: string;
  fractionDigits?: number;
};

export function DecimalInput({
  labelText,
  fractionDigits = 2,
  defaultValue,
  ...inputProps
}: DecimalInputProps) {
  const [value, setValue] = useState(defaultValue == null ? "" : String(defaultValue));
  const [error, setError] = useState("");

  function updateValue(nextValue: string) {
    if (isDecimalDraft(nextValue, fractionDigits)) {
      setValue(nextValue);
      setError("");
      return;
    }

    setError(decimalInputErrorMessage(labelText, fractionDigits));
  }

  return (
    <>
      <input
        {...inputProps}
        inputMode="decimal"
        pattern={`\\d+(\\.\\d{1,${fractionDigits}})?`}
        type="text"
        value={value}
        onChange={(event) => updateValue(event.target.value)}
      />
      {error ? (
        <span className="form-hint danger" role="alert">
          {error}
        </span>
      ) : null}
    </>
  );
}
