import { describe, expect, it } from "vitest";
import {
  buildManualBillingPayload,
  calculateManualBillingPreview,
  getDriversBoundToVehicle,
  validateManualBillingForm,
  type ManualBillingForm,
} from "./manual-billing-model";

function form(input: Partial<ManualBillingForm> = {}): ManualBillingForm {
  return {
    vehicleId: "vehicle-1",
    driverId: "driver-1",
    customerName: "测试客户",
    loadLocation: "装货地",
    unloadLocation: "卸货地",
    actualFreight: "1000.00",
    settledAt: "2026-06-16",
    accountingNote: "",
    expenseMode: "details",
    expenses: [],
    totalExpense: "",
    ...input,
  };
}

describe("manual billing model", () => {
  it("calculates detail expense preview", () => {
    expect(
      calculateManualBillingPreview(
        form({
          expenses: [
            { expenseTypeId: "fuel", amount: "200.00", occurredAt: "2026-06-16", note: "" },
            { expenseTypeId: "toll", amount: "50.50", occurredAt: "2026-06-16", note: "" },
          ],
        }),
      ),
    ).toEqual({
      actualFreight: "1000.00",
      expenseTotal: "250.50",
      profit: "749.50",
      profitRate: "74.95",
    });
  });

  it("calculates total expense preview", () => {
    expect(
      calculateManualBillingPreview(
        form({
          expenseMode: "total",
          totalExpense: "300.00",
        }),
      ),
    ).toEqual({
      actualFreight: "1000.00",
      expenseTotal: "300.00",
      profit: "700.00",
      profitRate: "70.00",
    });
  });

  it("rejects invalid required fields and expense rows", () => {
    expect(
      validateManualBillingForm(
        form({
          vehicleId: "",
          driverId: "",
          customerName: "",
          actualFreight: "invalid",
          expenses: [{ expenseTypeId: "", amount: "bad", occurredAt: "", note: "" }],
        }),
      ),
    ).toEqual([
      "请选择车辆",
      "请选择司机",
      "请填写客户名称",
      "请填写正确的实际运费",
      "第 1 条费用请选择费用类型",
      "第 1 条费用请填写正确金额",
      "第 1 条费用请选择发生日期",
    ]);
  });

  it("sends only active total expense mode in payload", () => {
    expect(
      buildManualBillingPayload(
        form({
          expenseMode: "total",
          totalExpense: "88.00",
          expenses: [{ expenseTypeId: "fuel", amount: "12.00", occurredAt: "2026-06-16", note: "" }],
        }),
      ),
    ).toMatchObject({
      totalExpense: "88.00",
      expenses: undefined,
    });
  });

  it("returns only active drivers bound to selected vehicle", () => {
    const drivers = [
      { id: "driver-1", name: "甲", status: "active", boundVehicles: [{ id: "vehicle-1" }] },
      { id: "driver-2", name: "乙", status: "disabled", boundVehicles: [{ id: "vehicle-1" }] },
      { id: "driver-3", name: "丙", status: "active", boundVehicles: [{ id: "vehicle-2" }] },
    ];

    expect(getDriversBoundToVehicle(drivers, "vehicle-1")).toEqual([drivers[0]]);
  });
});
