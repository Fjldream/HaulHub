import { LogIn } from "lucide-react";
import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { AdminFeedbackProvider } from "@/components/admin/admin-feedback-provider";
import { ToastMessage } from "@/components/admin/toast-message";
import { setAdminSession, type AdminRole } from "@/lib/admin-session";

const apiBaseUrl =
  process.env.NEXT_INTERNAL_API_BASE_URL ??
  process.env.ADMIN_INTERNAL_API_BASE_URL ??
  "http://localhost:4000";

async function readLoginError(response: Response) {
  try {
    const payload = (await response.json()) as { message?: string; error?: string };
    return payload.message ?? payload.error ?? "手机号或密码错误";
  } catch {
    return "手机号或密码错误";
  }
}

async function loginAction(formData: FormData) {
  "use server";

  const phone = String(formData.get("phone") ?? "");
  const password = String(formData.get("password") ?? "");
  const passwordDigest = createHash("sha256").update(password).digest("hex");
  const response = await fetch(`${apiBaseUrl}/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ phone, passwordDigest }),
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await readLoginError(response);
    redirect(`/login?error=${encodeURIComponent(message)}`);
  }

  const { session } = (await response.json()) as {
    session: {
      userId: string;
      role: string;
      name: string;
      teamId: string | null;
      teamName: string | null;
    };
  };

  if (session.role !== "administrator" && session.role !== "accountant") {
    redirect(`/login?error=${encodeURIComponent("该账号不是后台成员，请使用管理员账号")}`);
  }

  await setAdminSession({
    userId: session.userId,
    role: session.role as AdminRole,
    name: session.name,
    teamId: session.teamId,
    teamName: session.teamName,
    activeTeamId: session.role === "administrator" ? null : session.teamId,
    activeTeamName: session.role === "administrator" ? null : session.teamName,
  });
  if (session.role === "administrator") {
    redirect("/teams/select");
  }
  redirect("/");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const errorText = params.error ?? "";

  return (
    <AdminFeedbackProvider>
      <main className="login-page">
        <ToastMessage text={errorText} />
        <section className="login-panel">
          <div className="login-brand">
            <span>拉货小票</span>
            <strong>管理后台登录</strong>
          </div>
          <form action={loginAction} className="login-form">
            <label>
              手机号
              <input name="phone" inputMode="tel" placeholder="13700000000" required />
            </label>
            <label>
              密码
              <input name="password" type="password" placeholder="请输入密码" required />
            </label>
            <button className="primary-button" type="submit">
              <LogIn size={16} />
              登录后台
            </button>
          </form>
        </section>
      </main>
    </AdminFeedbackProvider>
  );
}
