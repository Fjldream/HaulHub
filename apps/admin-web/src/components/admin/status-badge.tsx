const statusClassName: Record<string, string> = {
  待出车: "status neutral",
  进行中: "status info",
  已提交: "status warning",
  审核中: "status warning",
  已完成: "status success",
  已退回: "status danger",
  可用: "status success",
  维修中: "status warning",
  停用: "status danger",
  在职: "status success",
  启用: "status success",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={statusClassName[status] ?? "status neutral"}>{status}</span>;
}
