import { cookies } from "next/headers";

export const adminSessionCookie = "haulhub-admin-session";

export type AdminRole = "accountant" | "administrator";

export interface AdminSession {
  userId: string;
  role: AdminRole;
  name: string;
  teamId: string | null;
  teamName: string | null;
  activeTeamId: string | null;
  activeTeamName: string | null;
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const raw = (await cookies()).get(adminSessionCookie)?.value;
  if (!raw) {
    return null;
  }

  try {
    const session = JSON.parse(raw) as Partial<AdminSession>;
    if (
      typeof session.userId === "string" &&
      typeof session.name === "string" &&
      (typeof session.teamId === "string" || session.teamId === null || session.teamId === undefined) &&
      (typeof session.teamName === "string" || session.teamName === null || session.teamName === undefined) &&
      (typeof session.activeTeamId === "string" || session.activeTeamId === null || session.activeTeamId === undefined) &&
      (typeof session.activeTeamName === "string" || session.activeTeamName === null || session.activeTeamName === undefined) &&
      (session.role === "accountant" || session.role === "administrator")
    ) {
      return {
        ...(session as AdminSession),
        teamId: session.teamId ?? null,
        teamName: session.teamName ?? null,
        activeTeamId: session.activeTeamId ?? session.teamId ?? null,
        activeTeamName: session.activeTeamName ?? session.teamName ?? null,
      };
    }
  } catch {
    return null;
  }

  return null;
}

export async function setAdminSession(session: AdminSession) {
  (await cookies()).set(adminSessionCookie, JSON.stringify(session), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function setActiveTeam(team: { id: string; name: string }) {
  const session = await getAdminSession();
  if (!session) {
    return;
  }
  await setAdminSession({
    ...session,
    activeTeamId: team.id,
    activeTeamName: team.name,
  });
}

export async function clearAdminSession() {
  (await cookies()).delete(adminSessionCookie);
}
