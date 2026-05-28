import { redirect } from "next/navigation";
import { clearAdminSession } from "@/lib/admin-session";

export async function POST() {
  await clearAdminSession();
  redirect("/login");
}
