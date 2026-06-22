# AI 补录账单 Agent 设计

## 背景

HaulHub 已经支持后台手工补录完成账单，核心入口是现有的 `POST /admin/trips/manual-completed`。但会计在实际使用时，仍然需要从手写纸条、微信聊天、收据、发票和混合材料里读信息，再手动复制到补录表单。

这个功能新增一个后台 Web 的 AI 补录工作台。它帮助会计把图片或自由文本转换成一份可确认的补录草稿。AI Agent 可以继续追问缺失信息，并根据会计回复更新草稿；但最终创建完成账单前，必须由会计确认。

## 目标

- 在后台 Web 增加 AI 补录账单入口。
- 支持图片输入、文字输入、图片加文字混合输入。
- 第一版使用工具调用式 Agent，通过 OpenAI 原生 Responses API 实现。
- 保持供应商接口可替换，后续可以把 OpenAI 替换成国内 OCR 加 DeepSeek 或其他国内模型。
- 将 AI 草稿保存到数据库，支持刷新恢复、失败重试、审计回看和后续准确率分析。
- 提供工作台式界面，在同一屏里展示原始材料、可编辑表单和 Agent 问题。
- 必须由会计确认后，系统才创建完成账单。
- 最终业务校验仍放在后端，复用现有手工补录规则。

## 非目标

- 第一版不允许 Agent 在没有会计确认的情况下直接入账。
- 不自动创建缺失的费用类型。识别不到的费用类型归到现有“其他”费用类型，并在备注中保留原始费用名称。
- 第一版不做多账单自动拆分。一次提交只生成一张账单草稿。
- 第一版不引入 LangChain、LangGraph、Temporal 或其他工作流框架。
- 第一版不实现国内 OCR 或 DeepSeek Provider，但接口边界要提前留好。
- 不重写现有手工补录账单的业务规则。

## 产品流程

1. 会计从趟次/账单区域进入 AI 补录页面。
2. 会计上传一张或多张图片，输入一段文字，或两者都提供。
3. API 创建 `AiBillDraft`，状态为 `processing`。
4. `BillIntakeAgent` 基于提交材料和工具权限运行。
5. Agent 抽取字段、调用匹配工具、计算冲突，并保存待确认草稿。
6. Web 工作台打开，展示：
   - 左侧原始材料；
   - 顶部或侧边的 Agent 问题和风险提示；
   - 右侧可编辑的补录表单。
7. 会计可以通过对话回答 Agent 问题，也可以直接修改表单字段。
8. 每次会计回复后，Agent 基于当前草稿重新运行，更新表单和问题清单。
9. 必填信息完整后，会计点击确认补录。
10. 后端校验确认后的 payload，并通过现有手工补录逻辑创建完成账单。

输入优先级：

```text
会计输入文字 > 图片识别结果 > 模型推断
```

例如会计在文字里写了“司机是王建国”，即使图片里手写识别不确定，也应优先采用会计输入的文字信息。

## 架构

```text
Web 后台
  /trips/ai-billing/new
  /trips/ai-billing/[draftId]

API
  AiBillWorkflow
    createDraft()
    appendMessage()
    confirmDraft()

  BillIntakeAgent
    AgentProvider
      OpenAiResponsesAgentProvider
      FutureDeepSeekAgentProvider
    AgentToolRegistry
      get_team_billing_context
      match_vehicle
      match_driver
      match_expense_type
      calculate_expense_summary
      validate_draft_for_review
      save_ai_bill_draft

现有业务逻辑
  手工补录账单服务 / POST /admin/trips/manual-completed
```

第一版使用 OpenAI 原生工具调用，不使用 LangChain。工具定义、参数 schema、工具结果校验和工作流状态都由 HaulHub 自己掌控。

## Agent 设计

### Agent 职责边界

Agent 可以做：

- 读取图片和文字材料。
- 抽取账单字段。
- 调用后端工具查看团队上下文并匹配候选项。
- 向会计追问缺失或冲突的信息。
- 根据会计回复更新草稿。
- 保存待确认草稿。

Agent 不能做：

- 创建完成账单。
- 绕过团队权限。
- 创建费用类型。
- 绕过后端业务校验。

### 工具

#### `get_team_billing_context`

返回当前团队范围内的上下文：

- 可用车辆；
- 在职司机；
- 车辆和司机绑定关系；
- 已启用费用类型；
- 配置好的“其他”费用类型。

#### `match_vehicle`

输入：

- 车牌猜测；
- 车辆描述；
- 可选证据说明。

输出：

- 候选车辆；
- 最佳匹配；
- 匹配置信度；
- 是否唯一匹配。

#### `match_driver`

输入：

- 司机姓名或手机号猜测；
- 可选的车辆 ID。

输出：

- 候选司机；
- 最佳匹配；
- 匹配置信度；
- 司机是否绑定到所选车辆。

#### `match_expense_type`

输入：

- 原始费用名称。

输出：

