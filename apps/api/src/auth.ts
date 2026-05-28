import type { FastifyRequest } from "fastify";

export type AuthRole = "driver" | "accountant" | "administrator";

export interface CurrentUser {
  id: string;
  role: AuthRole;
  teamId: string | null;
}

export function getCurrentUser(request: FastifyRequest): CurrentUser {
  const userId = request.headers["x-user-id"];
  const role = request.headers["x-user-role"];
  const teamId = request.headers["x-team-id"];

  if (
    typeof userId !== "string" ||
    (role !== "driver" && role !== "accountant" && role !== "administrator")
  ) {
    throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
  }

  return {
    id: userId,
    role,
    teamId:
      typeof teamId === "string" && teamId
        ? teamId
        : role === "administrator"
          ? null
          : "team-default",
  };
}

export function requireRole(user: CurrentUser, role: AuthRole): void {
  if (user.role === "administrator" && role === "accountant") {
    return;
  }

  if (user.role !== role) {
    throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  }
}
