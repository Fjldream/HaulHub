<template>
  <view class="driver-page">
    <view class="driver-topbar">
      <button class="driver-icon-button" @tap="goBack">
        <AppIcon name="arrow_back" />
      </button>
      <text class="driver-title">小票详情</text>
      <view class="status-inline">
        <view class="status-dot" />
        <text>{{ trip.status }}</text>
      </view>
    </view>

    <view class="driver-content detail-content">
      <section class="driver-card trip-summary">
        <view class="summary-head">
          <view>
            <text class="driver-heading">{{ trip.plateNumber }}</text>
            <text class="driver-muted">{{ trip.customerName }}</text>
          </view>
          <view class="trip-no">
            <text>单号: {{ trip.id }}</text>
          </view>
        </view>

        <view class="route-card">
          <view class="route-icons">
            <AppIcon class="origin" name="trip_origin" />
            <view class="route-line" />
            <AppIcon class="destination" name="location_on" />
          </view>
          <view class="route-copy">
            <button class="route-stop" @tap="openNavigation('load')">
              <view class="route-stop-copy">
                <text class="driver-label">装货地</text>
                <text class="route-place">{{ trip.loadLocation }}</text>
              </view>
              <view class="route-action" aria-label="导航到装货地">
                <AppIcon name="near_me" />
              </view>
            </button>
            <button class="route-stop" @tap="openNavigation('unload')">
              <view class="route-stop-copy">
                <text class="driver-label">卸货地</text>
                <text class="route-place">{{ trip.unloadLocation }}</text>
              </view>
              <view class="route-action" aria-label="导航到卸货地">
                <AppIcon name="near_me" />
              </view>
            </button>
          </view>
        </view>
      </section>

      <section class="expenses-section">
        <view class="section-head">
          <text class="driver-heading">费用明细</text>
          <text class="driver-label">共 {{ expenses.length }} 笔费用</text>
        </view>

        <view class="expense-list">
          <view v-for="expense in expenses" :key="expense.id" class="expense-item">
            <view class="expense-icon">
              <AppIcon :name="expenseIcon(expense.type)" />
            </view>
            <view class="expense-body">
              <view class="expense-main">
                <text class="expense-type">{{ expense.type }}</text>
                <text class="expense-amount">{{ expense.amount }}</text>
              </view>
              <text class="expense-note">{{ expense.note }}</text>
              <view :class="expense.receipt === '缺少票据' ? 'receipt-box missing' : 'receipt-box'">
                <AppIcon :name="expense.receipt === '缺少票据' ? 'add_a_photo' : 'receipt_long'" />
                <text>{{ expense.receipt }}</text>
              </view>
              <view v-if="expense.receiptImages.length > 0" class="receipt-preview-grid">
                <view
                  v-for="(receipt, index) in expense.receiptImages"
                  :key="receipt.id"
                  class="receipt-preview"
                  @tap="previewReceipts(expense, index)"
                >
                  <image
                    class="receipt-preview-image"
                    mode="aspectFill"
                    :src="receiptDisplayUrl(receipt)"
                  ></image>
                  <view class="receipt-preview-mask">查看</view>
                </view>
              </view>
              <view v-if="trip.canEdit" class="expense-actions">
                <button @tap="editExpense(expense)">
                  <AppIcon name="edit" />
                  <text>编辑</text>
                </button>
                <button class="danger" @tap="removeExpense(expense)">
                  <AppIcon name="delete" />
                  <text>删除</text>
                </button>
              </view>
            </view>
          </view>
        </view>

        <button v-if="trip.canEdit" class="add-expense" @tap="addExpense">
          <AppIcon name="add_circle" />
          <text>新增费用项</text>
        </button>
      </section>

      <section class="note-section">
        <text class="driver-heading">调度备注</text>
        <view class="note-input">
          <text>{{ trip.driverNote }}</text>
        </view>
      </section>
    </view>

    <view class="driver-bottom-action">
      <view class="action-row">
        <button class="driver-secondary-button" :disabled="!trip.canEdit" @tap="addExpense">
          <AppIcon name="receipt_long" />
          <text>记录报销</text>
        </button>
        <button class="driver-primary-button submit-button" :disabled="primaryDisabled" @tap="handlePrimaryAction">
          <AppIcon :name="trip.canStart ? 'play_arrow' : 'check_circle'" />
          <text>{{ trip.canStart ? "开始运输" : "收车提交" }}</text>
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onPullDownRefresh, onShow } from "@dcloudio/uni-app";
import {
  deleteDriverExpense,
  fetchDriverTripDetail,
  getApiErrorMessage,
  requireDriverSession,
  resolveStorageUrl,
  startDriverTrip,
  type DriverExpense,
  type DriverTrip,
} from "@/api/client";
import { finishPullRefresh } from "@/utils/pull-refresh";
import {
  buildAmapNavigationUrl,
  buildAmapSearchUrl,
  getTripLocationTarget,
} from "@/utils/map-navigation";

