import { describe, expect, it } from "vitest";
import { loginAgreementError, validateLoginAgreement } from "./login-agreement-model";

describe("login agreement model", () => {
  it("requires agreement before login can continue", () => {
    expect(validateLoginAgreement(false)).toEqual([loginAgreementError]);
  });

  it("allows login after agreement is accepted", () => {
    expect(validateLoginAgreement(true)).toEqual([]);
  });
});
