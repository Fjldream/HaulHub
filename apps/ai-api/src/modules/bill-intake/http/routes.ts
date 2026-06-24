import type { FastifyInstance } from "fastify";
import type { BillIntakeWorkflow } from "../agent/workflow";
import { billIntakeInputSchema } from "../domain/schemas";

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
