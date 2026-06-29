export const loginAgreementError = "请先阅读并同意用户服务协议和隐私政策";

export function validateLoginAgreement(accepted: boolean) {
  return accepted ? [] : [loginAgreementError];
}
