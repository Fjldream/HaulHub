"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BarChart3,
  Bell,
  Car,
  ClipboardList,
  CircleHelp,
  History,
  LayoutDashboard,
  LogOut,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  Truck,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Fragment, useState, type ReactNode } from "react";
import { AdminFeedbackProvider } from "@/components/admin/admin-feedback-provider";
import { isNavChildActive, isNavItemActive } from "@/components/admin/admin-nav-model";
import { ToastMessage } from "@/components/admin/toast-message";
import type { AdminSession } from "@/lib/admin-session";
import type { AdminNotifications } from "./admin-notifications";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  children?: Array<{
    href: string;
    label: string;
  }>;
};

const navItems: NavItem[] = [
  { href: "/", label: "工作台", icon: LayoutDashboard },
  { href: "/trips", label: "趟次管理", icon: ClipboardList },
  { href: "/vehicles", label: "车辆管理", icon: Truck },
  { href: "/vehicles/maintenance", label: "维修记录", icon: Wrench },
  {
    href: "/drivers",
    label: "司机管理",
    icon: Users,
    children: [
      { href: "/drivers", label: "司机档案" },
      { href: "/drivers/payroll", label: "工资记录" },
      { href: "/drivers/trip-payroll", label: "趟次计薪查询" },
    ],
  },
  { href: "/expense-types", label: "费用类型", icon: ReceiptText },
  {
    href: "/reports",
    label: "利润统计",
    icon: BarChart3,
    children: [
      { href: "/reports", label: "利润总览" },
      { href: "/reports/monthly", label: "月度利润" },
      { href: "/reports/yearly", label: "年度利润" },
      { href: "/reports/payroll", label: "工资成本" },
    ],
  },
  { href: "/audit-logs", label: "操作记录", icon: History },
];

const utilityItems = [
  { href: "/teams", label: "团队管理", icon: Users, adminOnly: true },
  { href: "/members", label: "成员管理", icon: ShieldCheck, adminOnly: true },
  { href: "/settings", label: "系统设置", icon: Settings, adminOnly: false },
];

const sectionTitles = [...navItems.flatMap((item) => [item, ...(item.children ?? [])]), ...utilityItems].map(
  (item) => ({
    href: item.href,
    label: item.label,
  }),
);
sectionTitles.push({ href: "/search", label: "全局搜索" });

const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");

export function AdminShellClient({
  children,
  notifications,
  session,
}: {
  children: ReactNode;
  notifications: AdminNotifications;
  session: AdminSession;
}) {
  return (
    <AdminFeedbackProvider>
      <AdminShellFrame notifications={notifications} session={session}>
        {children}
      </AdminShellFrame>
    </AdminFeedbackProvider>
  );
}

function AdminShellFrame({
  children,
  notifications,
  session,
}: {
  children: ReactNode;
  notifications: AdminNotifications;
  session: AdminSession;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const currentQuery = pathname === "/search" ? (searchParams.get("q") ?? "") : "";
  const actionError = searchParams.get("error");
  const visibleUtilityItems = utilityItems.filter(
    (item) => !item.adminOnly || session.role === "administrator",
  );
  const currentSection =
    sectionTitles
      .filter((item) => (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)))
      .sort((a, b) => b.href.length - a.href.length)[0]?.label ?? "后台";
  const roleLabel = session.role === "administrator" ? "超级管理员" : "管理员后台";
  const logout = async () => {
    await fetch(`${basePath}/login/logout`, { method: "POST" });
    router.replace("/login");
    router.refresh();
  };

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Car size={22} />
          </div>
          <div>
            <strong>拉货小票</strong>
            <span>HaulHub Admin</span>
            <Link className="team-switch-link" href="/teams/select">
              {session.activeTeamName ?? "选择团队"}
            </Link>
          </div>
        </div>
        <nav className="nav-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = isNavItemActive(item.href, pathname);
            return (
              <Fragment key={item.href}>
                <Link
                  aria-current={isActive && !item.children ? "page" : undefined}
                  className={isActive ? "nav-item active" : "nav-item"}
                  href={item.href}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
                {item.children && isActive ? (
                  <div className="nav-sub-list">
                    {item.children.map((child) => {
                      const isChildActive = isNavChildActive(child.href, pathname);
                      return (
                        <Link
                          aria-current={isChildActive ? "page" : undefined}
                          className={isChildActive ? "nav-sub-item active" : "nav-sub-item"}
                          href={child.href}
                          key={child.href}
                        >
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </Fragment>
            );
          })}
        </nav>
        <nav className="nav-list utility-nav">
          {visibleUtilityItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={isActive ? "nav-item active" : "nav-item"}
                href={item.href}
                key={item.href}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
          <button className="nav-item danger-nav" type="button" onClick={logout}>
            <LogOut size={18} />
            退出登录
          </button>
        </nav>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="topbar-title">
            <span className="topbar-kicker">
              HaulHub · {roleLabel} · {session.activeTeamName ?? "未选择团队"}
            </span>
            <strong>{currentSection}</strong>
          </div>
          <div className="topbar-actions">
            <form action="/search" className="topbar-search">
              <Search size={18} />
              <input name="q" placeholder="搜索趟次、车牌、司机、费用类型" defaultValue={currentQuery} />
            </form>
            <div className="notification-menu">
              <button
                className={notifications.total > 0 ? "icon-button has-dot" : "icon-button"}
                type="button"
                aria-expanded={notificationsOpen}
                aria-label={`通知${notifications.total > 0 ? `，${notifications.total} 条待处理` : ""}`}
                onClick={() => setNotificationsOpen((open) => !open)}
              >
                <Bell size={18} />
                {notifications.total > 0 ? <span className="notification-count">{notifications.total}</span> : null}
              </button>
              {notificationsOpen ? (
                <section className="notification-panel">
                  <div className="notification-head">
                    <strong>通知</strong>
                    <span>{notifications.total > 0 ? `${notifications.total} 条待处理` : "暂无待处理"}</span>
                  </div>
                  {notifications.items.length > 0 ? (
                    <div className="notification-list">
                      {notifications.items.map((item) => (
                        <Link
                          className={`notification-item ${item.tone}`}
                          href={item.href}
                          key={item.id}
                          onClick={() => setNotificationsOpen(false)}
                        >
                          <span />
                          <div>
                            <strong>{item.title}</strong>
                            <small>{item.description}</small>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="notification-empty">
                      <strong>都处理完了</strong>
                      <span>新的待审核趟次和维保提醒会显示在这里。</span>
                    </div>
                  )}
                  <div className="notification-actions">
                    <Link href="/trips?status=submitted" onClick={() => setNotificationsOpen(false)}>
                      待审核趟次
                    </Link>
                    <Link href="/vehicles" onClick={() => setNotificationsOpen(false)}>
                      车辆提醒
                    </Link>
                  </div>
                </section>
              ) : null}
            </div>
            <Link className="icon-button" aria-label="帮助" href="/settings">
              <CircleHelp size={18} />
            </Link>
            <div className="topbar-divider" />
            <div className="user-chip">{session.name}</div>
          </div>
        </header>
        <div className="content-area">
          <ToastMessage text={actionError} />
          {children}
        </div>
      </main>
    </div>
  );
}
