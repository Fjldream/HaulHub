export const driverTripTabs = [
  { key: "all", label: "全部" },
  { key: "assigned", label: "待出车" },
  { key: "in_progress", label: "进行中" },
  { key: "submitted", label: "已提交" },
] as const;

export type DriverTripTabKey = (typeof driverTripTabs)[number]["key"];
type DriverTripStatusFilter = Exclude<DriverTripTabKey, "all">;

export function tripStatusFilterForTab(tab: DriverTripTabKey): DriverTripStatusFilter | undefined {
  return tab === "all" ? undefined : tab;
}