- 能匹配时返回系统费用类型；
- 不能匹配时返回“其他”费用类型；
- 备注建议，例如 `原始费用名：压车费`。

#### `calculate_expense_summary`

输入：

- 识别到的费用明细；
- 识别到的总费用，如果存在。

输出：

- 明细合计；
- 总费用；
- 明细合计和总费用不一致时的冲突提示；
- 建议费用模式：`details`、`total` 或 `needs_review`。

#### `validate_draft_for_review`

输入：

- 当前 AI 草稿。

输出：

- 必须会计回答的问题；
- 风险提示；
- 草稿是否可进入会计确认；
- 会阻止最终提交的字段。

这个校验允许草稿不完整，因为缺失字段可以由会计后续补充。

#### `save_ai_bill_draft`

输入：

- 归一化后的草稿 payload；
- 问题清单；
- 风险提示；
- Provider 元数据。

输出：

- 草稿 ID；
- 草稿状态。

这个工具只保存待确认草稿，不提交账务记录。

## 对话设计

工作台包含 Agent 问题区。Agent 只针对缺失、冲突或低置信信息发问，不做泛聊天。

示例：

```text
缺少必填字段：
“没有识别到卸货地，请补充卸货地。”

司机不明确：
“材料里提到了老王，系统中找到王建国和王明两个候选司机，请选择正确司机。”

费用冲突：
“费用明细合计 860.00，但还识别到一个总费用 900.00。请选择使用明细还是总费用。”
```

会计可以用自然语言回答：

```text
卸货地是厦门同安，司机选王建国。
```

Agent 收到回复后，更新草稿，重新执行匹配和 review 校验，并刷新问题清单。会计也可以绕过对话，直接编辑右侧表单。

## 数据模型

新增 `AiBillDraft`。

```text
id
teamId
createdBy
status              processing | needs_review | submitted | failed
inputMode           images | text | mixed
imageStorageKeys    JSON array
textNote            nullable text
provider            openai
providerRequestId   nullable string
rawAgentResult      JSON text
draftPayload        JSON text
reviewQuestions     JSON text
warnings            JSON text
messages            JSON text
confirmedPayload    nullable JSON text
submittedTripId     nullable string
errorMessage        nullable text
createdAt
updatedAt
submittedAt         nullable datetime
```

`messages` 保存会计和 Agent 的对话轮次。后续如果对话历史变长，可以再拆成独立表。

### 草稿 Payload 结构

```ts
type Confidence = "high" | "medium" | "low";

type FieldGuess = {
  value: string | null;
  confidence: Confidence;
  evidence?: string;
  needsReview: boolean;
};

type AiBillDraftPayload = {
  vehicle: FieldGuess & {
    matchedVehicleId?: string;
    candidates?: VehicleCandidate[];
  };
  driver: FieldGuess & {
    matchedDriverId?: string;
    candidates?: DriverCandidate[];
  };
  customerName: FieldGuess;
  loadLocation: FieldGuess;
  unloadLocation: FieldGuess;
  actualFreight: FieldGuess;
  settledAt: FieldGuess;
  expenseModeSuggestion: "details" | "total" | "needs_review";
  expenses: ExpenseGuess[];
  totalExpense?: FieldGuess;
  accountingNote?: FieldGuess;
};

type ExpenseGuess = {
  originalName: string;
  matchedExpenseTypeId?: string;
  matchedExpenseTypeName?: string;
  amount: FieldGuess;
  occurredAt?: FieldGuess;
  note?: string;
  needsReview: boolean;
};
```

## API 设计

### 创建草稿

```text
POST /admin/ai-bill-drafts
```

`multipart/form-data`：

```text
files[]?: image files
textNote?: string
```

至少需要一张图片或一段非空文字。

返回：

```json
{
  "draft": {
    "id": "draft-id",
    "status": "needs_review"
  }
}
```

如果 Agent 在创建记录后运行失败，返回 `status = failed` 的草稿和错误信息。

### 读取草稿

```text
GET /admin/ai-bill-drafts/:draftId
```

返回：

- 草稿状态；
- 图片 URL；
- 输入文字；
- 草稿 payload；
- 问题清单；
- 风险提示；
- 对话消息。

### 追加对话消息

```text
POST /admin/ai-bill-drafts/:draftId/messages
```

输入：

```json
{
  "message": "卸货地是厦门同安，司机选王建国。"
}
```

行为：

1. 校验草稿属于当前团队。
2. 追加会计消息。
3. 让 Agent 基于当前草稿、原始材料、团队上下文和新消息重新运行。
4. 保存更新后的草稿 payload、问题、风险提示和 Agent 回复。
5. 返回更新后的草稿。

### 确认草稿

```text
POST /admin/ai-bill-drafts/:draftId/confirm
```

输入和现有手工补录 payload 对齐：

