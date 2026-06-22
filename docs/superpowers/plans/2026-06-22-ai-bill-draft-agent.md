# AI 补录账单 Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在后台 Web 增加一个 AI 补录账单 Agent 工作台，支持图片/文字输入、对话补全、会计确认后复用现有补录规则入账。

**Architecture:** 后端新增 `AiBillDraft` 草稿模型、`AiBillWorkflow`、工具调用式 `BillIntakeAgent` 和可替换 `AgentProvider`；第一版 Provider 使用 OpenAI 原生 Responses API。前端新增上传页和草稿工作台，工作台左侧展示原始材料，右侧编辑补录表单，顶部/侧边展示 Agent 问题和对话。

**Tech Stack:** Fastify、Prisma、SQLite、Zod、OpenAI Node SDK、Next.js、React、Vitest、TypeScript。

---

## 结对开发执行方式

本计划按小步执行。每次只推进一个能独立理解和验证的小目标：

1. 先说明这一小步要解决什么问题。
2. 先写或调整一个失败测试。
3. 运行测试，确认失败原因符合预期。
4. 写最小实现让测试通过。
5. 再运行测试确认通过。
6. 每完成一个稳定小块就提交。

如果某个任务仍然太大，执行时继续拆成更小的子步骤。例如“新增 AI 草稿 API”会拆成：先只做纯文字创建草稿，再做读取草稿，再做追加消息，再做确认提交，再补图片上传。

---

## 文件结构

### 后端 API

- 修改 `apps/api/prisma/schema.prisma`
  - 新增 `AiBillDraft` 模型。
- 新增 `apps/api/prisma/migrations/0011_ai_bill_drafts/migration.sql`
  - 创建 `AiBillDraft` 表和索引。
- 新增 `apps/api/src/manual-completed-billing.ts`
  - 承载现有手工补录 schema 和创建完成账单服务。
- 修改 `apps/api/src/app.ts`
  - 从内联手工补录逻辑改为调用服务。
  - 注册 AI 草稿 API 路由。
  - 接收可注入的 `aiBillAgent`，便于测试。
- 新增 `apps/api/src/ai-billing/types.ts`
  - 定义草稿 payload、问题、消息、工具输入输出的 Zod schema 和 TS 类型。
- 新增 `apps/api/src/ai-billing/tools.ts`
  - 实现车辆、司机、费用类型、费用汇总和 review 校验工具。
- 新增 `apps/api/src/ai-billing/agent.ts`
  - 定义 `BillIntakeAgent`、`AgentProvider`、工具注册表。
- 新增 `apps/api/src/ai-billing/openai-provider.ts`
  - 使用 OpenAI Responses API 执行工具调用循环。
- 新增 `apps/api/src/ai-billing/workflow.ts`
  - 实现创建草稿、追加消息、确认草稿、重试草稿。
- 修改 `apps/api/src/env.ts`
  - 增加 `OPENAI_API_KEY`、`AI_BILL_MODEL`、`AI_BILL_PROVIDER`。
- 修改 `apps/api/package.json`
  - 增加 `openai` 依赖。
- 修改 `apps/api/tests/api.test.ts`
  - 增加 AI 草稿 API 测试和 Prisma mock 字段。
- 新增 `apps/api/src/ai-billing/tools.test.ts`
  - 单测工具匹配、费用汇总、review 校验。
- 新增 `apps/api/src/ai-billing/agent.test.ts`
  - 单测 Agent 工具循环和 Provider 注入。

### 后台 Web

- 修改 `apps/admin-web/src/lib/api-client.ts`
  - 增加 AI 草稿类型和 `apiUploadAiBillDraft`。
- 新增 `apps/admin-web/src/components/admin/ai-bill-draft-model.ts`
  - 将 AI 草稿转换为表单初始状态，处理提交 payload。
- 新增 `apps/admin-web/src/components/admin/ai-bill-draft-model.test.ts`
  - 单测草稿转换、未知费用备注、费用模式选择。
- 新增 `apps/admin-web/src/components/admin/ai-bill-upload-form.tsx`
  - 图片/文字上传表单。
- 新增 `apps/admin-web/src/components/admin/ai-bill-workbench.tsx`
  - 工作台主组件：材料区、对话区、补录表单区。
- 新增 `apps/admin-web/src/app/trips/ai-billing/new/page.tsx`
  - 上传入口页。
- 新增 `apps/admin-web/src/app/trips/ai-billing/[draftId]/page.tsx`
  - 草稿确认工作台页。
- 修改 `apps/admin-web/src/app/trips/page.tsx`
  - 增加“AI 补录账单”入口。
- 修改 `apps/admin-web/src/app/reports/page.tsx`
  - 可选增加次要入口，沿用现有“补录完成账单”入口旁边。
- 修改 `apps/admin-web/src/app/globals.css`
  - 增加工作台布局、问题区、材料预览、字段提示样式。

---

### Task 1: 数据库模型和 Prisma 类型

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/0011_ai_bill_drafts/migration.sql`
- Modify: `apps/api/tests/api.test.ts`

- [ ] **Step 1: 写 Prisma schema 变更**

在 `apps/api/prisma/schema.prisma` 的 `Team` 和 `User` 关系中增加：

```prisma
model User {
  // existing fields stay unchanged
  aiBillDrafts AiBillDraft[] @relation("AiBillDraftCreator")
}

model Team {
  // existing fields stay unchanged
  aiBillDrafts AiBillDraft[]
}
```

在文件末尾增加：

```prisma
model AiBillDraft {
  id                String   @id @default(cuid())
  teamId            String
  createdBy         String
  status            String   @default("processing")
  inputMode         String
  imageStorageKeys  String   @default("[]")
  textNote          String?
  provider          String   @default("openai")
  providerRequestId String?
  rawAgentResult    String?
  draftPayload      String   @default("{}")
  reviewQuestions   String   @default("[]")
  warnings          String   @default("[]")
  messages          String   @default("[]")
  confirmedPayload  String?
  submittedTripId   String?
  errorMessage      String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  submittedAt       DateTime?

  team    Team @relation(fields: [teamId], references: [id])
  creator User @relation("AiBillDraftCreator", fields: [createdBy], references: [id])

  @@index([teamId, status])
  @@index([createdBy])
  @@index([submittedTripId])
}
```

- [ ] **Step 2: 创建迁移 SQL**

创建 `apps/api/prisma/migrations/0011_ai_bill_drafts/migration.sql`：

```sql
CREATE TABLE "AiBillDraft" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "teamId" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'processing',
  "inputMode" TEXT NOT NULL,
  "imageStorageKeys" TEXT NOT NULL DEFAULT '[]',
  "textNote" TEXT,
  "provider" TEXT NOT NULL DEFAULT 'openai',
  "providerRequestId" TEXT,
  "rawAgentResult" TEXT,
  "draftPayload" TEXT NOT NULL DEFAULT '{}',
  "reviewQuestions" TEXT NOT NULL DEFAULT '[]',
  "warnings" TEXT NOT NULL DEFAULT '[]',
  "messages" TEXT NOT NULL DEFAULT '[]',
  "confirmedPayload" TEXT,
  "submittedTripId" TEXT,
  "errorMessage" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "submittedAt" DATETIME,
  CONSTRAINT "AiBillDraft_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AiBillDraft_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "AiBillDraft_teamId_status_idx" ON "AiBillDraft"("teamId", "status");
CREATE INDEX "AiBillDraft_createdBy_idx" ON "AiBillDraft"("createdBy");
CREATE INDEX "AiBillDraft_submittedTripId_idx" ON "AiBillDraft"("submittedTripId");
```

- [ ] **Step 3: 生成 Prisma Client**

Run:

```powershell
npm --workspace apps/api run db:generate
```

Expected: `prisma generate` 成功，没有 schema 错误。

- [ ] **Step 4: 提交数据库模型**

```powershell
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/0011_ai_bill_drafts/migration.sql package-lock.json
git commit -m "feat: add ai bill draft data model"
```

---

### Task 2: AI 草稿类型和确定性工具

**Files:**
- Create: `apps/api/src/ai-billing/types.ts`
- Create: `apps/api/src/ai-billing/tools.ts`
- Create: `apps/api/src/ai-billing/tools.test.ts`

- [ ] **Step 1: 写失败的工具测试**

创建 `apps/api/src/ai-billing/tools.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import {
  calculateExpenseSummary,
  matchExpenseType,
  matchVehicle,
  validateDraftForReview,
} from "./tools";

const expenseTypes = [
  { id: "expense-fuel", name: "油费", enabled: true },
  { id: "expense-other", name: "其他", enabled: true },
];

