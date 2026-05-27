import Link from "next/link";
import {
  BarChart3,
  Car,
  ClipboardList,
  LayoutDashboard,
  ReceiptText,
  Settings,
  Truck,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";

const navItems = [
  { href: "/", label: "工作台", icon: LayoutDashboard },
  { href: "/trips", label: "趟次管理", icon: ClipboardList },
  { href: "/reports", label: "利润统计", icon: BarChart3 },
  { href: "/vehicles", label: "车辆管理", icon: Truck },
  { href: "/drivers", label: "司机管理", icon: Users },
  { href: "/expense-types", label: "费用类别", icon: ReceiptText },
  { href: "/settings", label: "系统设置", icon: Settings },
];

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand">
          <Car size={22} />
          <div>
            <strong>HaulHub</strong>
            <span>运输账单系统</span>
          </div>
        </div>
        <nav className="nav-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link className="nav-item" href={item.href} key={item.href}>
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="main">
        <header className="topbar">
          <div>
            <span className="topbar-kicker">会计后台</span>
            <strong>账单审核与利润核算工作台</strong>
          </div>
          <div className="user-chip">会计小周</div>
        </header>
        {children}
      </main>
    </div>
  );
}
