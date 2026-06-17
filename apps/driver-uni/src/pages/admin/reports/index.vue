<template>
  <view class="driver-page admin-page">
    <view class="driver-topbar">
      <view>
        <text class="driver-brand">利润统计</text>
        <text class="admin-subbrand">收入、支出与利润汇总</text>
      </view>
      <AdminAccountMenu />
    </view>

    <view class="driver-content admin-content">
      <view class="period-tabs">
        <button
          v-for="item in periods"
          :key="item.value"
          :class="{ active: period === item.value }"
          @tap="setPeriod(item.value)"
        >
          {{ item.label }}
        </button>
      </view>

      <section class="profit-hero">
        <text>{{ periodLabel }}总利润</text>
        <text>{{ report.summary.profitTotal }}</text>
        <text>{{ report.summary.tripCount }} 趟 · 总支出 {{ report.summary.expenseTotal }}</text>
      </section>

      <section class="metric-grid">
        <view><text>总收入</text><text>{{ report.summary.actualFreightTotal }}</text></view>
        <view><text>趟次费用</text><text>{{ report.summary.tripExpenseTotal }}</text></view>
        <view><text>维修费用</text><text>{{ report.summary.maintenanceExpenseTotal }}</text></view>
        <view><text>总支出</text><text>{{ report.summary.expenseTotal }}</text></view>
      </section>

      <section class="driver-card chart-card">
        <view class="section-head"><text>周期趋势</text><text>{{ periodLabel }}</text></view>
        <view v-if="loading" class="empty-card">正在加载统计...</view>
        <view v-else-if="report.byPeriod.length === 0" class="empty-card">暂无统计数据</view>
        <view v-for="item in report.byPeriod" v-else :key="item.period" class="bar-row">
          <text>{{ item.period }}</text>
          <view class="bar-track"><view class="bar-fill" :style="{ width: barWidth(item.profitTotal) }" /></view>
          <text>{{ item.profitTotal }}</text>
        </view>
      </section>

      <section class="rank-stack">
        <view class="driver-card rank-card">
          <view class="section-head"><text>车辆利润排行</text><text>Top 5</text></view>
          <view v-if="report.byVehicle.length === 0" class="empty-card compact">暂无车辆数据</view>
          <view v-for="(item, index) in report.byVehicle.slice(0, 5)" v-else :key="item.id" class="rank-row">
            <text class="rank-index">{{ index + 1 }}</text>
            <view class="rank-main">
              <view class="rank-title-row">
                <text class="rank-name">{{ item.label }}</text>
                <text class="rank-profit">{{ item.profitTotal }}</text>
              </view>
              <view class="rank-meta-grid">
                <text>{{ item.tripCount }} 趟</text>
                <text>收入 {{ item.actualFreightTotal }}</text>
                <text>支出 {{ item.expenseTotal }}</text>
              </view>
            </view>
          </view>
        </view>

        <view class="driver-card rank-card">
          <view class="section-head"><text>司机趟次排行</text><text>Top 5</text></view>
          <view v-if="report.byDriver.length === 0" class="empty-card compact">暂无司机数据</view>
          <view v-for="(item, index) in report.byDriver.slice(0, 5)" v-else :key="item.id" class="rank-row">
            <text class="rank-index">{{ index + 1 }}</text>
            <view class="rank-main">
              <view class="rank-title-row">
                <text class="rank-name">{{ item.label }}</text>
                <text class="rank-profit">{{ item.tripCount }} 趟</text>
              </view>
              <view class="rank-meta-grid driver-trip-grid">
                <text>{{ item.tripCount }} 趟</text>
              </view>
            </view>
          </view>
        </view>
      </section>

      <section class="driver-card chart-card">
        <view class="section-head"><text>费用构成</text><text>含维修</text></view>
        <view v-if="report.byExpenseType.length === 0" class="empty-card compact">暂无费用数据</view>
        <view v-for="item in report.byExpenseType.slice(0, 6)" v-else :key="item.id" class="expense-row">
          <text>{{ item.label }}</text>
          <text>{{ item.total }}</text>
        </view>
      </section>
    </view>

    <AdminMobileNav active="reports" />
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { onPullDownRefresh } from "@dcloudio/uni-app";
import AdminAccountMenu from "@/components/AdminAccountMenu.vue";
import AdminMobileNav from "@/components/AdminMobileNav.vue";
import { fetchAdminProfitReport, requireAdminSession, type AdminProfitReport } from "@/api/client";
import { finishPullRefresh } from "@/utils/pull-refresh";

type Period = "week" | "month" | "year";

const emptyReport: AdminProfitReport = {
  summary: {
    tripCount: 0,
    actualFreightTotal: "¥ 0.00",
    tripExpenseTotal: "¥ 0.00",
    maintenanceExpenseTotal: "¥ 0.00",
    expenseTotal: "¥ 0.00",
    profitTotal: "¥ 0.00",
  },
  byPeriod: [],
  byVehicle: [],
  byDriver: [],
  byExpenseType: [],
};

const loading = ref(true);
const period = ref<Period>("month");
const report = ref<AdminProfitReport>(emptyReport);
const periods: Array<{ label: string; value: Period }> = [
  { label: "本周", value: "week" },
  { label: "本月", value: "month" },
  { label: "本年", value: "year" },
];
const periodLabel = computed(() => periods.find((item) => item.value === period.value)?.label ?? "本月");

onMounted(() => {
  if (!requireAdminSession()) return;
  loadReport();
});

onPullDownRefresh(() => {
  void finishPullRefresh(loadReport);
});