describe("ai bill tools", () => {
  it("matches unknown expense names to other and preserves the original name", () => {
    expect(matchExpenseType({ originalName: "压车费", expenseTypes })).toEqual({
      expenseTypeId: "expense-other",
      expenseTypeName: "其他",
      confidence: "low",
      note: "原始费用名：压车费",
      needsReview: true,
    });
  });

  it("matches an exact plate number uniquely", () => {
    expect(
      matchVehicle({
        plateNumber: "闽A12345",
        vehicles: [
          { id: "vehicle-1", plateNumber: "闽A12345", status: "available" },
          { id: "vehicle-2", plateNumber: "闽A54321", status: "available" },
        ],
      }),
    ).toMatchObject({
      bestMatchId: "vehicle-1",
      confidence: "high",
      unique: true,
    });
  });

  it("detects detail total and recognized total conflicts", () => {
    expect(
      calculateExpenseSummary({
        expenses: [
          { originalName: "油费", amount: "300.00" },
          { originalName: "过路费", amount: "120.00" },
        ],
        totalExpense: "500.00",
      }),
    ).toEqual({
      detailTotal: "420.00",
      totalExpense: "500.00",
      suggestedMode: "needs_review",
      warnings: ["费用明细合计 420.00 与识别到的总费用 500.00 不一致，请会计确认使用哪一种。"],
    });
  });

  it("asks review questions for missing required fields", () => {
    expect(
      validateDraftForReview({
        vehicle: { value: null, confidence: "low", needsReview: true },
        driver: { value: "老王", confidence: "low", needsReview: true },
        customerName: { value: "", confidence: "low", needsReview: true },
        loadLocation: { value: "福州", confidence: "medium", needsReview: true },
        unloadLocation: { value: null, confidence: "low", needsReview: true },
        actualFreight: { value: "1800.00", confidence: "high", needsReview: false },
        settledAt: { value: "2026-06-22", confidence: "high", needsReview: false },
        expenseModeSuggestion: "details",
        expenses: [],
      }).questions.map((item) => item.field),
    ).toEqual(["vehicle", "driver", "customerName", "loadLocation", "unloadLocation", "expenses"]);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
npm --workspace apps/api test -- src/ai-billing/tools.test.ts
```

Expected: FAIL，模块 `./tools` 不存在。

- [ ] **Step 3: 新增类型文件**

创建 `apps/api/src/ai-billing/types.ts`：

```ts
import { z } from "zod";

export const confidenceSchema = z.enum(["high", "medium", "low"]);
export type Confidence = z.infer<typeof confidenceSchema>;

export const fieldGuessSchema = z.object({
  value: z.string().nullable(),
  confidence: confidenceSchema,
  evidence: z.string().optional(),
  needsReview: z.boolean(),
});

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
```

- [ ] **Step 4: 新增确定性工具实现**

创建 `apps/api/src/ai-billing/tools.ts`：

```ts
import type { AiBillDraftPayload, ReviewQuestion } from "./types";

type Confidence = "high" | "medium" | "low";

export function matchVehicle(input: {
  plateNumber?: string | null;
  vehicles: Array<{ id: string; plateNumber: string; status: string }>;
}) {
  const value = input.plateNumber?.trim();
  const candidates = value
    ? input.vehicles.filter((vehicle) => vehicle.plateNumber.includes(value) || value.includes(vehicle.plateNumber))
    : [];
  const exact = value ? input.vehicles.filter((vehicle) => vehicle.plateNumber === value) : [];
  const matches = exact.length > 0 ? exact : candidates;
  const confidence: Confidence = exact.length === 1 ? "high" : matches.length === 1 ? "medium" : "low";

  return {
    candidates: matches.map((vehicle) => ({ id: vehicle.id, plateNumber: vehicle.plateNumber })),
    bestMatchId: matches.length === 1 ? matches[0]?.id : undefined,
    confidence,
    unique: matches.length === 1,
  };
}

export function matchExpenseType(input: {
  originalName: string;
  expenseTypes: Array<{ id: string; name: string; enabled: boolean }>;
}) {
  const originalName = input.originalName.trim();
  const enabled = input.expenseTypes.filter((type) => type.enabled);
  const exact = enabled.find((type) => type.name === originalName);
  if (exact) {
    return {
      expenseTypeId: exact.id,
      expenseTypeName: exact.name,
      confidence: "high" as const,
      note: "",
      needsReview: false,
    };
  }

  const fuzzy = enabled.find((type) => originalName.includes(type.name) || type.name.includes(originalName));
  if (fuzzy) {
    return {
      expenseTypeId: fuzzy.id,
      expenseTypeName: fuzzy.name,
      confidence: "medium" as const,
      note: "",
      needsReview: true,
    };
  }

  const other = enabled.find((type) => type.name === "其他") ?? enabled[0];
  return {
    expenseTypeId: other?.id ?? "",
    expenseTypeName: other?.name ?? "其他",
    confidence: "low" as const,
    note: `原始费用名：${originalName}`,
    needsReview: true,
  };
}

function toAmount(value: string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function money(value: number) {
  return value.toFixed(2);
}

export function calculateExpenseSummary(input: {
  expenses: Array<{ originalName: string; amount: string }>;
  totalExpense?: string | null;
}) {
  const detailTotalNumber = input.expenses.reduce((sum, expense) => sum + (toAmount(expense.amount) ?? 0), 0);
  const detailTotal = money(detailTotalNumber);
  const totalExpenseNumber = toAmount(input.totalExpense);
  const warnings: string[] = [];
  let suggestedMode: "details" | "total" | "needs_review" = input.expenses.length > 0 ? "details" : "total";

  if (totalExpenseNumber != null && input.expenses.length > 0 && money(totalExpenseNumber) !== detailTotal) {
    warnings.push(`费用明细合计 ${detailTotal} 与识别到的总费用 ${money(totalExpenseNumber)} 不一致，请会计确认使用哪一种。`);
    suggestedMode = "needs_review";
  }

  return {
    detailTotal,
    totalExpense: totalExpenseNumber == null ? null : money(totalExpenseNumber),
    suggestedMode,
    warnings,
  };
}

export function validateDraftForReview(draft: AiBillDraftPayload) {
  const questions: ReviewQuestion[] = [];
  const add = (field: string, message: string, severity: "required" | "warning" = "required") => {
    questions.push({ field, message, severity });
  };

  if (!draft.vehicle.matchedVehicleId) add("vehicle", "请选择车辆。");
  if (!draft.driver.matchedDriverId) add("driver", "请选择司机。");
  if (!draft.customerName.value?.trim()) add("customerName", "请填写客户名称。");
  if (!draft.loadLocation.value?.trim() || draft.loadLocation.needsReview) add("loadLocation", "请确认装货地。");
  if (!draft.unloadLocation.value?.trim()) add("unloadLocation", "请填写卸货地。");
  if (!draft.actualFreight.value?.trim()) add("actualFreight", "请填写实际运费。");
  if (!draft.settledAt.value?.trim()) add("settledAt", "请选择完成/结算日期。");
  if (draft.expenseModeSuggestion === "details" && draft.expenses.length === 0) add("expenses", "请补充费用明细或切换为总费用。");
  if (draft.expenseModeSuggestion === "needs_review") add("expenseMode", "费用明细和总费用存在冲突，请选择一种录入方式。");

  return {
    questions,
    warnings: questions.filter((item) => item.severity === "warning").map((item) => item.message),
    readyForReview: true,
    blocksSubmit: questions.filter((item) => item.severity === "required").map((item) => item.field),
  };
}
```

- [ ] **Step 5: 运行工具测试确认通过**

Run:

```powershell
npm --workspace apps/api test -- src/ai-billing/tools.test.ts
```

Expected: PASS。

- [ ] **Step 6: 提交工具层**

```powershell
git add apps/api/src/ai-billing/types.ts apps/api/src/ai-billing/tools.ts apps/api/src/ai-billing/tools.test.ts
git commit -m "feat: add ai bill draft tools"
```

---

### Task 3: 抽出现有手工补录服务

**Files:**
- Create: `apps/api/src/manual-completed-billing.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/tests/api.test.ts`

- [ ] **Step 1: 运行现有手工补录测试作为基线**

Run:

```powershell
npm --workspace apps/api test -- tests/api.test.ts -t "manual completed"
```

Expected: PASS。这个任务只是重构，行为不应变化。

- [ ] **Step 2: 新增服务文件并移动 schema 与创建逻辑**

创建 `apps/api/src/manual-completed-billing.ts`，从 `app.ts` 移动 `manualCompletedExpenseSchema`、`manualCompletedTripSchema` 和 `/admin/trips/manual-completed` 事务里的创建逻辑。导出：

```ts
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { calculateSettlement } from "./finance";
import { serializeTripForAdmin } from "./serializers";

export const manualCompletedExpenseSchema = z.object({
  expenseTypeId: z.string().trim().min(1, { message: "请选择费用类型。" }),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, { message: "金额请输入最多两位小数的数字。" }),
  occurredAt: z.string().optional(),
  note: z.string().optional(),
});

export const manualCompletedTripSchema = z
  .object({
    vehicleId: z.string().trim().min(1, { message: "请选择车辆。" }),
    driverId: z.string().trim().min(1, { message: "请选择司机。" }),
    assistantDriverIds: z.array(z.string().trim().min(1)).optional(),
    customerName: z.string().trim().min(1, { message: "请填写客户名称。" }),
    loadLocation: z.string().trim().min(1, { message: "请填写装货地。" }),
    unloadLocation: z.string().trim().min(1, { message: "请填写卸货地。" }),
    actualFreight: z.string().regex(/^\d+(\.\d{1,2})?$/, { message: "实际运费请输入最多两位小数的数字。" }),
    settledAt: z.string().trim().min(1, { message: "请选择完成/结算日期。" }),
    accountingNote: z.string().optional(),
    expenses: z.array(manualCompletedExpenseSchema).optional(),
    totalExpense: z.object({ amount: z.string().regex(/^\d+(\.\d{1,2})?$/), note: z.string().optional() }).optional(),
  })
  .superRefine((value, context) => {
    const hasDetails = Boolean(value.expenses?.length);
    const hasTotal = Boolean(value.totalExpense);
    if (hasDetails && hasTotal) context.addIssue({ code: "custom", message: "费用明细和总费用只能选择一种录入方式。" });
    if (!hasDetails && !hasTotal) context.addIssue({ code: "custom", message: "请录入费用明细，或切换为只填总费用。" });
  });

export type ManualCompletedTripInput = z.infer<typeof manualCompletedTripSchema>;

export async function createManualCompletedTrip(input: {
  prisma: PrismaClient;
  user: { id: string; role: string; teamId: string | null };
  body: ManualCompletedTripInput;
  helpers: {
    scopedTeamId(user: { role: string; teamId: string | null }): string | undefined;
    parseLocalDate(value: string): Date;
    generateTripNo(): string;
    validateAssistantDrivers(input: {
      teamId: string;
      vehicleId: string;
      driverId: string;
      assistantDriverIds?: string[];
    }): Promise<string[]>;
    findOrCreateManualTotalExpenseType(tx: unknown, teamId: string): Promise<{ id: string }>;
    tripInclude: unknown;
    manualTotalExpenseTypeName: string;
  };
}) {
  // The moved implementation must keep the same validation order and audit payload as the current route.
  // The route and AI confirm endpoint both call this function.
  throw new Error("createManualCompletedTrip implementation is moved from app.ts in this step");
}
```

实现时用当前 `app.ts` 中现有事务代码替换最后的 throw。不要改变 audit action、settlement 计算、费用类型创建规则和 assistant driver 规则。

- [ ] **Step 3: 修改手工补录路由调用服务**

在 `apps/api/src/app.ts` 顶部导入：

```ts
import {
  createManualCompletedTrip,
  manualCompletedTripSchema,
} from "./manual-completed-billing";
```

将 `/admin/trips/manual-completed` 路由替换为：

```ts
app.post("/admin/trips/manual-completed", async (request, reply) => {
  const user = getCurrentUser(request);
  requireRole(user, "accountant");

  const parsed = manualCompletedTripSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send({
      message: parsed.error.issues[0]?.message ?? "补录账单保存失败，请检查信息后重试。",
    });
  }

  try {
    const trip = await createManualCompletedTrip({
      prisma,
      user,
      body: parsed.data,
      helpers: {
        scopedTeamId,
        parseLocalDate,
        generateTripNo,
        validateAssistantDrivers,
        findOrCreateManualTotalExpenseType,
        tripInclude,
        manualTotalExpenseTypeName,
      },
    });
    return { trip: serializeTripForAdmin(trip) };
  } catch (error) {
    const statusCode = (error as { statusCode?: unknown }).statusCode;
    if (statusCode === 400) {
      return reply.code(400).send({ message: (error as Error).message });
    }
    throw error;
  }
});
```

- [ ] **Step 4: 运行手工补录测试确认行为不变**

Run:

```powershell
npm --workspace apps/api test -- tests/api.test.ts -t "manual completed"
```

Expected: PASS，已有手工补录测试不需要改断言。

- [ ] **Step 5: 提交服务抽取**

```powershell
git add apps/api/src/app.ts apps/api/src/manual-completed-billing.ts apps/api/tests/api.test.ts
git commit -m "refactor: extract manual completed billing service"
```

---

### Task 4: Agent Provider 抽象和工作流骨架

**Files:**
- Create: `apps/api/src/ai-billing/agent.ts`
- Create: `apps/api/src/ai-billing/workflow.ts`
- Create: `apps/api/src/ai-billing/agent.test.ts`

- [ ] **Step 1: 写失败的 Agent 测试**

创建 `apps/api/src/ai-billing/agent.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { BillIntakeAgent } from "./agent";

describe("BillIntakeAgent", () => {
  it("passes tools and materials to the configured provider", async () => {
    const calls: unknown[] = [];
    const agent = new BillIntakeAgent({
      provider: {
        async run(input, tools) {
          calls.push({ input, tools: tools.map((tool) => tool.name) });
          return {
            providerRequestId: "provider-1",
            rawAgentResult: { ok: true },
            draftPayload: input.currentDraft,
            reviewQuestions: [],
            warnings: [],
            reply: "已生成草稿。",
          };
        },
      },
      tools: [
        {
          name: "get_team_billing_context",
          description: "获取团队上下文",
          inputSchema: { parse: (value: unknown) => value },
          async execute() {
            return { vehicles: [], drivers: [], expenseTypes: [] };
          },
        },
      ],
    });

    const result = await agent.run({
      teamId: "team-default",
      userId: "accountant-1",
      inputMode: "text",
      imageUrls: [],
      textNote: "运费 1800",
      messages: [],
      currentDraft: {
        vehicle: { value: null, confidence: "low", needsReview: true },
        driver: { value: null, confidence: "low", needsReview: true },
        customerName: { value: null, confidence: "low", needsReview: true },
        loadLocation: { value: null, confidence: "low", needsReview: true },
        unloadLocation: { value: null, confidence: "low", needsReview: true },
        actualFreight: { value: "1800.00", confidence: "high", needsReview: false },
        settledAt: { value: null, confidence: "low", needsReview: true },
        expenseModeSuggestion: "details",
        expenses: [],
      },
    });

    expect(result.providerRequestId).toBe("provider-1");
    expect(calls).toMatchObject([{ tools: ["get_team_billing_context"] }]);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
npm --workspace apps/api test -- src/ai-billing/agent.test.ts
```

Expected: FAIL，模块 `./agent` 不存在。

- [ ] **Step 3: 实现 Agent 抽象**

创建 `apps/api/src/ai-billing/agent.ts`：

```ts
import type { z } from "zod";
import type { AiBillDraftPayload, ReviewQuestion } from "./types";

export interface AgentMessage {
  role: "accountant" | "agent";
  content: string;
  createdAt: string;
}

export interface AgentRunInput {
  teamId: string;
  userId: string;
  inputMode: "images" | "text" | "mixed";
  imageUrls: string[];
  textNote: string | null;
  messages: AgentMessage[];
  currentDraft: AiBillDraftPayload;
}

export interface AgentRunResult {
  providerRequestId?: string;
  rawAgentResult: unknown;
  draftPayload: AiBillDraftPayload;
  reviewQuestions: ReviewQuestion[];
  warnings: string[];
  reply: string;
}

export interface AgentTool<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: Pick<z.ZodType<TInput>, "parse"> | { parse(value: unknown): TInput };
  execute(input: TInput, context: AgentRunInput): Promise<TOutput>;
}

export interface AgentProvider {
  run(input: AgentRunInput, tools: AgentTool[]): Promise<AgentRunResult>;
}

export class BillIntakeAgent {
  constructor(private readonly options: { provider: AgentProvider; tools: AgentTool[] }) {}

  run(input: AgentRunInput) {
    return this.options.provider.run(input, this.options.tools);
  }
}
```

- [ ] **Step 4: 实现工作流骨架**

创建 `apps/api/src/ai-billing/workflow.ts`：

```ts
import type { PrismaClient } from "@prisma/client";
import type { BillIntakeAgent, AgentMessage } from "./agent";
import { aiBillDraftPayloadSchema, reviewQuestionSchema } from "./types";

export class AiBillWorkflow {
  constructor(private readonly options: { prisma: PrismaClient; agent: BillIntakeAgent }) {}

  async appendMessage(input: { draftId: string; teamId: string; userId: string; message: string }) {
    const draft = await this.options.prisma.aiBillDraft.findFirst({
      where: { id: input.draftId, teamId: input.teamId },
    });
    if (!draft) throw Object.assign(new Error("AI 草稿不存在或已被删除"), { statusCode: 404 });
    if (draft.status === "submitted") throw Object.assign(new Error("已提交的 AI 草稿不能继续对话"), { statusCode: 409 });

    const messages = JSON.parse(draft.messages || "[]") as AgentMessage[];
    const nextMessages = [
      ...messages,
      { role: "accountant" as const, content: input.message, createdAt: new Date().toISOString() },
    ];
    const currentDraft = aiBillDraftPayloadSchema.parse(JSON.parse(draft.draftPayload || "{}"));
    const result = await this.options.agent.run({
      teamId: input.teamId,
      userId: input.userId,
      inputMode: draft.inputMode as "images" | "text" | "mixed",
      imageUrls: JSON.parse(draft.imageStorageKeys || "[]"),
      textNote: draft.textNote,
      messages: nextMessages,
      currentDraft,
    });

    const reviewQuestions = result.reviewQuestions.map((item) => reviewQuestionSchema.parse(item));
    return this.options.prisma.aiBillDraft.update({
      where: { id: draft.id },
      data: {
        providerRequestId: result.providerRequestId ?? draft.providerRequestId,
        rawAgentResult: JSON.stringify(result.rawAgentResult),
        draftPayload: JSON.stringify(result.draftPayload),
        reviewQuestions: JSON.stringify(reviewQuestions),
        warnings: JSON.stringify(result.warnings),
        messages: JSON.stringify([
          ...nextMessages,
          { role: "agent", content: result.reply, createdAt: new Date().toISOString() },
        ]),
        status: "needs_review",
      },
    });
  }
}
```

- [ ] **Step 5: 运行 Agent 测试确认通过**

Run:

```powershell
npm --workspace apps/api test -- src/ai-billing/agent.test.ts
```

Expected: PASS。

- [ ] **Step 6: 提交 Agent 抽象**

```powershell
git add apps/api/src/ai-billing/agent.ts apps/api/src/ai-billing/workflow.ts apps/api/src/ai-billing/agent.test.ts
git commit -m "feat: add ai bill agent abstraction"
```

---

### Task 5: AI 草稿 API 路由和测试注入

**Files:**
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/tests/api.test.ts`
- Modify: `apps/api/src/ai-billing/workflow.ts`

- [ ] **Step 1: 写 API 失败测试**

在 `apps/api/tests/api.test.ts` 增加测试：

```ts
it("creates a text-only ai bill draft", async () => {
  const mock = await buildTestApp({
    aiAgentResult: {
      reply: "请确认车辆和司机。",
      draftPayload: {
        vehicle: { value: null, confidence: "low", needsReview: true },
        driver: { value: null, confidence: "low", needsReview: true },
        customerName: { value: "宏达建材", confidence: "high", needsReview: false },
        loadLocation: { value: "福州", confidence: "high", needsReview: false },
        unloadLocation: { value: "厦门", confidence: "high", needsReview: false },
        actualFreight: { value: "1800.00", confidence: "high", needsReview: false },
        settledAt: { value: "2026-06-22", confidence: "medium", needsReview: true },
        expenseModeSuggestion: "details",
        expenses: [],
      },
      reviewQuestions: [{ field: "vehicle", message: "请选择车辆。", severity: "required" }],
      warnings: [],
    },
  });

  const response = await mock.app.inject({
    method: "POST",
    url: "/admin/ai-bill-drafts",
    headers: accountantHeaders,
    payload: { textNote: "宏达建材 福州到厦门 运费1800" },
  });

  expect(response.statusCode).toBe(200);
  expect(response.json().draft.status).toBe("needs_review");
  expect(mock.state.aiBillDrafts[0]).toMatchObject({
    inputMode: "text",
    textNote: "宏达建材 福州到厦门 运费1800",
  });
});

it("rejects ai bill draft creation without image or text", async () => {
  const mock = await buildTestApp();
  const response = await mock.app.inject({
    method: "POST",
    url: "/admin/ai-bill-drafts",
    headers: accountantHeaders,
    payload: {},
  });

  expect(response.statusCode).toBe(400);
});

it("updates an ai bill draft from accountant messages", async () => {
  const mock = await buildTestApp();
  mock.state.aiBillDrafts.push({
    id: "ai-draft-1",
    teamId,
    createdBy: accountantId,
    status: "needs_review",
    inputMode: "text",
    imageStorageKeys: "[]",
    textNote: "运费1800",
    provider: "openai",
    draftPayload: JSON.stringify(mock.emptyAiDraft),
    reviewQuestions: "[]",
    warnings: "[]",
    messages: "[]",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const response = await mock.app.inject({
    method: "POST",
    url: "/admin/ai-bill-drafts/ai-draft-1/messages",
    headers: accountantHeaders,
    payload: { message: "卸货地是厦门同安" },
  });

  expect(response.statusCode).toBe(200);
  expect(response.json().draft.messages).toHaveLength(2);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
npm --workspace apps/api test -- tests/api.test.ts -t "ai bill draft"
```

Expected: FAIL，路由和 mock 字段不存在。

- [ ] **Step 3: 扩展 Prisma mock**

在 `createPrismaMock()` 的 state 中增加：

```ts
aiBillDrafts: [] as Array<Record<string, unknown>>,
emptyAiDraft: {
  vehicle: { value: null, confidence: "low", needsReview: true },
  driver: { value: null, confidence: "low", needsReview: true },
  customerName: { value: null, confidence: "low", needsReview: true },
  loadLocation: { value: null, confidence: "low", needsReview: true },
  unloadLocation: { value: null, confidence: "low", needsReview: true },
  actualFreight: { value: null, confidence: "low", needsReview: true },
  settledAt: { value: null, confidence: "low", needsReview: true },
  expenseModeSuggestion: "details",
  expenses: [],
},
```

在 `prisma` mock 中增加：

```ts
aiBillDraft: {
  create: async ({ data }: { data: Record<string, unknown> }) => {
    const created = {
      id: `ai-draft-${state.aiBillDrafts.length + 1}`,
      createdAt: new Date("2026-06-22T08:00:00.000Z"),
      updatedAt: new Date("2026-06-22T08:00:00.000Z"),
      ...data,
    };
    state.aiBillDrafts.push(created);
    return created;
  },
  findFirst: async ({ where }: { where: Record<string, unknown> }) =>
    state.aiBillDrafts.find((draft) => {
      if (where.id && draft.id !== where.id) return false;
      if (where.teamId && draft.teamId !== where.teamId) return false;
      return true;
    }) ?? null,
  update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
    const index = state.aiBillDrafts.findIndex((draft) => draft.id === where.id);
    const updated = { ...state.aiBillDrafts[index], ...data, updatedAt: new Date("2026-06-22T08:05:00.000Z") };
    state.aiBillDrafts[index] = updated;
    return updated;
  },
},
```

- [ ] **Step 4: 修改 buildApp 支持注入测试 Agent**

在 `apps/api/src/app.ts` 修改签名：

```ts
export function buildApp(
  prisma: AppPrisma = new PrismaClient(),
  options: { aiBillAgent?: BillIntakeAgent } = {},
) {
```

在测试 helper 中注入 fake agent：

```ts
const app = buildApp(mock.prisma as never, {
  aiBillAgent: new BillIntakeAgent({
    provider: {
      async run(input) {
        return {
          providerRequestId: "test-provider",
          rawAgentResult: { input },
          draftPayload: options.aiAgentResult?.draftPayload ?? mock.state.emptyAiDraft,
          reviewQuestions: options.aiAgentResult?.reviewQuestions ?? [],
          warnings: options.aiAgentResult?.warnings ?? [],
          reply: options.aiAgentResult?.reply ?? "已更新草稿。",
        };
      },
    },
    tools: [],
  }),
});
```

- [ ] **Step 5: 实现 AI 草稿路由**

在 `apps/api/src/app.ts` 注册：

```ts
app.post("/admin/ai-bill-drafts", async (request, reply) => {
  const user = getCurrentUser(request);
  requireRole(user, "accountant");
  const body = z.object({ textNote: z.string().optional() }).parse(request.body ?? {});
  const textNote = body.textNote?.trim() || null;
  if (!textNote) return reply.code(400).send({ message: "请上传图片或输入账单文字。" });

  const teamId = scopedTeamId(user);
  if (!teamId) return reply.code(403).send({ message: "Team scope missing" });

  const draft = await prisma.aiBillDraft.create({
    data: {
      teamId,
      createdBy: user.id,
      status: "processing",
      inputMode: "text",
      imageStorageKeys: "[]",
      textNote,
      provider: "openai",
      draftPayload: "{}",
      reviewQuestions: "[]",
      warnings: "[]",
      messages: "[]",
    },
  });

  const workflow = new AiBillWorkflow({ prisma: prisma as PrismaClient, agent: options.aiBillAgent ?? createDefaultAiBillAgent() });
  const updated = await workflow.appendMessage({
    draftId: draft.id,
    teamId,
    userId: user.id,
    message: textNote,
  });

  return { draft: serializeAiBillDraft(updated) };
});
```

同时新增 `GET /admin/ai-bill-drafts/:draftId` 和 `POST /admin/ai-bill-drafts/:draftId/messages`，都必须用 `scopedTeamId(user)` 约束团队。

- [ ] **Step 6: 运行 API 测试确认通过**

Run:

```powershell
npm --workspace apps/api test -- tests/api.test.ts -t "ai bill draft"
```

Expected: PASS。

- [ ] **Step 7: 提交 API 草稿路由**

```powershell
git add apps/api/src/app.ts apps/api/src/ai-billing/workflow.ts apps/api/tests/api.test.ts
git commit -m "feat: add ai bill draft api"
```

---

### Task 6: OpenAI Provider 和环境配置

**Files:**
- Modify: `apps/api/package.json`
- Modify: `package-lock.json`
- Modify: `apps/api/src/env.ts`
- Create: `apps/api/src/ai-billing/openai-provider.ts`
- Modify: `apps/api/src/ai-billing/agent.test.ts`

- [ ] **Step 1: 安装 OpenAI SDK**

Run:

```powershell
npm install openai --workspace apps/api
```

Expected: `apps/api/package.json` 增加 `openai`，`package-lock.json` 更新。

- [ ] **Step 2: 增加环境变量**

在 `apps/api/src/env.ts` 增加：

```ts
export const aiBillProvider = process.env.AI_BILL_PROVIDER ?? "openai";
export const aiBillModel = process.env.AI_BILL_MODEL ?? "gpt-5.4-mini";
export const openAiApiKey = process.env.OPENAI_API_KEY ?? "";
```

- [ ] **Step 3: 写 Provider 单测**

在 `apps/api/src/ai-billing/agent.test.ts` 增加：

```ts
it("executes provider tool calls before returning final draft", async () => {
  const toolCalls: unknown[] = [];
  const provider = createTestOpenAiProvider([
    {
      id: "response-1",
      output: [
        {
          type: "function_call",
          call_id: "call-1",
          name: "get_team_billing_context",
          arguments: "{}",
        },
      ],
    },
    {
      id: "response-2",
      output_text: JSON.stringify({
        draftPayload: {
          vehicle: { value: null, confidence: "low", needsReview: true },
          driver: { value: null, confidence: "low", needsReview: true },
          customerName: { value: "宏达建材", confidence: "high", needsReview: false },
          loadLocation: { value: "福州", confidence: "high", needsReview: false },
          unloadLocation: { value: "厦门", confidence: "high", needsReview: false },
          actualFreight: { value: "1800.00", confidence: "high", needsReview: false },
          settledAt: { value: "2026-06-22", confidence: "high", needsReview: false },
          expenseModeSuggestion: "details",
          expenses: [],
        },
        reviewQuestions: [],
        warnings: [],
        reply: "已生成草稿。",
      }),
    },
  ]);

  const result = await provider.run(minimalAgentInput, [
    {
      name: "get_team_billing_context",
      description: "获取团队上下文",
      inputSchema: { parse: (value: unknown) => value },
      async execute(input) {
        toolCalls.push(input);
        return { vehicles: [], drivers: [], expenseTypes: [] };
      },
    },
  ]);

  expect(toolCalls).toHaveLength(1);
  expect(result.reply).toBe("已生成草稿。");
});
```

- [ ] **Step 4: 实现 OpenAI Provider**

创建 `apps/api/src/ai-billing/openai-provider.ts`：

```ts
import OpenAI from "openai";
import type { AgentProvider, AgentRunInput, AgentTool } from "./agent";
import { aiBillDraftPayloadSchema, reviewQuestionSchema } from "./types";

export class OpenAiResponsesAgentProvider implements AgentProvider {
  private readonly client: OpenAI;

  constructor(private readonly options: { apiKey: string; model: string; client?: OpenAI }) {
    this.client = options.client ?? new OpenAI({ apiKey: options.apiKey });
  }

  async run(input: AgentRunInput, tools: AgentTool[]) {
    const toolDefinitions = tools.map((tool) => ({
      type: "function" as const,
      name: tool.name,
      description: tool.description,
      parameters: { type: "object", additionalProperties: true },
    }));

    const messages: Array<Record<string, unknown>> = [
      {
        role: "system",
        content: "你是 HaulHub 的账单补录 Agent。你只能生成待会计确认的草稿，不能直接入账。",
      },
      {
        role: "user",
        content: JSON.stringify({
          inputMode: input.inputMode,
          textNote: input.textNote,
          imageUrls: input.imageUrls,
          messages: input.messages,
          currentDraft: input.currentDraft,
        }),
      },
    ];

    let response = await this.client.responses.create({
      model: this.options.model,
      input: messages as never,
      tools: toolDefinitions as never,
    });

    for (let index = 0; index < 8; index += 1) {
      const calls = response.output?.filter((item) => item.type === "function_call") ?? [];
      if (calls.length === 0) break;

      const toolOutputs = [];
      for (const call of calls) {
        const tool = tools.find((item) => item.name === call.name);
        if (!tool) throw new Error(`Unknown AI bill tool: ${call.name}`);
        const parsedInput = tool.inputSchema.parse(JSON.parse(call.arguments || "{}"));
        const output = await tool.execute(parsedInput, input);
        toolOutputs.push({
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify(output),
        });
      }

      response = await this.client.responses.create({
        model: this.options.model,
        previous_response_id: response.id,
        input: toolOutputs as never,
        tools: toolDefinitions as never,
      });
    }

    const parsed = JSON.parse(response.output_text || "{}") as {
      draftPayload: unknown;
      reviewQuestions?: unknown[];
      warnings?: string[];
      reply?: string;
    };

    return {
      providerRequestId: response.id,
      rawAgentResult: response,
      draftPayload: aiBillDraftPayloadSchema.parse(parsed.draftPayload),
      reviewQuestions: (parsed.reviewQuestions ?? []).map((item) => reviewQuestionSchema.parse(item)),
      warnings: parsed.warnings ?? [],
      reply: parsed.reply ?? "已更新 AI 草稿。",
    };
  }
}
```

- [ ] **Step 5: 运行 Provider 测试和类型检查**

Run:

```powershell
npm --workspace apps/api test -- src/ai-billing/agent.test.ts
npm --workspace apps/api run lint
```

Expected: PASS。

- [ ] **Step 6: 提交 OpenAI Provider**

```powershell
git add apps/api/package.json package-lock.json apps/api/src/env.ts apps/api/src/ai-billing/openai-provider.ts apps/api/src/ai-billing/agent.test.ts
git commit -m "feat: add openai ai bill provider"
```

---

### Task 7: 确认草稿复用手工补录服务

**Files:**
- Modify: `apps/api/src/ai-billing/workflow.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/tests/api.test.ts`

- [ ] **Step 1: 写 confirm API 失败测试**

在 `apps/api/tests/api.test.ts` 增加：

```ts
it("confirms an ai bill draft through manual completed billing rules", async () => {
  const mock = await buildTestApp();
  mock.state.aiBillDrafts.push({
    id: "ai-draft-1",
    teamId,
    createdBy: accountantId,
    status: "needs_review",
    inputMode: "text",
    imageStorageKeys: "[]",
    textNote: "宏达建材 运费1800",
    provider: "openai",
    draftPayload: JSON.stringify(mock.state.emptyAiDraft),
    reviewQuestions: "[]",
    warnings: "[]",
    messages: "[]",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const response = await mock.app.inject({
    method: "POST",
    url: "/admin/ai-bill-drafts/ai-draft-1/confirm",
    headers: accountantHeaders,
    payload: {
      vehicleId: "vehicle-1",
      driverId,
      customerName: "宏达建材",
      loadLocation: "福州",
      unloadLocation: "厦门",
      actualFreight: "1800.00",
      settledAt: "2026-06-22",
      expenses: [{ expenseTypeId: "expense-type-1", amount: "300.00", occurredAt: "2026-06-22", note: "油费" }],
    },
  });

  expect(response.statusCode).toBe(200);
  expect(response.json().trip.status).toBe("completed");
  expect(response.json().draft.status).toBe("submitted");
  expect(mock.state.aiBillDrafts[0].submittedTripId).toBe("trip-created");
});
```

- [ ] **Step 2: 实现 workflow confirmDraft**

在 `apps/api/src/ai-billing/workflow.ts` 增加：

```ts
import type { ManualCompletedTripInput } from "../manual-completed-billing";

async confirmDraft(input: {
  draftId: string;
  teamId: string;
  userId: string;
  payload: ManualCompletedTripInput;
  createTrip: (payload: ManualCompletedTripInput) => Promise<{ id: string; trip: unknown }>;
}) {
  const draft = await this.options.prisma.aiBillDraft.findFirst({
    where: { id: input.draftId, teamId: input.teamId },
  });
  if (!draft) throw Object.assign(new Error("AI 草稿不存在或已被删除"), { statusCode: 404 });
  if (draft.status !== "needs_review") throw Object.assign(new Error("只有待确认草稿可以提交"), { statusCode: 409 });

  const result = await input.createTrip(input.payload);
  const updated = await this.options.prisma.aiBillDraft.update({
    where: { id: draft.id },
    data: {
      status: "submitted",
      confirmedPayload: JSON.stringify(input.payload),
      submittedTripId: result.id,
      submittedAt: new Date(),
    },
  });
  return { draft: updated, trip: result.trip };
}
```

- [ ] **Step 3: 实现 confirm 路由**

在 `apps/api/src/app.ts` 增加：

```ts
app.post("/admin/ai-bill-drafts/:draftId/confirm", async (request, reply) => {
  const user = getCurrentUser(request);
  requireRole(user, "accountant");
  const { draftId } = z.object({ draftId: z.string() }).parse(request.params);
  const parsed = manualCompletedTripSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ message: parsed.error.issues[0]?.message ?? "请检查确认信息。" });
  const teamId = scopedTeamId(user);
  if (!teamId) return reply.code(403).send({ message: "Team scope missing" });

  const workflow = new AiBillWorkflow({ prisma: prisma as PrismaClient, agent: options.aiBillAgent ?? createDefaultAiBillAgent() });
  const result = await workflow.confirmDraft({
    draftId,
    teamId,
    userId: user.id,
    payload: parsed.data,
    createTrip: async (payload) => {
      const trip = await createManualCompletedTrip({
        prisma,
        user,
        body: payload,
        helpers: {
          scopedTeamId,
          parseLocalDate,
          generateTripNo,
          validateAssistantDrivers,
          findOrCreateManualTotalExpenseType,
          tripInclude,
          manualTotalExpenseTypeName,
        },
      });
      return { id: trip.id, trip: serializeTripForAdmin(trip) };
    },
  });

  return { trip: result.trip, draft: serializeAiBillDraft(result.draft) };
});
```

- [ ] **Step 4: 运行 confirm 测试**

Run:

```powershell
npm --workspace apps/api test -- tests/api.test.ts -t "confirms an ai bill draft"
```

Expected: PASS。

- [ ] **Step 5: 提交 confirm API**

```powershell
git add apps/api/src/app.ts apps/api/src/ai-billing/workflow.ts apps/api/tests/api.test.ts
git commit -m "feat: confirm ai bill drafts"
```

---

### Task 8: Admin API Client 和草稿模型转换

**Files:**
- Modify: `apps/admin-web/src/lib/api-client.ts`
- Create: `apps/admin-web/src/components/admin/ai-bill-draft-model.ts`
- Create: `apps/admin-web/src/components/admin/ai-bill-draft-model.test.ts`

- [ ] **Step 1: 写前端模型失败测试**

创建 `apps/admin-web/src/components/admin/ai-bill-draft-model.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { aiDraftToManualFormState, confirmedPayloadFromAiForm } from "./ai-bill-draft-model";

describe("ai bill draft model", () => {
  it("maps AI draft fields to manual billing form state", () => {
    const state = aiDraftToManualFormState({
      vehicle: { value: "闽A12345", matchedVehicleId: "vehicle-1", confidence: "high", needsReview: false },
      driver: { value: "王建国", matchedDriverId: "driver-1", confidence: "medium", needsReview: true },
      customerName: { value: "宏达建材", confidence: "high", needsReview: false },
      loadLocation: { value: "福州", confidence: "high", needsReview: false },
      unloadLocation: { value: "厦门", confidence: "high", needsReview: false },
      actualFreight: { value: "1800.00", confidence: "high", needsReview: false },
      settledAt: { value: "2026-06-22", confidence: "high", needsReview: false },
      expenseModeSuggestion: "details",
      expenses: [
        {
          originalName: "压车费",
          matchedExpenseTypeId: "expense-other",
          matchedExpenseTypeName: "其他",
          amount: { value: "120.00", confidence: "medium", needsReview: true },
          note: "原始费用名：压车费",
          needsReview: true,
        },
      ],
    });

    expect(state.vehicleId).toBe("vehicle-1");
    expect(state.driverId).toBe("driver-1");
    expect(state.expenses[0]).toMatchObject({ expenseTypeId: "expense-other", note: "原始费用名：压车费" });
  });

  it("builds confirm payload for detail expenses", () => {
    expect(
      confirmedPayloadFromAiForm({
        vehicleId: "vehicle-1",
        driverId: "driver-1",
        customerName: "宏达建材",
        loadLocation: "福州",
        unloadLocation: "厦门",
        actualFreight: "1800.00",
        settledAt: "2026-06-22",
        accountingNote: "",
        expenseMode: "details",
        expenses: [{ expenseTypeId: "expense-fuel", amount: "300.00", occurredAt: "2026-06-22", note: "油费" }],
        totalExpense: "",
        totalExpenseNote: "",
      }),
    ).toMatchObject({
      expenses: [{ expenseTypeId: "expense-fuel", amount: "300.00" }],
    });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
npm --workspace apps/admin-web test -- src/components/admin/ai-bill-draft-model.test.ts
```

Expected: FAIL，模型文件不存在。

- [ ] **Step 3: 扩展 API Client 类型**

在 `apps/admin-web/src/lib/api-client.ts` 增加：

```ts
export interface ApiAiBillDraft {
  id: string;
  status: "processing" | "needs_review" | "submitted" | "failed" | string;
  inputMode: "images" | "text" | "mixed" | string;
  imageUrls: string[];
  textNote: string | null;
  draftPayload: AiBillDraftPayload;
  reviewQuestions: Array<{ field: string; message: string; severity: "required" | "warning" | string }>;
  warnings: string[];
  messages: Array<{ role: "accountant" | "agent" | string; content: string; createdAt: string }>;
  submittedTripId: string | null;
  errorMessage: string | null;
}

export interface AiBillDraftPayload {
  vehicle: FieldGuess & { matchedVehicleId?: string; candidates?: Array<{ id: string; plateNumber: string }> };
  driver: FieldGuess & { matchedDriverId?: string; candidates?: Array<{ id: string; name: string; phone?: string }> };
  customerName: FieldGuess;
  loadLocation: FieldGuess;
  unloadLocation: FieldGuess;
  actualFreight: FieldGuess;
  settledAt: FieldGuess;
  expenseModeSuggestion: "details" | "total" | "needs_review";
  expenses: Array<{
    originalName: string;
    matchedExpenseTypeId?: string;
    matchedExpenseTypeName?: string;
    amount: FieldGuess;
    occurredAt?: FieldGuess;
    note?: string;
    needsReview: boolean;
  }>;
  totalExpense?: FieldGuess;
  accountingNote?: FieldGuess;
}

export interface FieldGuess {
  value: string | null;
  confidence: "high" | "medium" | "low";
  evidence?: string;
  needsReview: boolean;
}
```

- [ ] **Step 4: 实现草稿转换模型**

创建 `apps/admin-web/src/components/admin/ai-bill-draft-model.ts`：

```ts
import type { AiBillDraftPayload } from "@/lib/api-client";

export type AiBillExpenseMode = "details" | "total";

export interface AiBillFormState {
  vehicleId: string;
  driverId: string;
  customerName: string;
  loadLocation: string;
  unloadLocation: string;
  actualFreight: string;
  settledAt: string;
  accountingNote: string;
  expenseMode: AiBillExpenseMode;
  expenses: Array<{ expenseTypeId: string; amount: string; occurredAt: string; note: string }>;
  totalExpense: string;
  totalExpenseNote: string;
}

export function aiDraftToManualFormState(draft: AiBillDraftPayload): AiBillFormState {
  const expenseMode: AiBillExpenseMode = draft.expenseModeSuggestion === "total" ? "total" : "details";
  return {
    vehicleId: draft.vehicle.matchedVehicleId ?? "",
    driverId: draft.driver.matchedDriverId ?? "",
    customerName: draft.customerName.value ?? "",
    loadLocation: draft.loadLocation.value ?? "",
    unloadLocation: draft.unloadLocation.value ?? "",
    actualFreight: draft.actualFreight.value ?? "",
    settledAt: draft.settledAt.value ?? "",
    accountingNote: draft.accountingNote?.value ?? "",
    expenseMode,
    expenses:
      draft.expenses.length > 0
        ? draft.expenses.map((expense) => ({
            expenseTypeId: expense.matchedExpenseTypeId ?? "",
            amount: expense.amount.value ?? "",
            occurredAt: expense.occurredAt?.value ?? draft.settledAt.value ?? "",
            note: expense.note ?? "",
          }))
        : [{ expenseTypeId: "", amount: "", occurredAt: draft.settledAt.value ?? "", note: "" }],
    totalExpense: draft.totalExpense?.value ?? "",
    totalExpenseNote: draft.totalExpense?.evidence ?? "",
  };
}

export function confirmedPayloadFromAiForm(state: AiBillFormState) {
  const base = {
    vehicleId: state.vehicleId,
    driverId: state.driverId,
    customerName: state.customerName,
    loadLocation: state.loadLocation,
    unloadLocation: state.unloadLocation,
    actualFreight: state.actualFreight,
    settledAt: state.settledAt,
    accountingNote: state.accountingNote,
  };
  if (state.expenseMode === "total") {
    return {
      ...base,
      totalExpense: {
        amount: state.totalExpense,
        ...(state.totalExpenseNote ? { note: state.totalExpenseNote } : {}),
      },
    };
  }
  return {
    ...base,
    expenses: state.expenses.map((expense) => ({
      expenseTypeId: expense.expenseTypeId,
      amount: expense.amount,
      occurredAt: expense.occurredAt,
      note: expense.note,
    })),
  };
}
```

- [ ] **Step 5: 运行前端模型测试**

Run:

```powershell
npm --workspace apps/admin-web test -- src/components/admin/ai-bill-draft-model.test.ts
```

Expected: PASS。

- [ ] **Step 6: 提交前端模型**

```powershell
git add apps/admin-web/src/lib/api-client.ts apps/admin-web/src/components/admin/ai-bill-draft-model.ts apps/admin-web/src/components/admin/ai-bill-draft-model.test.ts
git commit -m "feat: add ai bill draft web model"
```

---

### Task 9: 上传页和入口

**Files:**
- Create: `apps/admin-web/src/components/admin/ai-bill-upload-form.tsx`
- Create: `apps/admin-web/src/app/trips/ai-billing/new/page.tsx`
- Modify: `apps/admin-web/src/app/trips/page.tsx`
- Modify: `apps/admin-web/src/app/globals.css`

- [ ] **Step 1: 新增上传表单组件**

创建 `apps/admin-web/src/components/admin/ai-bill-upload-form.tsx`：

```tsx
"use client";

import { UploadCloud } from "lucide-react";

export function AiBillUploadForm({ action }: { action: (formData: FormData) => void | Promise<void> }) {
  return (
    <form className="form-panel ai-bill-upload-form" action={action}>
      <section className="form-section">
        <div className="form-section-head">
          <h2>原始材料</h2>
          <p>一组材料对应一张账单，可以只上传图片、只输入文字，或两者都提供。</p>
        </div>
        <label>
          账单图片
          <input name="files" type="file" accept="image/*" multiple />
        </label>
        <label>
          账单文字
          <textarea
            name="textNote"
            rows={8}
            placeholder="例如：闽A12345 王建国，6月22日福州到厦门，宏达建材，运费1800，油费300，过路费120。"
          />
        </label>
      </section>
      <div className="form-actions">
        <button className="primary-button" type="submit">
          <UploadCloud size={16} />
          开始 AI 识别
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: 新增上传页面**

创建 `apps/admin-web/src/app/trips/ai-billing/new/page.tsx`：

```tsx
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { AiBillUploadForm } from "@/components/admin/ai-bill-upload-form";
import { apiUploadAiBillDraft } from "@/lib/api-client";

export const dynamic = "force-dynamic";

async function createAiBillDraftAction(formData: FormData) {
  "use server";
  const { draft } = await apiUploadAiBillDraft(formData);
  redirect(`/trips/ai-billing/${draft.id}`);
}

export default function NewAiBillDraftPage() {
  return (
    <AdminShell>
      <section className="page-heading">
        <div>
          <h1>AI 补录账单</h1>
          <p>上传账单材料或粘贴文字，由 AI 生成待确认补录草稿。</p>
        </div>
      </section>
      <AiBillUploadForm action={createAiBillDraftAction} />
    </AdminShell>
  );
}
```

- [ ] **Step 3: 实现 apiUploadAiBillDraft**

在 `apps/admin-web/src/lib/api-client.ts` 增加：

```ts
export async function apiUploadAiBillDraft(formData: FormData): Promise<{ draft: ApiAiBillDraft }> {
  const response = await fetch(`${internalApiBaseUrl}/admin/ai-bill-drafts`, {
    method: "POST",
    headers: await adminHeaders(),
    body: formData,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, `AI 补录草稿创建失败：${response.status}`));
  }

  return response.json() as Promise<{ draft: ApiAiBillDraft }>;
}
```

- [ ] **Step 4: 增加入口链接**

在 `apps/admin-web/src/app/trips/page.tsx` 页面 heading action 区增加：

```tsx
<Link className="secondary-button" href="/trips/ai-billing/new">
  AI 补录账单
</Link>
```

- [ ] **Step 5: 运行前端构建检查**

Run:

```powershell
npm --workspace apps/admin-web run build
```

Expected: build 成功。

- [ ] **Step 6: 提交上传页**

```powershell
git add apps/admin-web/src/components/admin/ai-bill-upload-form.tsx apps/admin-web/src/app/trips/ai-billing/new/page.tsx apps/admin-web/src/app/trips/page.tsx apps/admin-web/src/lib/api-client.ts apps/admin-web/src/app/globals.css
git commit -m "feat: add ai bill upload page"
```

---

### Task 10: 草稿工作台页面

**Files:**
- Create: `apps/admin-web/src/components/admin/ai-bill-workbench.tsx`
- Create: `apps/admin-web/src/app/trips/ai-billing/[draftId]/page.tsx`
- Modify: `apps/admin-web/src/lib/api-client.ts`
- Modify: `apps/admin-web/src/app/globals.css`

- [ ] **Step 1: 增加 API client 方法**

在 `apps/admin-web/src/lib/api-client.ts` 增加：

```ts
export async function apiAppendAiBillDraftMessage(
  draftId: string,
  message: string,
): Promise<{ draft: ApiAiBillDraft }> {
  return apiPost<{ draft: ApiAiBillDraft }>(`/admin/ai-bill-drafts/${draftId}/messages`, { message });
}

export async function apiConfirmAiBillDraft(
  draftId: string,
  payload: Record<string, unknown>,
): Promise<{ draft: ApiAiBillDraft; trip: ApiTrip }> {
  return apiPost<{ draft: ApiAiBillDraft; trip: ApiTrip }>(`/admin/ai-bill-drafts/${draftId}/confirm`, payload);
}
```

- [ ] **Step 2: 新增工作台组件**

创建 `apps/admin-web/src/components/admin/ai-bill-workbench.tsx`，组件必须：

```tsx
"use client";

import { Send, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { ApiAiBillDraft, ApiDriver, ApiExpenseType, ApiVehicle } from "@/lib/api-client";
import {
  aiDraftToManualFormState,
  confirmedPayloadFromAiForm,
  type AiBillFormState,
} from "./ai-bill-draft-model";

export function AiBillWorkbench({
  draft,
  vehicles,
  drivers,
  expenseTypes,
  messageAction,
  confirmAction,
}: {
  draft: ApiAiBillDraft;
  vehicles: ApiVehicle[];
  drivers: ApiDriver[];
  expenseTypes: ApiExpenseType[];
  messageAction: (formData: FormData) => void | Promise<void>;
  confirmAction: (formData: FormData) => void | Promise<void>;
}) {
  const [formState, setFormState] = useState<AiBillFormState>(() => aiDraftToManualFormState(draft.draftPayload));
  const confirmPayload = JSON.stringify(confirmedPayloadFromAiForm(formState));

  return (
    <div className="ai-bill-workbench">
      <aside className="ai-bill-source-panel">
        <h2>原始材料</h2>
        {draft.textNote ? <pre className="ai-bill-text-note">{draft.textNote}</pre> : null}
        {draft.imageUrls.map((url) => (
          <img key={url} src={url} alt="账单材料" className="ai-bill-source-image" />
        ))}
      </aside>

      <section className="ai-bill-agent-panel">
        <h2>Agent 问题</h2>
        {draft.reviewQuestions.length > 0 ? (
          <ul>
            {draft.reviewQuestions.map((question) => (
              <li key={`${question.field}-${question.message}`}>{question.message}</li>
            ))}
          </ul>
        ) : (
          <p>当前没有必须追问的问题，请检查表单后确认补录。</p>
        )}
        <div className="ai-bill-messages">
          {draft.messages.map((message) => (
            <p key={`${message.createdAt}-${message.content}`} className={`ai-bill-message ${message.role}`}>
              {message.content}
            </p>
          ))}
        </div>
        <form action={messageAction} className="ai-bill-message-form">
          <input name="message" placeholder="例如：卸货地是厦门同安，司机选王建国" />
          <button type="submit" className="icon-button" aria-label="发送">
            <Send size={16} />
          </button>
        </form>
      </section>

      <form action={confirmAction} className="form-panel ai-bill-confirm-form">
        <input type="hidden" name="confirmedPayload" value={confirmPayload} />
        <section className="form-section">
          <div className="form-section-head">
            <h2>补录表单</h2>
            <p>AI 已填好的内容需要会计最终确认。</p>
          </div>
          {/* 表单字段按 ManualCompletedBillingForm 的字段和 name 对齐，用 formState 控制。 */}
        </section>
        <div className="form-actions">
          <button className="primary-button" type="submit">
            确认补录
          </button>
        </div>
      </form>
    </div>
  );
}
```

实现时把注释处替换为完整字段：车辆、司机、客户、装货地、卸货地、运费、日期、费用明细/总费用、备注。字段 `name` 可不与普通表单一致，因为最终通过 `confirmedPayload` 提交。

- [ ] **Step 3: 新增工作台页面**

创建 `apps/admin-web/src/app/trips/ai-billing/[draftId]/page.tsx`：

```tsx
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { AiBillWorkbench } from "@/components/admin/ai-bill-workbench";
import { apiGet, apiPost, type ApiAiBillDraft, type ApiDriver, type ApiExpenseType, type ApiTrip, type ApiVehicle } from "@/lib/api-client";

export const dynamic = "force-dynamic";

async function appendMessageAction(draftId: string, formData: FormData) {
  "use server";
  const message = String(formData.get("message") || "");
  if (message.trim()) await apiPost(`/admin/ai-bill-drafts/${draftId}/messages`, { message });
  redirect(`/trips/ai-billing/${draftId}`);
}

async function confirmDraftAction(draftId: string, formData: FormData) {
  "use server";
  const payload = JSON.parse(String(formData.get("confirmedPayload") || "{}")) as Record<string, unknown>;
  const { trip } = await apiPost<{ draft: ApiAiBillDraft; trip: ApiTrip }>(`/admin/ai-bill-drafts/${draftId}/confirm`, payload);
  redirect(`/trips/${trip.id}`);
}

export default async function AiBillDraftPage({ params }: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await params;
  const [{ draft }, { vehicles }, { drivers }, { expenseTypes }] = await Promise.all([
    apiGet<{ draft: ApiAiBillDraft }>(`/admin/ai-bill-drafts/${draftId}`),
    apiGet<{ vehicles: ApiVehicle[] }>("/admin/vehicles"),
    apiGet<{ drivers: ApiDriver[] }>("/admin/drivers"),
    apiGet<{ expenseTypes: ApiExpenseType[] }>("/admin/expense-types"),
  ]);

  return (
    <AdminShell>
      <section className="page-heading">
        <div>
          <h1>AI 补录确认</h1>
          <p>根据 Agent 草稿补全信息，确认后计入利润统计。</p>
        </div>
      </section>
      <AiBillWorkbench
        draft={draft}
        vehicles={vehicles.filter((vehicle) => vehicle.status === "available")}
        drivers={drivers.filter((driver) => driver.status === "active")}
        expenseTypes={expenseTypes.filter((type) => type.enabled)}
        messageAction={appendMessageAction.bind(null, draftId)}
        confirmAction={confirmDraftAction.bind(null, draftId)}
      />
    </AdminShell>
  );
}
```

- [ ] **Step 4: 增加工作台 CSS**

在 `apps/admin-web/src/app/globals.css` 增加：

```css
.ai-bill-workbench {
  display: grid;
  grid-template-columns: minmax(260px, 0.9fr) minmax(320px, 1.1fr);
  gap: 16px;
  align-items: start;
}

.ai-bill-source-panel,
.ai-bill-agent-panel {
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--surface);
  padding: 16px;
}

.ai-bill-agent-panel {
  grid-column: 1 / -1;
}

.ai-bill-confirm-form {
  grid-column: 2;
}

.ai-bill-source-image {
  width: 100%;
  max-height: 520px;
  object-fit: contain;
  border-radius: 8px;
  border: 1px solid var(--border-subtle);
}

.ai-bill-text-note {
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 960px) {
  .ai-bill-workbench {
    grid-template-columns: 1fr;
  }

  .ai-bill-confirm-form {
    grid-column: auto;
  }
}
```

- [ ] **Step 5: 运行前端测试和构建**

Run:

```powershell
npm --workspace apps/admin-web test -- src/components/admin/ai-bill-draft-model.test.ts
npm --workspace apps/admin-web run build
```

Expected: PASS。

- [ ] **Step 6: 提交工作台**

```powershell
git add apps/admin-web/src/components/admin/ai-bill-workbench.tsx apps/admin-web/src/app/trips/ai-billing/[draftId]/page.tsx apps/admin-web/src/lib/api-client.ts apps/admin-web/src/app/globals.css
git commit -m "feat: add ai bill draft workbench"
```

---

### Task 11: 图片上传支持和重试接口

**Files:**
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/ai-billing/workflow.ts`
- Modify: `apps/api/tests/api.test.ts`

- [ ] **Step 1: 写图片和 retry API 测试**

在 `apps/api/tests/api.test.ts` 增加：

```ts
it("creates a mixed ai bill draft from multipart image and text", async () => {
  const mock = await buildTestApp();
  const boundary = "----ai-bill-boundary";
  const image = await sharp({
    create: { width: 8, height: 8, channels: 3, background: "#ffffff" },
  }).jpeg().toBuffer();
  const payload = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="textNote"\r\n\r\n宏达建材\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="bill.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
    image,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const response = await mock.app.inject({
    method: "POST",
    url: "/admin/ai-bill-drafts",
    headers: {
      ...accountantHeaders,
      "content-type": `multipart/form-data; boundary=${boundary}`,
    },
    payload,
  });

  expect(response.statusCode).toBe(200);
  expect(mock.state.aiBillDrafts[0].inputMode).toBe("mixed");
});
```

- [ ] **Step 2: 扩展 create draft 路由处理 multipart**

在 `/admin/ai-bill-drafts` 路由中使用 Fastify multipart：

```ts
const files: Array<{ storageKey: string; url: string }> = [];
let textNote = "";

if (request.isMultipart()) {
  for await (const part of request.parts()) {
    if (part.type === "field" && part.fieldname === "textNote") textNote = String(part.value || "").trim();
    if (part.type === "file" && part.fieldname === "files") {
      const buffer = await part.toBuffer();
      const compressed = await compressImageForStorage(buffer, part.mimetype);
      const filename = `${randomUUID()}${extensionFromMimeType(compressed.mimeType)}`;
      const storageKey = `ai-bill-drafts/${filename}`;
      await mkdir(join(uploadRoot, "ai-bill-drafts"), { recursive: true });
      await writeFile(join(uploadRoot, storageKey), compressed.buffer);
      files.push({ storageKey, url: `/files/${filename}` });
    }
  }
} else {
  const body = z.object({ textNote: z.string().optional() }).parse(request.body ?? {});
  textNote = body.textNote?.trim() ?? "";
}
```

保存草稿时：

```ts
const inputMode = files.length > 0 && textNote ? "mixed" : files.length > 0 ? "images" : "text";
if (files.length === 0 && !textNote) return reply.code(400).send({ message: "请上传图片或输入账单文字。" });
```

- [ ] **Step 3: 实现 retry 路由**

新增：

```ts
app.post("/admin/ai-bill-drafts/:draftId/retry", async (request, reply) => {
  const user = getCurrentUser(request);
  requireRole(user, "accountant");
  const { draftId } = z.object({ draftId: z.string() }).parse(request.params);
  const teamId = scopedTeamId(user);
  if (!teamId) return reply.code(403).send({ message: "Team scope missing" });
  const workflow = new AiBillWorkflow({ prisma: prisma as PrismaClient, agent: options.aiBillAgent ?? createDefaultAiBillAgent() });
  const draft = await workflow.retryDraft({ draftId, teamId, userId: user.id });
  return { draft: serializeAiBillDraft(draft) };
});
```

- [ ] **Step 4: 运行图片和 retry 测试**

Run:

```powershell
npm --workspace apps/api test -- tests/api.test.ts -t "ai bill draft"
```

Expected: PASS。

- [ ] **Step 5: 提交图片和 retry 支持**

```powershell
git add apps/api/src/app.ts apps/api/src/ai-billing/workflow.ts apps/api/tests/api.test.ts
git commit -m "feat: support ai bill images and retry"
```

---

### Task 12: 全量验证和中文文档补充

**Files:**
- Modify: `docs/superpowers/specs/2026-06-22-ai-bill-draft-agent-design.md`
- Modify: `README.md` if environment variables are documented there during implementation.

- [ ] **Step 1: 运行 API 测试**

Run:

```powershell
npm --workspace apps/api test
```

Expected: PASS。

- [ ] **Step 2: 运行 API 类型检查**

Run:

```powershell
npm --workspace apps/api run lint
```

Expected: PASS。

- [ ] **Step 3: 运行后台 Web 测试**

Run:

```powershell
npm --workspace apps/admin-web test
```

Expected: PASS。

- [ ] **Step 4: 运行后台 Web 构建**

Run:

```powershell
npm --workspace apps/admin-web run build
```

Expected: PASS。

- [ ] **Step 5: 运行全仓测试**

Run:

```powershell
npm test
npm run lint
```

Expected: PASS。

- [ ] **Step 6: 手工本地冒烟**

Run API:

```powershell
$env:DATABASE_URL='file:E:/code/HaulHub/apps/api/prisma/dev.db'
$env:OPENAI_API_KEY='<your-key>'
npm run dev:api
```

Run Admin Web:

```powershell
npm run dev:admin
```

Smoke:

```text
1. 打开 http://localhost:3000/trips/ai-billing/new。
2. 粘贴一段纯文字账单并提交。
3. 检查进入 /trips/ai-billing/[draftId]。
4. 通过对话补充卸货地或司机。
5. 编辑右侧表单。
6. 点击确认补录。
7. 检查跳转到 /trips/[tripId]。
8. 检查利润报表包含新账单。
```

- [ ] **Step 7: 提交最终验证文档更新**

```powershell
git add docs/superpowers/specs/2026-06-22-ai-bill-draft-agent-design.md README.md
git commit -m "docs: document ai bill draft rollout"
```
