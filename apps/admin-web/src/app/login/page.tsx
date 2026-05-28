import { LogIn } from "lucide-react";
import { redirect } from "next/navigation";
import { setAdminSession, type AdminRole } from "@/lib/admin-session";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

async function loginAction(formData: FormData) {
  "use server";

  const phone = String(formData.get("phone") ?? "");
  const password = String(formData.get("password") ?? "");
  const response = await fetch(`${apiBaseUrl}/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ phone, password }),
    cache: "no-store",
  });

  if (!response.ok) {
    redirect("/login?error=1");
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
    redirect("/login?error=role");
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
  const errorText =
    params.error === "role"
      ? "该账号不是后台成员，请使用管理员账号。"
      : params.error
        ? "手机号或密码错误。"
        : "";

  return (
    <main className="login-page">
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
          {errorText ? <div className="form-error">{errorText}</div> : null}
          <button className="primary-button" type="submit">
            <LogIn size={16} />
            登录后台
          </button>
        </form>
      </section>
    </main>
  );
}