const emptyTrip: DriverTrip = {
  id: "",
  plateNumber: "-",
  customerName: "-",
  loadLocation: "-",
  loadAddress: null,
  loadLatitude: null,
  loadLongitude: null,
  loadPoiId: null,
  unloadLocation: "-",
  unloadAddress: null,
  unloadLatitude: null,
  unloadLongitude: null,
  unloadPoiId: null,
  locationProvider: null,
  rawCreatedAt: new Date().toISOString(),
  rawStatus: "assigned",
  status: "待出车",
  plannedAt: "-",
  driverNote: "-",
  expenseTotal: "",
  missingItems: [],
  canEdit: false,
  canStart: false,
  canSubmit: false,
};

const trip = ref<DriverTrip>(emptyTrip);
const expenses = ref<DriverExpense[]>([]);
const currentTripId = ref("");
const receiptLocalUrls = ref<Record<string, string>>({});
const primaryDisabled = computed(() => !trip.value.canStart && !trip.value.canSubmit);

onShow(async () => {
  if (!requireDriverSession()) return;
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1] as { options?: { id?: string } };
  currentTripId.value = currentPage.options?.id ?? currentTripId.value;
  if (!currentTripId.value) {
    uni.showToast({ title: "缺少趟次 ID", icon: "none" });
    return;
  }

  try {
    const detail = await fetchDriverTripDetail(currentTripId.value);
    trip.value = detail.trip;
    expenses.value = detail.expenses;
    cacheReceiptImages(detail.expenses);
  } catch (error) {
    uni.showToast({ title: getApiErrorMessage(error, "小票详情加载失败"), icon: "none" });
  }
});

onPullDownRefresh(() => {
  void finishPullRefresh(async () => {
    if (!currentTripId.value) return;
    await refreshDetail();
  });
});

function expenseIcon(type: string) {
  if (type.includes("油")) return "local_gas_station";
  if (type.includes("路")) return "road";
  if (type.includes("餐")) return "fastfood";
  if (type.includes("停")) return "local_parking";
  if (type.includes("修")) return "build";
  return "receipt_long";
}

function receiptImageUrl(storageKey: string) {
  return resolveStorageUrl(storageKey);
}

function receiptDisplayUrl(receipt: DriverExpense["receiptImages"][number]) {
  return receiptLocalUrls.value[receipt.id] ?? receiptImageUrl(receipt.storageKey);
}

function downloadReceiptImage(receipt: DriverExpense["receiptImages"][number]) {
  return new Promise<void>((resolve) => {
    const url = receiptImageUrl(receipt.storageKey);
    if (/^(file:|wxfile:|blob:|data:image)/.test(url)) {
      receiptLocalUrls.value = { ...receiptLocalUrls.value, [receipt.id]: url };
      resolve();
      return;
    }
    uni.downloadFile({
      url,
      success: (response) => {
        if (response.statusCode >= 200 && response.statusCode < 300 && response.tempFilePath) {
          receiptLocalUrls.value = { ...receiptLocalUrls.value, [receipt.id]: response.tempFilePath };
        }
        resolve();
      },
      fail: () => resolve(),
    });
  });
}

function cacheReceiptImages(items: DriverExpense[]) {
  const receipts = items.flatMap((expense) => expense.receiptImages);
  void Promise.all(receipts.map((receipt) => downloadReceiptImage(receipt)));
}

function previewReceipts(expense: DriverExpense, index: number) {
  const urls = expense.receiptImages.map((receipt) => receiptDisplayUrl(receipt));
  uni.previewImage({
    urls,
    current: urls[index],
  });
}

function goBack() {
  uni.navigateBack();
}

