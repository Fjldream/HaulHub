import { fetchDriverTrips, type DriverTrip } from "@/api/client";
import {
  buildDriverNotices,
  loadDriverNotificationSettings,
  loadReadNoticeIds,
  type DriverNotificationSettings,
  type DriverNotice,
} from "@/utils/notifications";

type LoadDriverTrips = () => Promise<DriverTrip[]>;

interface DriverNoticeOptions {
  settings?: DriverNotificationSettings;
  readIds?: string[];
}

export async function fetchDriverNotices(
  loadTrips: LoadDriverTrips = fetchDriverTrips,
  options: DriverNoticeOptions = {},
): Promise<DriverNotice[]> {
  const trips = await loadTrips();
  return buildDriverNotices(
    trips,
    options.settings ?? loadDriverNotificationSettings(),
    options.readIds ?? loadReadNoticeIds(),
  );
}

export async function fetchUnreadDriverNoticeCount(
  loadTrips: LoadDriverTrips = fetchDriverTrips,
  options: DriverNoticeOptions = {},
): Promise<number> {
  const notices = await fetchDriverNotices(loadTrips, options);
  return notices.filter((notice) => !notice.read).length;
}
