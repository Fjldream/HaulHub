import type { AgentProvider, AgentTool } from "./agent-provider";
import type { AiBillDraftPayload, BillIntakeInput, Confidence, ReviewQuestion, ToolTraceItem } from "../domain/types";
import type { DriverContext, ExpenseTypeContext, TeamBillingContext, VehicleContext } from "../tools/context";

type VehicleMatchResult = {
  candidates: Array<{ id: string; plateNumber: string }>;
  bestMatchId?: string;
  confidence: Confidence;
  unique: boolean;
};

type DriverMatchResult = {
  candidates: Array<{ id: string; name: string; phone?: string }>;
  bestMatchId?: string;
  confidence: Confidence;
  unique: boolean;
};

type ExpenseTypeMatchResult = {
  expenseTypeId: string;
  expenseTypeName: string;
  confidence: Confidence;
  note?: string;
  needsReview: boolean;
};

/**
 * 查找指定名称的 Agent 工具。
 *
 * @param tools 当前 workflow 注入的工具列表。
 * @param name 需要查找的工具名称。
 * @returns 匹配到的工具。
 */
function findTool(tools: AgentTool[], name: string): AgentTool {
  const tool = tools.find((item) => item.name === name);
  if (!tool) {
    throw new Error(`Mock provider requires tool: ${name}`);
  }
  return tool;
}

/**
 * 生成 AI 字段猜测结构。
 *
 * @param value 字段值。
 * @param confidence 字段置信度。
 * @returns 可写入草稿的字段结果。
 */
function fieldGuess(value: string | null, confidence: Confidence = value ? "high" : "low") {
  return {
    value,
    confidence,
    needsReview: confidence !== "high" || !value,
  };
}

/**
 * 从本地输入中取出可用于 mock 解析的文本。
 *
 * @param input AI 账单识别输入。
 * @returns 合并后的文本上下文。
 */
function materialText(input: BillIntakeInput): string {
  return [input.textNote, ...input.messages.map((message) => message.content)].filter(Boolean).join("\n");
}

/**
 * 转义正则表达式里的特殊字符。
 *
 * @param value 原始文本。
 * @returns 可安全放进正则表达式的文本。
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 从文本中查找最可能的车辆。
 *
 * @param text 会计输入的账单文字。
 * @param vehicles 团队车辆上下文。
 * @returns 文本中出现的车辆；没有命中时返回第一个可用车辆。
 */
function inferVehicle(text: string, vehicles: VehicleContext[]): VehicleContext | undefined {
  return vehicles.find((vehicle) => text.includes(vehicle.plateNumber)) ?? vehicles.find((vehicle) => vehicle.status === "available");
}

/**
 * 从文本中查找最可能的司机。
 *
 * @param text 会计输入的账单文字。
 * @param drivers 团队司机上下文。
 * @returns 文本中出现的司机；没有命中时返回第一个活跃司机。
 */
function inferDriver(text: string, drivers: DriverContext[]): DriverContext | undefined {
  return drivers.find((driver) => text.includes(driver.name)) ?? drivers.find((driver) => driver.status === "active");
}

/**
 * 从文本中提取客户名称。
 *
 * @param text 会计输入的账单文字。
 * @returns 客户名称；无法识别时返回空。
 */
function inferCustomerName(text: string): string {
  return text.match(/客户\s*([\u4e00-\u9fa5A-Za-z0-9_-]{2,20})/)?.[1] ?? "";
}

/**
 * 从文本中提取装货地和卸货地。
 *
 * @param text 会计输入的账单文字。
 * @returns 装货地和卸货地。
 */
function inferRoute(text: string): { loadLocation: string; unloadLocation: string } {
  const route = text.match(/([\u4e00-\u9fa5A-Za-z0-9_-]{2,16})\s*(?:到|至|-|->)\s*([\u4e00-\u9fa5A-Za-z0-9_-]{2,16})/);
  return {
    loadLocation: route?.[1] ?? "",
    unloadLocation: route?.[2] ?? "",
  };
}

/**
 * 从文本中提取日期。
 *
 * @param text 会计输入的账单文字。
 * @returns ISO 日期文本。
 */
function inferDate(text: string): string {
  return text.match(/\b(20\d{2}-\d{1,2}-\d{1,2})\b/)?.[1] ?? "";
}

/**
 * 从文本中提取指定关键词后的金额。
 *
 * @param text 会计输入的账单文字。
 * @param keyword 金额关键词。
 * @returns 金额文本；没有识别到时返回空。
 */
function inferAmountAfter(text: string, keyword: string): string {
  return text.match(new RegExp(`${escapeRegExp(keyword)}\\s*[:：]?\\s*(\\d+(?:\\.\\d{1,2})?)`))?.[1] ?? "";
}

/**
 * 从文本中提取费用明细。
 *
 * @param text 会计输入的账单文字。
 * @param expenseTypes 团队费用类型上下文。
 * @returns 原始费用名和金额列表。
 */
function inferExpenses(text: string, expenseTypes: ExpenseTypeContext[]) {
  const ignoredNames = new Set(["运费", "实际运费"]);
  return expenseTypes
    .filter((type) => type.enabled && !ignoredNames.has(type.name))
    .map((type) => ({ originalName: type.name, amount: inferAmountAfter(text, type.name) }))
    .filter((expense) => expense.amount);
}