function addExpense() {
  uni.navigateTo({ url: `/pages/expenses/form?tripId=${trip.value.id}` });
}

function editExpense(expense: DriverExpense) {
  uni.navigateTo({
    url: `/pages/expenses/form?tripId=${trip.value.id}&expenseId=${expense.id}`,
  });
}

function openExternalMap(url: string) {
  // #ifdef H5
  window.location.href = url;
  // #endif
  // #ifdef APP-PLUS
  plus.runtime.openURL(url, () => {
    uni.showToast({ title: "未检测到可打开的地图应用", icon: "none" });
  });
  // #endif
  // #ifdef MP-WEIXIN
  uni.showToast({ title: "小程序内请使用系统地图导航", icon: "none" });
  // #endif
}

function openNavigation(type: "load" | "unload") {
  const target = getTripLocationTarget(trip.value, type);
  if (!target.precise || target.latitude == null || target.longitude == null) {
    uni.showModal({
      title: "地点未精确选点",
      content: "该趟次只有文字地址，将打开高德地图搜索结果，请出发前核对目的地。",
      confirmText: "打开地图",
      success: (result) => {
        if (result.confirm) {
          openExternalMap(buildAmapSearchUrl(target.address || target.name));
        }
      },
    });
    return;
  }

  // #ifdef MP-WEIXIN
  uni.openLocation({
    latitude: target.latitude,
    longitude: target.longitude,
    name: target.name,
    address: target.address,
    scale: 16,
  });
  return;
  // #endif

  uni.showActionSheet({
    itemList: ["系统地图", "高德地图"],
    success: (result) => {
      if (result.tapIndex === 0) {
        uni.openLocation({
          latitude: target.latitude,
          longitude: target.longitude,
          name: target.name,
          address: target.address,
          scale: 16,
        });
        return;
      }
      openExternalMap(
        buildAmapNavigationUrl({
          name: target.name,
          latitude: target.latitude,
          longitude: target.longitude,
        }),
      );
    },
  });
}

async function refreshDetail() {
  const detail = await fetchDriverTripDetail(trip.value.id);
  trip.value = detail.trip;
  expenses.value = detail.expenses;
  cacheReceiptImages(detail.expenses);
}

function removeExpense(expense: DriverExpense) {
  uni.showModal({
    title: "删除费用",
    content: `确认删除${expense.type}？`,
    confirmColor: "#ba1a1a",
    success: async (result) => {
      if (!result.confirm) {
        return;
      }
      try {
        await deleteDriverExpense(expense.id);
        uni.showToast({ title: "已删除", icon: "success" });
        await refreshDetail();
      } catch (error) {
        uni.showToast({ title: getApiErrorMessage(error, "删除失败"), icon: "none" });
      }
    },
  });
}

async function handlePrimaryAction() {
  if (trip.value.canStart) {
    try {
      await startDriverTrip(trip.value.id);
      uni.showToast({ title: "已开始", icon: "success" });
      await refreshDetail();
    } catch (error) {
      uni.showToast({ title: getApiErrorMessage(error, "操作失败"), icon: "none" });
    }
    return;
  }

  uni.navigateTo({ url: `/pages/submit/index?tripId=${trip.value.id}` });
}
</script>

<style scoped>
.status-inline {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  padding: 8px 10px;
  border-radius: 999px;
  background: rgba(255, 180, 84, 0.16);
  color: #996014;
  font-size: 14px;
  font-weight: 600;
  line-height: 16px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #ffb454;
}

.detail-content {
  display: grid;
  gap: 18px;
}

.trip-summary {
  position: relative;
  padding: 18px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(244, 248, 255, 0.96)),
    #ffffff;
}

.summary-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.summary-head > view:first-child {
  min-width: 0;
}

.summary-head .driver-muted {
  display: block;
  margin-top: 4px;
}

.trip-no {
  align-self: flex-start;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(18, 98, 184, 0.1);
  color: var(--driver-primary-2);
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
}

.route-card {
  display: flex;
  gap: 14px;
  padding: 16px;
  border-radius: 20px;
  background: #f4f8ff;
}

.route-icons {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 2px;
}

.route-icons .material-symbols-outlined {
  font-size: 20px;
}

.origin {
  color: var(--driver-primary-2);
}

.destination {
  color: var(--driver-accent);
}