async function loadReport() {
  loading.value = true;
  try {
    report.value = await fetchAdminProfitReport(period.value, currentRange(period.value));
  } finally {
    loading.value = false;
  }
}

function setPeriod(value: Period) {
  period.value = value;
  void loadReport();
}

function barWidth(value: string) {
  const max = Math.max(
    1,
    ...report.value.byPeriod.map((item) => Math.abs(Number(item.profitTotal.replace(/[^\d.-]/g, "")))),
  );
  const current = Math.abs(Number(value.replace(/[^\d.-]/g, "")));
  return `${Math.max(8, Math.round((current / max) * 100))}%`;
}

function currentRange(value: Period) {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  if (value === "week") {
    const day = now.getDay() || 7;
    start.setDate(now.getDate() - day + 1);
    end.setDate(start.getDate() + 6);
  } else if (value === "month") {
    start.setDate(1);
    end.setMonth(now.getMonth() + 1, 0);
  } else {
    start.setMonth(0, 1);
    end.setMonth(11, 31);
  }

  return {
    from: toDateInput(start),
    to: toDateInput(end),
  };
}

function toDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
</script>

<style scoped>
.admin-page { padding-bottom: 96px; }
.driver-topbar { align-items: center; gap: 10px; }
.driver-topbar > view:first-child, .admin-content, .chart-card, .rank-card, .rank-stack { display: grid; gap: 14px; }
.driver-topbar > view:first-child { flex: 1; min-width: 0; gap: 2px; }
.admin-subbrand, .profit-hero text:first-child, .profit-hero text:last-child {
  color: var(--driver-muted);
  font-size: 12px;
}
.period-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  padding: 5px;
  border-radius: 999px;
  background: #eef4ff;
}
.period-tabs button {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 38px;
  margin: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--driver-muted);
  font-size: 13px;
  font-weight: 800;
  line-height: 38px;
  box-shadow: none;
}
.period-tabs button::after {
  border: 0;
}
.period-tabs button text {
  display: inline-flex;
  align-items: center;
  height: 100%;
  line-height: 1;
}
.period-tabs button.active {
  background: #ffffff;
  color: var(--driver-primary);
  box-shadow: var(--driver-soft-shadow);
}
.profit-hero {
  display: grid;
  gap: 6px;
  padding: 20px;
  border-radius: 26px;
  background: linear-gradient(135deg, #0b2f5b, #1262b8);
  color: #ffffff;
  box-shadow: var(--driver-shadow);
}
.profit-hero text:nth-child(2) {
  overflow-wrap: anywhere;
  font-size: 36px;
  font-weight: 900;
  line-height: 42px;
}
.profit-hero text:first-child, .profit-hero text:last-child { color: rgba(255,255,255,0.74); }
.metric-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.metric-grid view {
  display: grid;
  gap: 6px;
  padding: 14px;
  border: 1px solid var(--driver-border);
  border-radius: 20px;
  background: rgba(255,255,255,0.9);
}
.metric-grid text:first-child { color: var(--driver-muted); font-size: 12px; }
.metric-grid text:last-child {
  color: var(--driver-primary);
  font-size: 16px;
  font-weight: 800;
  overflow-wrap: anywhere;
}
.chart-card, .rank-card { padding: 16px; }
.section-head, .bar-row, .expense-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.section-head text:first-child {
  color: var(--driver-primary);
  font-size: 16px;
  font-weight: 800;
}
.section-head text:last-child, .bar-row, .expense-row {
  color: var(--driver-muted);
  font-size: 12px;
}
.bar-track {
  flex: 1;
  height: 9px;
  overflow: hidden;
  border-radius: 999px;
  background: #e6edf8;
}
.bar-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--driver-primary), var(--driver-green));
}
.rank-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 0;
  border-top: 1px solid var(--driver-border);
}
.rank-index {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 10px;
  background: #eef4ff;
  color: var(--driver-primary);
  font-size: 13px;
  font-weight: 900;
}
.rank-main {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 8px;
}
.rank-title-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 10px;
}
.rank-name {
  color: var(--driver-ink);
  font-size: 15px;
  font-weight: 900;
  line-height: 20px;
  overflow-wrap: anywhere;
}
.rank-profit {
  color: var(--driver-primary);
  font-size: 15px;
  font-weight: 900;
  line-height: 20px;
  text-align: right;
  white-space: nowrap;
}
.rank-meta-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}
.rank-meta-grid.driver-trip-grid {
  grid-template-columns: 1fr;
}
.rank-meta-grid text {
  min-width: 0;
  padding: 6px 7px;
  border-radius: 10px;
  background: #f4f7fc;
  color: var(--driver-muted);
  font-size: 11px;
  line-height: 15px;
  overflow-wrap: anywhere;
}
.expense-row text:last-child {
  color: var(--driver-primary);
  font-size: 13px;
  font-weight: 900;
  text-align: right;
}
.expense-row text:first-child { color: var(--driver-ink); font-size: 14px; }
.empty-card {
  padding: 22px 10px;
  border: 1px dashed var(--driver-border);
  border-radius: 18px;
  color: var(--driver-muted);
  text-align: center;
}
.empty-card.compact { padding: 18px 8px; font-size: 12px; }
@media (max-width: 390px) {
  .rank-title-row {
    grid-template-columns: 1fr;
    gap: 4px;
  }

  .rank-profit {
    text-align: left;
    white-space: normal;
  }

  .rank-meta-grid {
    grid-template-columns: 1fr;
  }
}
</style>