```json
{
  "vehicleId": "...",
  "driverId": "...",
  "customerName": "...",
  "loadLocation": "...",
  "unloadLocation": "...",
  "actualFreight": "1800.00",
  "settledAt": "2026-06-22",
  "accountingNote": "...",
  "expenses": [
    {
      "expenseTypeId": "...",
      "amount": "120.00",
      "occurredAt": "2026-06-22",
      "note": "原始费用名：压车费"
    }
  ]
}
```

行为：

1. 校验团队范围和草稿状态。
2. 保存 `confirmedPayload`。
3. 执行现有手工补录后端校验。
4. 创建完成账单。
5. 更新草稿为 `status = submitted`，写入 `submittedTripId` 和 `submittedAt`。
6. 返回新账单和草稿。

### 重试草稿

```text
POST /admin/ai-bill-drafts/:draftId/retry
```

使用同一份原始材料重新运行 Agent。这个接口用于 Provider 失败、提示词调整或早期调试。

## Web 工作台

### 路由

```text
/trips/ai-billing/new
/trips/ai-billing/[draftId]
```

### 上传页

控件：

- 图片上传；
- 自由文本输入框；
- 提交按钮。

规则：

- 一次提交代表一张账单；
- 支持仅图片、仅文字、图片加文字；
- 至少需要一种输入来源。

### 草稿工作台

布局：

```text
顶部或右侧：Agent 问题和对话
左侧：原始材料查看区
右侧：补录账单表单
```

原始材料查看区：

- 图片缩略图；
- 大图预览；
- 文字材料展示；
- 视情况支持图片缩放和旋转。

表单字段：

- 车辆；
- 司机；
- 客户名称；
- 装货地；
- 卸货地；
- 实际运费；
- 完成/结算日期；
- 费用模式；
- 费用明细或总费用；
- 会计备注。

字段状态：

- 高置信字段正常填入；
- 中/低置信字段显示“需确认”标记；
- 缺失必填字段高亮；
- 刚由会计回复更新的字段可以短暂标记为“已更新”。

确认按钮在前端必填校验通过前保持禁用。API 仍然做最终校验。

## 校验与安全

系统有三层校验。

### Review 校验

`validate_draft_for_review` 可以返回不完整草稿。它的职责是生成问题清单和风险提示。

### 确认 Payload 校验

最终提交前，Web 表单和 API 都要求：

- 已选择车辆；
- 已选择司机；
- 已填写客户名称；
- 已填写装货地；
- 已填写卸货地；
- 已填写实际运费；
- 已填写完成/结算日期；
- 费用模式只能选择一种；
- 当前费用模式下的费用字段有效。

### 现有业务校验

最终提交复用现有后端规则：

- 团队范围；
- accountant 角色；
- 车辆可用；
- 司机在职；
- 司机绑定所选车辆；
- 金额格式；
- 费用类型启用状态；
- 明细费用和总费用互斥；
- 创建结算快照；
- 创建审计日志。

## Provider 策略

第一版：

```text
OpenAiResponsesAgentProvider
```

职责：

- 将图片和文字输入发送给 OpenAI；
- 通过原生 tool calling 暴露 HaulHub 工具；
- 循环处理模型工具调用和工具结果；
- 产出最终归一化草稿。

后续国内 Provider 路线：

```text
DomesticBillAgentProvider
  BaiduOcrProvider | TencentOcrProvider | AliyunOcrProvider
  DeepSeekBillExtractorProvider
```

后续 Provider 必须输出同一份 `AiBillDraftPayload`、问题清单和风险提示。Web 和确认入账逻辑不应变化。

## 测试策略

### 单元测试

- 费用类型匹配：未知费用名归到“其他”，并在备注里保留原始名称。
- 司机匹配：尊重所选车辆绑定关系。
- 车辆匹配：覆盖精确车牌和歧义车牌。
- 费用汇总：检测明细合计和总费用冲突。
- Review 校验：缺失字段会生成问题。
- 确认 payload 构建：只序列化当前启用的费用模式。

### API 测试

- 创建草稿时必须提供图片或文字。
- 可以创建纯文字草稿。
- 可以创建图片加文字混合草稿。
- 草稿读取受团队范围限制。
- 追加消息会更新对话和草稿 payload。
- 确认草稿会调用手工补录校验。
- Provider 失败时保存 `failed` 状态和错误信息。

### 手工冒烟测试

1. 上传手写图片，确认系统会追问缺失字段。
2. 粘贴纯文字账单，确认能生成草稿。
3. 使用图片加文字输入，确认文字优先于不确定的图片识别结果。
4. 通过对话补充一个缺失字段。
5. 直接编辑表单并提交。
6. 确认生成的账单进入利润报表。
7. 重试失败草稿。

## 上线说明

- API 环境变量增加 `OPENAI_API_KEY` 和模型配置。
- 失败草稿要保留请求和响应 JSON，方便调试提示词和工具问题。
- 第一版设置保守的图片数量和大小限制。
- 在积累足够真实准确率数据前，不启用自动提交。
- 保留所有现有手工补录入口。