.route-line {
  width: 1px;
  height: 16px;
  margin: 4px 0;
  background: rgba(18, 98, 184, 0.24);
}

.route-copy {
  display: grid;
  flex: 1;
  gap: 12px;
  min-width: 0;
}

.route-stop {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 58px;
  margin: 0;
  padding: 8px 10px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.72);
  text-align: left;
}

.route-stop-copy {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 3px;
}

.route-place {
  display: block;
  color: var(--driver-ink);
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
  overflow-wrap: anywhere;
}

.route-action {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid rgba(18, 98, 184, 0.16);
  border-radius: 999px;
  background: rgba(18, 98, 184, 0.09);
  color: var(--driver-primary);
}

.route-action .material-symbols-outlined {
  font-size: 18px;
}

.expenses-section,
.note-section {
  display: grid;
  gap: 16px;
}

.section-head,
.expense-main,
.action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.section-head,
.expense-main {
  flex-wrap: wrap;
}

.expense-list {
  display: grid;
  gap: 12px;
}

.expense-item {
  display: flex;
  gap: 14px;
  align-items: center;
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.78);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: var(--driver-soft-shadow);
}

.expense-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 16px;
  background: #eef4ff;
  color: var(--driver-primary-2);
}

.expense-body {
  flex: 1;
  min-width: 0;
}

.expense-type {
  color: var(--driver-ink);
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
  overflow-wrap: anywhere;
}

.expense-amount {
  color: var(--driver-primary);
  font-family: "Hanken Grotesk", Inter, sans-serif;
  font-size: 20px;
  font-weight: 600;
  line-height: 28px;
}

.expense-note {
  display: block;
  margin: 4px 0 8px;
  color: var(--driver-muted);
  font-size: 14px;
  line-height: 20px;
  overflow-wrap: anywhere;
}

.receipt-box {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  padding: 0 10px;
  border: 1px solid var(--driver-border);
  border-radius: 999px;
  color: var(--driver-muted);
  font-size: 12px;
  line-height: 16px;
  max-width: 100%;
}

.receipt-box text:last-child {
  min-width: 0;
  overflow-wrap: anywhere;
}

.receipt-box .material-symbols-outlined {
  font-size: 18px;
}

.receipt-box.missing {
  border-style: dashed;
  background: #fff7ec;
  color: #996014;
}

.receipt-preview-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.receipt-preview {
  position: relative;
  display: block;
  width: 72px;
  height: 72px;
  overflow: hidden;
  border: 1px solid rgba(209, 219, 234, 0.9);
  border-radius: 16px;
  background: #f4f8ff;
  box-shadow: 0 8px 18px rgba(16, 39, 74, 0.1);
}

.receipt-preview-image {
  display: block;
  width: 72px;
  height: 72px;
  border-radius: 16px;
  background: #eef4ff;
}

.receipt-preview-mask {
  position: absolute;
  right: 4px;
  bottom: 4px;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(11, 47, 91, 0.72);
  color: #ffffff;
  font-size: 10px;
  font-weight: 700;
  line-height: 14px;
}

.expense-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.expense-actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 32px;
  padding: 0 10px;
  border-radius: 999px;
  background: #eef4ff;
  color: var(--driver-primary);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.2;
}

.expense-actions button.danger {
  background: rgba(194, 59, 54, 0.1);
  color: var(--driver-red);
}

.expense-actions .material-symbols-outlined {
  font-size: 16px;
}

.add-expense {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 58px;
  border: 1px dashed rgba(18, 98, 184, 0.36);
  border-radius: 20px;
  background: rgba(238, 244, 255, 0.72);
  color: var(--driver-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.2;
}

.note-input {
  min-height: 88px;
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.78);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.94);
  color: var(--driver-ink);
  font-size: 16px;
  line-height: 24px;
  box-shadow: var(--driver-soft-shadow);
}

.note-input text {
  overflow-wrap: anywhere;
}

.driver-bottom-action {
  padding: 16px;
}

.action-row {
  align-items: stretch;
  flex-wrap: wrap;
}

.driver-secondary-button {
  flex: 1 1 128px;
  gap: 8px;
}

.submit-button {
  flex: 2 1 176px;
  gap: 8px;
}

@media (max-width: 340px) {
  .expense-item {
    gap: 12px;
    padding: 14px;
  }

  .expense-icon {
    width: 40px;
    height: 40px;
  }
}
</style>
