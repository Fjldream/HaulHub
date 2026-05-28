import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getAdminSession } from "@/lib/admin-session";
import { AdminShellClient } from "./admin-shell-client";

export async function AdminShell({ children }: { children: ReactNode }) {
  const session = await getAdminSession();
  if (!session) {
    redirect("/login");
  }
  if (session.role === "administrator" && !session.activeTeamId) {
    redirect("/teams/select");
  }

  return <AdminShellClient session={session}>{children}</AdminShellClient>;
}
