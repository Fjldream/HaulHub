/**
 * 领域类型统一导出口。
 *
 * 业务模块引用类型时优先从这里导入；schema 的运行时校验逻辑保留在 `schemas.ts`。
 */
export type {
  AgentMessage,
  AiBillDraftPayload,
  BillInputMode,
  BillIntakeInput,
  BillIntakeResult,
  Confidence,
  ExpenseGuess,
  FieldGuess,
  ReviewQuestion,
} from "./schemas";
