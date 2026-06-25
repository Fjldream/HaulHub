import type { FastifyInstance } from "fastify";
import type { BillIntakeWorkflow } from "../agent/workflow";
import { billIntakeInputSchema } from "../domain/schemas";

/**
 * 注册账单识别相关 HTTP 路由。
 *
 * HTTP 层只负责请求校验和响应包装，实际 Agent 编排交给 `BillIntakeWorkflow`。
 */
export function registerBillIntakeRoutes(app: FastifyInstance, workflow: BillIntakeWorkflow) {
  app.post("/bill-intake/analyze", async (request, reply) => {
    const parsed = billIntakeInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        message: parsed.error.issues[0]?.message ?? "账单分析请求无效。",
      });
    }

    return { result: await workflow.analyze(parsed.data) };
  });
}
