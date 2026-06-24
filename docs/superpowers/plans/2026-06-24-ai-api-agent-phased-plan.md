# AI Bill Agent 独立服务分阶段实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建成一个独立的 `apps/ai-api` 服务，专门负责账单图片/文字理解、Agent 工具调用、追问缺失信息、生成待会计确认的补录草稿。

**Architecture:** `apps/ai-api` 只做 AI 分析和草稿生成，不直接入账；`apps/api` 继续负责正式账单、权限、车辆司机费用校验和最终入库。Agent 使用 OpenAI Responses API 原生工具调用，Provider 接口提前留好，后续可替换 DeepSeek、腾讯云 OCR 或其它国内模型。

**Tech Stack:** TypeScript, Fastify, Zod, Vitest, OpenAI Node SDK, HaulHub internal API client.

---

## 总体阶段

### Phase 0: 重新整理边界和工作区

**目标:** 确认主工作区状态，只把 AI 服务代码放在 `apps/ai-api`，不再把 Agent 代码塞进 `apps/api`。

**你要理解:**
- 为什么 AI 服务独立出来。
- 为什么 AI 服务不能直接创建正式账单。
- `apps/ai-api` 和 `apps/api` 怎么通信。

**验收:**
- `apps/ai-api` 有独立 package。
- 根目录可以通过 `npm --workspace apps/ai-api ...` 单独测试。
- 未提交的日志、数据库备份不进入功能提交。

---

### Phase 1: Agent 领域模型

**目标:** 定义 AI 草稿的结构，让模型输出、前端表单、后端校验都围绕同一份 schema。

**Files:**
- Create: `apps/ai-api/src/bill-intake/types.ts`
- Create: `apps/ai-api/src/bill-intake/agent.ts`
- Test: `apps/ai-api/src/bill-intake/types.test.ts`

**实现内容:**
- `FieldGuess`: 字段值、置信度、证据、是否需要确认。
- `AiBillDraftPayload`: 车辆、司机、客户、装货地、卸货地、运费、结算日期、费用。
- `ReviewQuestion`: Agent 要问会计的问题。
- `BillIntakeInput`: 图片、文字、对话历史、当前草稿。
- `BillIntakeResult`: 模型结果、草稿、问题、提示、回复。

**验收命令:**

```powershell
npm --workspace apps/ai-api test -- src/bill-intake/types.test.ts
npm --workspace apps/ai-api run lint
```

**提交:**

```powershell
git add apps/ai-api/src/bill-intake/types.ts apps/ai-api/src/bill-intake/agent.ts apps/ai-api/src/bill-intake/types.test.ts
git commit -m "feat(ai-api): add bill intake agent types"
```

---

### Phase 2: 确定性工具层

**目标:** 把不应该交给模型自由发挥的逻辑写成工具函数。

**Files:**
- Create: `apps/ai-api/src/bill-intake/tools.ts`
- Test: `apps/ai-api/src/bill-intake/tools.test.ts`

**实现内容:**
- `match_vehicle`: 匹配车牌。
- `match_driver`: 匹配司机，并考虑车辆绑定关系。
- `match_expense_type`: 匹配费用类型，匹配不到时归到“其他”，备注保留原始费用名。
- `calculate_expense_summary`: 计算费用明细合计，发现总费用冲突。
- `validate_draft_for_review`: 生成必须让会计确认的问题。

**你要理解:**
- Agent 不是所有事都“让模型想”。
- 确定性规则越多，系统越稳定、越便宜、越容易验收。

**验收命令:**

```powershell
npm --workspace apps/ai-api test -- src/bill-intake/tools.test.ts
npm --workspace apps/ai-api run lint
```

**提交:**

```powershell
git add apps/ai-api/src/bill-intake/tools.ts apps/ai-api/src/bill-intake/tools.test.ts
git commit -m "feat(ai-api): add bill intake tools"
```

---

### Phase 3: HaulHub 业务上下文工具

**目标:** AI 服务通过业务 API 获取车辆、司机、绑定关系和费用类型，而不是直接读业务数据库。

**Files:**
- Create: `apps/ai-api/src/haulhub-api-client.ts`
- Create: `apps/ai-api/src/bill-intake/tool-registry.ts`
- Test: `apps/ai-api/src/bill-intake/tool-registry.test.ts`
- Modify later: `apps/api/src/app.ts`

**实现内容:**
- `HaulHubApiClient.getTeamBillingContext()`
- Agent tool: `get_team_billing_context`
- Tool registry: 把 `get_team_billing_context`、`match_vehicle`、`match_driver`、`match_expense_type`、`calculate_expense_summary`、`validate_draft_for_review` 注册成模型可调用工具。
- `apps/api` 后续增加 internal endpoint，供 `ai-api` 查询团队上下文。

**你要理解:**
- Agent 工具调用的本质是“模型决定何时调用，我们决定工具能做什么”。
- AI 服务和业务服务之间要用明确 API 边界，不共享数据库连接。

**验收命令:**

