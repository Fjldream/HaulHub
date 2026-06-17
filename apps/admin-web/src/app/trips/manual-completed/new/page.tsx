import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { ManualCompletedBillingForm } from "@/components/admin/manual-completed-billing-form";
import { redirectWithActionError } from "@/lib/action-errors";
import {
  apiGet,
  apiPost,
  type ApiDriver,
  type ApiExpenseType,
  type ApiTrip,
  type ApiVehicle,
} from "@/lib/api-client";

export const dynamic = "force-dynamic";

function parseHiddenExpensePayload(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function formString(formData: FormData, name: string) {
  return String(formData.get(name) || "");
}

function formStringList(formData: FormData, name: string) {
  return formData.getAll(name).map((value) => String(value));
}

function buildExpensePayloadFromFields(formData: FormData) {
  const mode = formString(formData, "expenseMode");

  if (mode === "total") {
    const amount = formString(formData, "totalExpenseAmount");
    const note = formString(formData, "totalExpenseNote");
    return {
      totalExpense: {
        amount,
        ...(note ? { note } : {}),
      },
    };
  }

  if (mode === "details") {
    const expenseTypeIds = formStringList(formData, "expenseTypeId[]");
    const amounts = formStringList(formData, "expenseAmount[]");
    const occurredAts = formStringList(formData, "expenseOccurredAt[]");
    const notes = formStringList(formData, "expenseNote[]");

    return {
      expenses: expenseTypeIds.map((expenseTypeId, index) => ({
        expenseTypeId,
        amount: amounts[index] ?? "",
        occurredAt: occurredAts[index] ?? "",
        note: notes[index] ?? "",
      })),
    };
  }

  return null;
}

async function createManualCompletedTripAction(formData: FormData) {
  "use server";

  const hiddenExpensePayload = parseHiddenExpensePayload(formData.get("expensePayload"));
  const namedExpensePayload = buildExpensePayloadFromFields(formData);
  const expensePayload = namedExpensePayload ?? hiddenExpensePayload ?? {};

  let tripId = "";
  try {
    const { trip } = await apiPost<{ trip: ApiTrip }>("/admin/trips/manual-completed", {
      vehicleId: formString(formData, "vehicleId"),
      driverId: formString(formData, "driverId"),
      assistantDriverIds: formData.getAll("assistantDriverIds").map(String),
      customerName: formString(formData, "customerName"),
      loadLocation: formString(formData, "loadLocation"),
      unloadLocation: formString(formData, "unloadLocation"),
      actualFreight: formString(formData, "actualFreight"),
      settledAt: formString(formData, "settledAt"),
      accountingNote: formString(formData, "accountingNote"),
      ...expensePayload,
    });
    tripId = trip.id;
  } catch (error) {
    redirectWithActionError("/trips/manual-completed/new", error);
  }

  redirect(`/trips/${tripId}`);
}

export default async function NewManualCompletedTripPage() {
  const [{ vehicles }, { drivers }, { expenseTypes }] = await Promise.all([
    apiGet<{ vehicles: ApiVehicle[] }>("/admin/vehicles"),
    apiGet<{ drivers: ApiDriver[] }>("/admin/drivers"),
    apiGet<{ expenseTypes: ApiExpenseType[] }>("/admin/expense-types"),
  ]);

  return (
    <AdminShell>
      <section className="page-heading">
        <div>
          <h1>补录完成账单</h1>
          <p>录入系统外已完成运输，并计入利润统计。</p>
        </div>
        <Link className="secondary-button" href="/trips">
          <ArrowLeft size={16} />
          返回趟次
        </Link>
      </section>

      <ManualCompletedBillingForm
        vehicles={vehicles.filter((vehicle) => vehicle.status === "available")}
        drivers={drivers.filter((driver) => driver.status === "active")}
        expenseTypes={expenseTypes.filter((type) => type.enabled)}
        action={createManualCompletedTripAction}
      />
    </AdminShell>
  );
}
