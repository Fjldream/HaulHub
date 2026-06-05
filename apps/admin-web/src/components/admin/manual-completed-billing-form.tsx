"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { ApiDriver, ApiExpenseType, ApiVehicle } from "@/lib/api-client";
import { formatMoney } from "@/lib/api-client";
import {
  calculateManualBillingPreview,
  manualBillingPayload,
  type ManualBillingExpenseMode,
  type ManualBillingExpenseRow,
} from "./manual-completed-billing-model";
import { getDriversBoundToVehicle } from "./trip-dispatch-fields-model";

interface ManualCompletedBillingFormProps {
  vehicles: ApiVehicle[];
  drivers: ApiDriver[];
  expenseTypes: ApiExpenseType[];
  action: (formData: FormData) => void | Promise<void>;
}

function newExpenseRow(
  expenseTypes: ApiExpenseType[],
  occurredAt: string,
  id: string,
): ManualBillingExpenseRow {
  return {
    id,
    expenseTypeId: expenseTypes[0]?.id ?? "",
    amount: "",
    occurredAt,
    note: "",
  };
}

function formatProfitRate(value: string | null) {
  if (value == null) {
    return "不可计算";
  }

  return `${(Number(value) * 100).toLocaleString("zh-CN", {
    maximumFractionDigits: 2,
  })}%`;
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function ManualCompletedBillingForm({
  vehicles,
  drivers,
  expenseTypes,
  action,
}: ManualCompletedBillingFormProps) {
  const today = formatLocalDate(new Date());
  const [vehicleId, setVehicleId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [mode, setMode] = useState<ManualBillingExpenseMode>("details");
  const [actualFreight, setActualFreight] = useState("");
  const [settledAt, setSettledAt] = useState(today);
  const [totalExpense, setTotalExpense] = useState("");
  const [totalExpenseNote, setTotalExpenseNote] = useState("");
  const [expenses, setExpenses] = useState<ManualBillingExpenseRow[]>([
    newExpenseRow(expenseTypes, today, "row-1"),
  ]);
  const expenseRowSequence = useRef(1);
  const eligibleDrivers = useMemo(
    () => getDriversBoundToVehicle(drivers, vehicleId),
    [drivers, vehicleId],
  );
  const selectedDriverId = eligibleDrivers.some((driver) => driver.id === driverId) ? driverId : "";
  const preview = calculateManualBillingPreview(actualFreight, mode, expenses, totalExpense);
  const expensePayload = JSON.stringify(
    manualBillingPayload(mode, expenses, totalExpense, totalExpenseNote),
  );
  const driverPlaceholder =
    eligibleDrivers.length > 0 ? "选择司机" : vehicleId ? "暂无可用司机" : "请先选择车辆";

  function updateExpense(id: string, patch: Partial<ManualBillingExpenseRow>) {
    setExpenses((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function addExpense() {
    expenseRowSequence.current += 1;
    setExpenses((items) => [
      ...items,
      newExpenseRow(expenseTypes, settledAt, `row-${expenseRowSequence.current}`),
    ]);
  }

  return (
    <form action={action} className="form-panel manual-billing-form">
      <input type="hidden" name="expensePayload" value={expensePayload} />
      <input type="hidden" name="expenseMode" value={mode} />

      <section className="form-section">
        <div className="form-section-head">
          <h2>车辆与司机</h2>
          <p>司机按车辆绑定关系筛选。</p>
        </div>
        <div className="form-grid">
          <label>
            车辆
            <select
              name="vehicleId"
              required
              value={vehicleId}
              onChange={(event) => {
                setVehicleId(event.target.value);
                setDriverId("");
              }}
            >
              <option value="" disabled>
                选择车辆
              </option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.plateNumber}
                  {vehicle.vehicleType ? ` - ${vehicle.vehicleType}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            司机
            <select
              name="driverId"
              required
              disabled={!vehicleId || eligibleDrivers.length === 0}
              value={selectedDriverId}
              onChange={(event) => setDriverId(event.target.value)}
            >
              <option value="" disabled>
                {driverPlaceholder}
              </option>
              {eligibleDrivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.name} - {driver.phone}
                </option>
              ))}
            </select>
            {vehicleId && eligibleDrivers.length === 0 ? (
              <span className="form-hint danger">该车辆暂无可用司机，请先绑定。</span>
            ) : null}
          </label>
        </div>
      </section>

      <section className="form-section">
        <div className="form-section-head">
          <h2>运输信息</h2>
          <p>完成日期用于利润统计归档。</p>
        </div>
        <div className="form-grid">
          <label>
            客户名称
            <input name="customerName" required placeholder="例如：恒通物流" />
          </label>
          <label>
            实际运费
            <input
              name="actualFreight"
              inputMode="decimal"
              pattern="\d+(\.\d{1,2})?"
              required
              placeholder="例如：1800.00"
              value={actualFreight}
              onChange={(event) => setActualFreight(event.target.value)}
            />
          </label>
          <label>
            完成/结算日期
            <input
              name="settledAt"
              type="date"
              required
              value={settledAt}
              onChange={(event) => {
                const nextSettledAt = event.target.value;
                setExpenses((items) =>
                  items.map((item) => ({
                    ...item,
                    occurredAt:
                      !item.occurredAt || item.occurredAt === settledAt ? nextSettledAt : item.occurredAt,
                  })),
                );
                setSettledAt(nextSettledAt);
              }}
            />
          </label>
          <label>
            装货地
            <input name="loadLocation" required placeholder="例如：上海嘉定" />
          </label>
          <label>
            卸货地
            <input name="unloadLocation" required placeholder="例如：杭州萧山" />
          </label>
          <label>
            会计备注
            <textarea name="accountingNote" placeholder="可选" />
          </label>
        </div>
      </section>

      <section className="form-section">
        <div className="form-section-head">
          <h2>费用录入</h2>
          <p>选择明细或总费用，提交时只保存当前模式。</p>
        </div>
        <div className="segmented-control" aria-label="费用录入模式">
          <button
            type="button"
            className={mode === "details" ? "active" : ""}
            aria-pressed={mode === "details"}
            onClick={() => setMode("details")}
          >
            费用明细
          </button>
          <button
            type="button"
            className={mode === "total" ? "active" : ""}
            aria-pressed={mode === "total"}
            onClick={() => setMode("total")}
          >
            只填总费用
          </button>
        </div>

        {mode === "details" ? (
          <div className="table-wrap manual-expense-table">
            <table>
              <thead>
                <tr>
                  <th>费用类型</th>
                  <th>金额</th>
                  <th>发生日期</th>
                  <th>备注</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense, index) => (
                  <tr key={expense.id}>
                    <td>
                      <select
                        name="expenseTypeId[]"
                        aria-label={`第 ${index + 1} 行费用类型`}
                        required
                        value={expense.expenseTypeId}
                        onChange={(event) => updateExpense(expense.id, { expenseTypeId: event.target.value })}
                      >
                        {expenseTypes.map((type) => (
                          <option key={type.id} value={type.id}>
                            {type.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        name="expenseAmount[]"
                        aria-label={`第 ${index + 1} 行费用金额`}
                        inputMode="decimal"
                        pattern="\d+(\.\d{1,2})?"
                        required
                        value={expense.amount}
                        onChange={(event) => updateExpense(expense.id, { amount: event.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        name="expenseOccurredAt[]"
                        aria-label={`第 ${index + 1} 行发生日期`}
                        type="date"
                        required
                        value={expense.occurredAt || settledAt}
                        onChange={(event) => updateExpense(expense.id, { occurredAt: event.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        name="expenseNote[]"
                        aria-label={`第 ${index + 1} 行费用备注`}
                        value={expense.note}
                        onChange={(event) => updateExpense(expense.id, { note: event.target.value })}
                      />
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        type="button"
                        aria-label={`删除第 ${index + 1} 行费用`}
                        disabled={expenses.length === 1}
                        onClick={() => setExpenses((items) => items.filter((item) => item.id !== expense.id))}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              className="secondary-button"
              type="button"
              onClick={addExpense}
            >
              <Plus size={16} />
              新增费用
            </button>
          </div>
        ) : (
          <div className="form-grid">
            <label>
              总费用
              <input
                name="totalExpenseAmount"
                aria-label="总费用金额"
                inputMode="decimal"
                pattern="\d+(\.\d{1,2})?"
                required
                value={totalExpense}
                onChange={(event) => setTotalExpense(event.target.value)}
              />
            </label>
            <label>
              总费用备注
              <input
                name="totalExpenseNote"
                aria-label="总费用备注"
                value={totalExpenseNote}
                onChange={(event) => setTotalExpenseNote(event.target.value)}
              />
            </label>
          </div>
        )}
      </section>

      <aside className="review-panel">
        <h2>保存前预览</h2>
        <div className="summary-row">
          <span>实际运费</span>
          <strong>{formatMoney(preview.actualFreight)}</strong>
        </div>
        <div className="summary-row">
          <span>费用合计</span>
          <strong>{formatMoney(preview.expenseTotal)}</strong>
        </div>
        <div className="summary-row total">
          <span>预计利润</span>
          <strong>{formatMoney(preview.profit)}</strong>
        </div>
        <div className="summary-row">
          <span>利润率</span>
          <strong>{formatProfitRate(preview.profitRate)}</strong>
        </div>
      </aside>

      <div className="form-actions">
        <button className="primary-button" type="submit">
          保存并计入利润统计
        </button>
      </div>
    </form>
  );
}