```powershell
npm --workspace apps/ai-api test -- src/bill-intake/tool-registry.test.ts
npm --workspace apps/ai-api run lint
```

---

### Phase 4: OpenAI Provider

**目标:** 用 OpenAI Responses API 实现原生工具调用和结构化输出。

**Files:**
- Create: `apps/ai-api/src/bill-intake/openai-provider.ts`
- Test: `apps/ai-api/src/bill-intake/openai-provider.test.ts`

**实现内容:**
- 把文字、图片 URL、对话历史、当前草稿传给模型。
- 使用 Responses API `tools` 实现工具调用。
- 使用 structured output schema 约束最终 JSON。
- 支持多轮 function_call -> function_call_output 循环。

**你要理解:**
- Provider 是“模型供应商适配层”。
- 以后 DeepSeek Provider 应该实现同一个 `AgentProvider` 接口。

**验收命令:**

```powershell
npm --workspace apps/ai-api test -- src/bill-intake/openai-provider.test.ts
npm --workspace apps/ai-api run lint
```

---

### Phase 5: BillIntakeWorkflow

**目标:** 把 Provider、工具、二次校验组合成真正的 Agent 工作流。

**Files:**
- Create: `apps/ai-api/src/bill-intake/workflow.ts`
- Test: `apps/ai-api/src/bill-intake/workflow.test.ts`

**实现内容:**
- `analyze(input)`
- 创建工具列表。
- 调用 Provider。
- 对模型输出再执行 `validate_draft_for_review`。
- 返回草稿、问题、警告、Agent 回复。

**你要理解:**
- Workflow 是 Agent 的“业务编排层”。
- Provider 不应该知道 HaulHub 的业务校验细节。

**验收命令:**

```powershell
npm --workspace apps/ai-api test -- src/bill-intake/workflow.test.ts
npm --workspace apps/ai-api run lint
```

---

### Phase 6: AI API HTTP 接口

**目标:** 提供独立 HTTP 服务，前端或业务 API 可以调用它生成草稿。

**Files:**
- Create: `apps/ai-api/src/app.ts`
- Create: `apps/ai-api/src/server.ts`
- Test: `apps/ai-api/src/app.test.ts`
- Modify: `package.json`

**接口:**

```text
GET  /health
POST /bill-intake/analyze
```

**验收命令:**

```powershell
npm --workspace apps/ai-api test -- src/app.test.ts
npm --workspace apps/ai-api run lint
```

---

### Phase 7: 业务 API 草稿保存和确认入账

**目标:** `apps/api` 负责保存 AI 草稿、会计确认、最终创建正式账单。

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/0011_ai_bill_drafts/migration.sql`
- Create: `apps/api/src/manual-completed-billing.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/tests/api.test.ts`

**实现内容:**
- `AiBillDraft` 表。
- 手工补录服务抽取。
- `POST /admin/ai-bill-drafts`
- `GET /admin/ai-bill-drafts/:draftId`
- `POST /admin/ai-bill-drafts/:draftId/confirm`
- 确认入账时复用手工补录后端校验。

**你要理解:**
- AI 服务给“建议草稿”。
- 业务 API 做“正式账单”。

---

### Phase 8: 对话追问

**目标:** 会计可以回复 Agent 问题，Agent 根据新信息更新草稿。

**接口:**

```text
POST /admin/ai-bill-drafts/:draftId/messages
```

**流程:**
- 保存会计消息。
- 把当前草稿和消息历史传给 `apps/ai-api`。
- 重新生成草稿和问题清单。
- 保存新版草稿。

---

### Phase 9: 管理端工作台

**目标:** 做你要的“左边图片/右边表单 + 顶部 Agent 提问提示”工作台布局。

**页面:**
- `apps/admin-web/src/app/trips/ai-billing/new/page.tsx`
- `apps/admin-web/src/app/trips/ai-billing/[draftId]/page.tsx`

**组件:**
- 上传入口。
- 原始材料预览。
- Agent 问题区。
- 可编辑补录表单。
- 确认提交按钮。

---

### Phase 10: 接真实图片上传和本地试跑

**目标:** 本地能从图片或文字生成草稿，人工确认后创建正式账单。

**本地环境变量:**

```env
AI_API_PORT=4100
AI_BILL_MODEL=gpt-5.5
OPENAI_API_KEY=你的 key
HAULHUB_API_BASE_URL=http://localhost:4000
HAULHUB_SERVICE_TOKEN=本地服务 token
```

**验收:**
- 输入一段文字可以生成草稿。
- 输入图片 URL 可以生成草稿。
- 缺失信息会生成问题。
- 会计补全后可以确认入账。
- 后端仍然校验车辆、司机、费用、日期和金额。

---

## 当前执行策略

每个 Phase 都按这个节奏：

1. 我先讲这一阶段的概念。
2. 我写失败测试。
3. 跑测试，看它为什么失败。
4. 写最小实现。
5. 跑测试和类型检查。
6. 你确认理解后，我提交这一阶段。

这样你不会只拿到一堆代码，而是能跟着理解 Agent 是怎么从“模型调用”变成“可控业务系统”的。
