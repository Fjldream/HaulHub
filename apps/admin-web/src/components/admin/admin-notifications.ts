export interface AdminNotificationItem {
  id: string;
  title: string;
  description: string;
  href: string;
  tone: "warning" | "info" | "danger";
}

export interface AdminNotifications {
  total: number;
  items: AdminNotificationItem[];
}
