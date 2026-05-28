import type { DriverTrip } from "@/api/client";

export interface DriverNotificationSettings {
  newTicketNotify: boolean;
  missingReceiptNotify: boolean;
}

export interface DriverNotice {
  id: string;
  title: string;
  body: string;
  time: string;
  icon: string;
  read: boolean;
}

export const driverSettingsStorageKey = "lahuo-driver-settings";
export const readNoticeStorageKey = "lahuo-read-notices";

const defaultSettings: DriverNotificationSettings = {
  newTicketNotify: true,
  missingReceiptNotify: true,
};

export function loadDriverNotificationSettings(): DriverNotificationSettings {
  try {
    const settings = uni.getStorageSync(driverSettingsStorageKey) as
      | Partial<DriverNotificationSettings>
      | "";
    return {
      newTicketNotify: settings ? (settings.newTicketNotify ?? true) : true,
      missingReceiptNotify: settings ? (settings.missingReceiptNotify ?? true) : true,
    };
  } catch {
    return { ...defaultSettings };
  }
}

export function loadReadNoticeIds(): string[] {
  try {
    const value = uni.getStorageSync(readNoticeStorageKey) as string[] | "";
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function saveReadNoticeIds(ids: string[]) {
  uni.setStorageSync(readNoticeStorageKey, ids);
}

export function buildDriverNotices(
  trips: DriverTrip[],
  settings: DriverNotificationSettings = loadDriverNotificationSettings(),
  readIds: string[] = loadReadNoticeIds(),
): DriverNotice[] {
  const generated: DriverNotice[] = [];

  for (const trip of trips) {
    if (settings.newTicketNotify && (trip.rawStatus === "assigned" || trip.rawStatus === "in_progress")) {
      generated.push({
        id: `trip-${trip.id}-${trip.rawStatus}`,
        title: trip.rawStatus === "assigned" ? "新小票已生成" : "小票进行中",
        body: `${trip.plateNumber} ${trip.loadLocation} -> ${trip.unloadLocation}`,
        time: trip.plannedAt,
        icon: "receipt_long",
        read: false,
      });
    }

    if (settings.missingReceiptNotify && trip.missingItems.length > 0) {
      generated.push({
        id: `missing-${trip.id}`,
        title: "票据待补充",
        body: `${trip.plateNumber} 还缺少 ${trip.missingItems.join("、")}，补齐后再提交。`,
        time: trip.plannedAt,
        icon: "add_a_photo",
        read: false,
      });
    }

    if (settings.newTicketNotify && trip.rawStatus === "completed") {
      generated.push({
        id: `completed-${trip.id}`,
        title: "小票审核完成",
        body: `${trip.plateNumber} 已完成结算，可在收入明细查看。`,
        time: trip.plannedAt,
        icon: "verified",
        read: false,
      });
    }

    if (settings.newTicketNotify && trip.rawStatus === "returned") {
      generated.push({
        id: `returned-${trip.id}`,
        title: "小票被退回",
        body: trip.driverNote,
        time: trip.plannedAt,
        icon: "assignment_return",
        read: false,
      });
    }
  }

  return generated.map((notice) => ({
    ...notice,
    read: readIds.includes(notice.id),
  }));
}

export function countUnreadDriverNotices(trips: DriverTrip[]): number {
  return buildDriverNotices(trips).filter((notice) => !notice.read).length;
}
