const statusMeta: Record<string, { label: string; className: string }> = {
  assigned: { label: "待出车", className: "status neutral" },
  in_progress: { label: "进行中", className: "status info" },
  submitted: { label: "已提交", className: "status warning" },
  under_review: { label: "审核中", className: "status warning" },
  completed: { label: "已完成", className: "status success" },
  returned: { label: "已退回", className: "status danger" },
  available: { label: "可用", className: "status success" },
  maintenance: { label: "维修中", className: "status warning" },
  disabled: { label: "停用", className: "status danger" },
  active: { label: "在职", className: "status success" },
  enabled: { label: "启用", className: "status success" },
};

export function statusLabel(status: string): string {
  return statusMeta[status]?.label ?? status;
}

export function StatusBadge({ status }: { status: string }) {
  const meta = statusMeta[status] ?? { label: status, className: "status neutral" };

  return <span className={meta.className}>{meta.label}</span>;
}
