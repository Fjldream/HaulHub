"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
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
} from "lucide-react";
import type { ReactNode } from "react";
import type { AdminSession } from "@/lib/admin-session";

const navItems = [
  { href: "/", label: "工作台", icon: LayoutDashboard },
  { href: "/trips", label: "趟次管理", icon: ClipboardList },
  { href: "/vehicles", label: "车辆管理", icon: Truck },
  { href: "/vehicles/maintenance", label: "维修记录", icon: Wrench },
  { href: "/drivers", label: "司机管理", icon: Users },
  { href: "/expense-types", label: "费用类型", icon: ReceiptText },
  { href: "/reports", label: "利润统计", icon: BarChart3 },
  { href: "/audit-logs", label: "操作记录", icon: History },
];

const utilityItems = [
  { href: "/teams", label: "团队管理", icon: Users, adminOnly: true },
  { href: "/members", label: "成员管理", icon: ShieldCheck, adminOnly: true },
  { href: "/settings", label: "系统设置", icon: Settings, adminOnly: false },
];

const sectionTitles = [...navItems, ...utilityItems].map((item) => ({
  href: item.href,
  label: item.label,
}));
sectionTitles.push({ href: "/search", label: "全局搜索" });

export function AdminShellClient({
  children,
  session,
}: {
  children: ReactNode;
  session: AdminSession;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentQuery = pathname === "/search" ? (searchParams.get("q") ?? "") : "";
  const visibleUtilityItems = utilityItems.filter(
    (item) => !item.adminOnly || session.role === "administrator",
  );
  const currentSection =
    sectionTitles
      .filter((item) => (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)))
      .sort((a, b) => b.href.length - a.href.length)[0]?.label ?? "后台";
  const roleLabel = session.role === "administrator" ? "超级管理员" : "管理员后台";
  const isActiveNav = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    if (href === "/vehicles") {
      return pathname === "/vehicles" || /^\/vehicles\/(?!maintenance(?:\/|$))/.test(pathname);
    }
    return pathname === href || pathname.startsWith(`${href}/`);
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
            const isActive = isActiveNav(item.href);
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
          <form action="/login/logout" method="post">
            <button className="nav-item danger-nav" type="submit">
              <LogOut size={18} />
              退出登录
            </button>
          </form>
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
              <input
                name="q"
                placeholder="搜索趟次、车牌、司机、费用类型"
                defaultValue={currentQuery}
              />
            </form>
            <Link className="icon-button has-dot" aria-label="通知" href="/trips?status=submitted">
              <Bell size={18} />
            </Link>
            <Link className="icon-button" aria-label="帮助" href="/settings">
              <CircleHelp size={18} />
            </Link>
            <div className="topbar-divider" />
            <div className="user-chip">{session.name}</div>
          </div>
        </header>
        <div className="content-area">{children}</div>
      </main>
    </div>
  );
}
