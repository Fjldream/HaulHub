import type { FastifyRequest } from "fastify";

export type AuthRole = "driver" | "accountant";

export interface CurrentUser {
  id: string;
  role: AuthRole;
}

export function getCurrentUser(request: FastifyRequest): CurrentUser {
  const userId = request.headers["x-user-id"];
  const role = request.headers["x-user-role"];

  if (typeof userId !== "string" || (role !== "driver" && role !== "accountant")) {
    throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
  }

  return { id: userId, role };
}

export function requireRole(user: CurrentUser, role: AuthRole): void {
  if (user.role !== role) {
    throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  }
}
