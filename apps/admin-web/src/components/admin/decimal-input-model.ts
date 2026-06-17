export function isDecimalDraft(value: string, fractionDigits = 2) {
  const trimmed = value.trim();
  return new RegExp(`^\\d*(?:\\.\\d{0,${fractionDigits}})?$`).test(trimmed);
}

export function decimalInputErrorMessage(label: string, fractionDigits = 2) {
  const fractionText = fractionDigits === 1 ? "一" : fractionDigits === 2 ? "两" : String(fractionDigits);
  return `${label}只能输入数字，最多保留${fractionText}位小数。`;
}
