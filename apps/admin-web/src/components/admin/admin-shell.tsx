import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getAdminSession } from "@/lib/admin-session";
import { apiGet, type ApiTrip, type ApiVehicle } from "@/lib/api-client";
import type { AdminNotifications } from "./admin-notifications";
import { AdminShellClient } from "./admin-shell-client";

function maintenanceDays(value: string | null | undefined) {
  if (!value) return null;
  const due = new Date(value).getTime();
  if (Number.isNaN(due)) return null;
  return Math.ceil((due - Date.now()) / 86_400_000);
}

function buildMaintenanceDescription(days: number | null) {
  if (days == null) return "请补充下次维保时间";
  if (days < 0) return `已逾期 ${Math.abs(days)} 天`;
  if (days === 0) return "今天到期";
  return `${days} 天后到期`;
}

async function getAdminNotifications(): Promise<AdminNotifications> {
  try {
    const [submittedTrips, reviewTrips, vehicleResponse] = await Promise.all([
      apiGet<{ trips: ApiTrip[] }>("/admin/trips?status=submitted"),
      apiGet<{ trips: ApiTrip[] }>("/admin/trips?status=under_review"),
      apiGet<{ vehicles: ApiVehicle[] }>("/admin/vehicles"),
    ]);
    const urgentVehicles = vehicleResponse.vehicles
      .map((vehicle) => ({ vehicle, days: maintenanceDays(vehicle.maintenanceDueAt) }))
      .filter((item) => item.days != null && item.days <= 7)
      .sort((a, b) => (a.days ?? 0) - (b.days ?? 0));
    const items = [
      ...submittedTrips.trips.slice(0, 4).map((trip) => ({
        id: `submitted-${trip.id}`,
        title: "趟次待审核",
        description: `${trip.tripNo} · ${trip.vehicle.plateNumber} · ${trip.driver.name}`,
        href: `/trips/${trip.id}`,
        tone: "warning" as const,
      })),
      ...reviewTrips.trips.slice(0, 3).map((trip) => ({
        id: `review-${trip.id}`,
        title: "趟次审核中",
        description: `${trip.tripNo} · ${trip.customerName}`,
        href: `/trips/${trip.id}`,
        tone: "info" as const,
      })),
      ...urgentVehicles.slice(0, 3).map(({ vehicle, days }) => ({
        id: `maintenance-${vehicle.id}`,
        title: days != null && days < 0 ? "维保已逾期" : "维保提醒",
        description: `${vehicle.plateNumber} · ${buildMaintenanceDescription(days)}`,
        href: `/vehicles/${vehicle.id}`,
        tone: days != null && days < 0 ? ("danger" as const) : ("warning" as const),
      })),
    ];

    return {
      total: submittedTrips.trips.length + reviewTrips.trips.length + urgentVehicles.length,
      items: items.slice(0, 8),
    };
  } catch {
    return { total: 0, items: [] };
  }
}

export async function AdminShell({ children }: { children: ReactNode }) {
  const session = await getAdminSession();
  if (!session) {
    redirect("/login");
  }
  if (session.role === "administrator" && !session.activeTeamId) {
    redirect("/teams/select");
  }
  const notifications = await getAdminNotifications();

  return (
    <AdminShellClient notifications={notifications} session={session}>
      {children}
    </AdminShellClient>
  );
}
