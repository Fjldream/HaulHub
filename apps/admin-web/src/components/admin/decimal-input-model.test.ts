import { describe, expect, it } from "vitest";
import { decimalInputErrorMessage, isDecimalDraft } from "./decimal-input-model";

describe("decimal input model", () => {
  it("allows decimal drafts up to the configured fraction digits", () => {
    expect(isDecimalDraft("", 2)).toBe(true);
    expect(isDecimalDraft("12", 2)).toBe(true);
    expect(isDecimalDraft("12.", 2)).toBe(true);
    expect(isDecimalDraft("12.3", 2)).toBe(true);
    expect(isDecimalDraft("12.34", 2)).toBe(true);
    expect(isDecimalDraft("12.345", 2)).toBe(false);
    expect(isDecimalDraft("12m", 2)).toBe(false);
  });

  it("supports one-decimal inputs for vehicle capacity", () => {
    expect(isDecimalDraft("40.0", 1)).toBe(true);
    expect(isDecimalDraft("40.01", 1)).toBe(false);
  });

  it("uses field-specific validation messages", () => {
    expect(decimalInputErrorMessage("实际运费", 2)).toBe("实际运费只能输入数字，最多保留两位小数。");
    expect(decimalInputErrorMessage("载重", 1)).toBe("载重只能输入数字，最多保留一位小数。");
  });
});