/**
 * 执行工具并记录调用轨迹。
 *
 * @param tool 要执行的 Agent 工具。
 * @param value 工具入参。
 * @param context 当前账单识别输入。
 * @param trace 工具调用轨迹列表。
 * @returns 工具返回值。
 */
async function executeTool<T>(
  tool: AgentTool,
  value: unknown,
  context: BillIntakeInput,
  trace: ToolTraceItem[],
): Promise<T> {
  const index = trace.length + 1;
  try {
    const output = (await tool.execute(value, context)) as T;
    trace.push({ index, name: tool.name, callId: `mock-${index}`, status: "success", input: value });
    return output;
  } catch (error) {
    trace.push({
      index,
      name: tool.name,
      callId: `mock-${index}`,
      status: "error",
      input: value,
      error: error instanceof Error ? error.message : "未知错误",
    });
    throw error;
  }
}

/**
 * 本地开发用账单识别 Provider。
 *
 * 这个 Provider 不调用外部大模型，只用于没有 OpenAI Key 时跑通端到端流程。它仍然会调用
 * workflow 注入的确定性工具，因此可以验证团队上下文、匹配工具、草稿校验和确认提交链路。
 */
export class MockBillIntakeAgentProvider implements AgentProvider {
  /**
   * 基于文字材料生成一个本地 mock 草稿。
   *
   * @param input 会计提交的图片/文字材料。
   * @param tools workflow 注入的工具链。
   * @returns AI 账单识别结果。
   */
  async run(input: BillIntakeInput, tools: AgentTool[]) {
    const trace: ToolTraceItem[] = [];
    const text = materialText(input);
    const contextTool = findTool(tools, "get_team_billing_context");
    const vehicleTool = findTool(tools, "match_vehicle");
    const driverTool = findTool(tools, "match_driver");
    const expenseTypeTool = findTool(tools, "match_expense_type");
    const validateTool = findTool(tools, "validate_draft_for_review");
    const context = await executeTool<TeamBillingContext>(contextTool, {}, input, trace);
    const inferredVehicle = inferVehicle(text, context.vehicles);
    const vehicleMatch = await executeTool<VehicleMatchResult>(
      vehicleTool,
      { plateNumber: inferredVehicle?.plateNumber ?? null, vehicles: context.vehicles },
      input,
      trace,
    );
    const inferredDriver = inferDriver(text, context.drivers);
    const driverMatch = await executeTool<DriverMatchResult>(
      driverTool,
      {
        driverName: inferredDriver?.name ?? null,
        phone: inferredDriver?.phone ?? null,
        vehicleId: vehicleMatch.bestMatchId ?? null,
        drivers: context.drivers,
      },
      input,
      trace,
    );
    const { loadLocation, unloadLocation } = inferRoute(text);
    const expenses = [];
    for (const expense of inferExpenses(text, context.expenseTypes)) {
      const match = await executeTool<ExpenseTypeMatchResult>(
        expenseTypeTool,
        { originalName: expense.originalName, expenseTypes: context.expenseTypes },
        input,
        trace,
      );
      expenses.push({
        originalName: expense.originalName,
        matchedExpenseTypeId: match.expenseTypeId || undefined,
        matchedExpenseTypeName: match.expenseTypeName || undefined,
        amount: fieldGuess(expense.amount, match.confidence),
        occurredAt: fieldGuess(inferDate(text)),
        note: match.note || "",
        needsReview: match.needsReview,
      });
    }

    const draftPayload: AiBillDraftPayload = {
      vehicle: {
        ...fieldGuess(inferredVehicle?.plateNumber ?? null, vehicleMatch.confidence),
        matchedVehicleId: vehicleMatch.bestMatchId,
        candidates: vehicleMatch.candidates,
      },
      driver: {
        ...fieldGuess(inferredDriver?.name ?? null, driverMatch.confidence),
        matchedDriverId: driverMatch.bestMatchId,
        candidates: driverMatch.candidates,
      },
      customerName: fieldGuess(inferCustomerName(text)),
      loadLocation: fieldGuess(loadLocation),
      unloadLocation: fieldGuess(unloadLocation),
      actualFreight: fieldGuess(inferAmountAfter(text, "运费")),
      settledAt: fieldGuess(inferDate(text)),
      expenseModeSuggestion: "details",
      expenses,
      accountingNote: fieldGuess("本地 mock provider 生成，仅用于联调。"),
    };
    const review = await executeTool<{ questions: ReviewQuestion[]; warnings: string[] }>(
      validateTool,
      { draft: draftPayload },
      input,
      trace,
    );

    return {
      provider: "mock",
      providerRequestId: `mock-${Date.now()}`,
      rawAgentResult: { text },
      draftPayload,
      reviewQuestions: review.questions,
      warnings: review.warnings,
      reply: review.questions.length > 0 ? "已生成本地草稿，请补全高亮信息。" : "已生成本地草稿，请会计确认后提交。",
      toolTrace: trace,
    };
  }
}
