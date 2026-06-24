import { z } from "zod";

export const confidenceSchema = z.enum(["high", "medium", "low"]);
export type Confidence = z.infer<typeof confidenceSchema>;

export const fieldGuessSchema = z.object({
  value: z.string().nullable(),
  confidence: confidenceSchema,
  evidence: z.string().optional(),
  needsReview: z.boolean(),
});
export type FieldGuess = z.infer<typeof fieldGuessSchema>;

export const reviewQuestionSchema = z.object({
  field: z.string(),
  message: z.string(),
  severity: z.enum(["required", "warning"]),
});
export type ReviewQuestion = z.infer<typeof reviewQuestionSchema>;

export const expenseGuessSchema = z.object({
  originalName: z.string(),
  matchedExpenseTypeId: z.string().optional(),
  matchedExpenseTypeName: z.string().optional(),
  amount: fieldGuessSchema,
  occurredAt: fieldGuessSchema.optional(),
  note: z.string().optional(),
  needsReview: z.boolean(),
});
export type ExpenseGuess = z.infer<typeof expenseGuessSchema>;

export const aiBillDraftPayloadSchema = z.object({
  vehicle: fieldGuessSchema.extend({
    matchedVehicleId: z.string().optional(),
    candidates: z.array(z.object({ id: z.string(), plateNumber: z.string() })).optional(),
  }),
  driver: fieldGuessSchema.extend({
    matchedDriverId: z.string().optional(),
    candidates: z.array(z.object({ id: z.string(), name: z.string(), phone: z.string().optional() })).optional(),
  }),
  customerName: fieldGuessSchema,
  loadLocation: fieldGuessSchema,
  unloadLocation: fieldGuessSchema,
  actualFreight: fieldGuessSchema,
  settledAt: fieldGuessSchema,
  expenseModeSuggestion: z.enum(["details", "total", "needs_review"]),
  expenses: z.array(expenseGuessSchema),
  totalExpense: fieldGuessSchema.optional(),
  accountingNote: fieldGuessSchema.optional(),
});
export type AiBillDraftPayload = z.infer<typeof aiBillDraftPayloadSchema>;

export const billInputModeSchema = z.enum(["image", "text", "mixed"]);
export type BillInputMode = z.infer<typeof billInputModeSchema>;

export const agentMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});
export type AgentMessage = z.infer<typeof agentMessageSchema>;

export const billIntakeInputSchema = z.object({
  teamId: z.string().min(1),
  userId: z.string().min(1),
  inputMode: billInputModeSchema,
  textNote: z.string().optional(),
  imageUrls: z.array(z.string().url()).default([]),
  messages: z.array(agentMessageSchema).default([]),
  currentDraft: aiBillDraftPayloadSchema.optional(),
});
export type BillIntakeInput = z.infer<typeof billIntakeInputSchema>;

export const billIntakeResultSchema = z.object({
  provider: z.string(),
  providerRequestId: z.string().optional(),
  rawAgentResult: z.unknown(),
  draftPayload: aiBillDraftPayloadSchema,
  reviewQuestions: z.array(reviewQuestionSchema),
  warnings: z.array(z.string()),
  reply: z.string(),
});
export type BillIntakeResult = z.infer<typeof billIntakeResultSchema>;
