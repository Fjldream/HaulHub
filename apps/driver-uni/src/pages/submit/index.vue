<template>
  <view class="driver-page">
    <view class="driver-topbar">
      <button class="driver-icon-button" @tap="goBack">
        <AppIcon name="arrow_back" />
      </button>
      <text class="driver-title">提交小票</text>
    </view>

    <view class="driver-content submit-content">
      <section class="driver-card confirm-card">
        <view class="confirm-icon">
          <AppIcon name="receipt_long" />
        </view>
        <text class="driver-heading">小票提交前确认</text>
        <text class="driver-muted">请确认费用和必传票据。提交后会计开始审核前仍可修改。</text>

        <view class="summary-row">
          <text class="driver-label">票据状态</text>
          <text class="total">{{ trip.missingItems.length ? "待补充" : "已完整" }}</text>
        </view>

        <view v-if="trip.missingItems.length" class="missing-box">
          <text class="box-title">缺少项目</text>
          <text v-for="item in trip.missingItems" :key="item">{{ item }}</text>
        </view>
        <view v-else class="ok-box">
          <AppIcon name="check_circle" />
          <text>票据完整，可以提交</text>
        </view>
      </section>
    </view>

    <view class="driver-bottom-action">
      <button class="driver-primary-button submit-button" :disabled="submitDisabled" @tap="submitTrip">
        <AppIcon name="check_circle" />
        <text>{{ submitting ? "提交中..." : "提交小票" }}</text>
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { onPullDownRefresh } from "@dcloudio/uni-app";
import {
  fetchDriverTripDetail,
  getApiErrorMessage,
  requireDriverSession,
  submitDriverTrip,
  type DriverTrip,
} from "@/api/client";
import { finishPullRefresh } from "@/utils/pull-refresh";

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
const tripId = ref("");
const submitting = ref(false);
const submitDisabled = computed(
  () => submitting.value || !trip.value.canSubmit || trip.value.missingItems.length > 0,
);

onMounted(async () => {
  if (!requireDriverSession()) return;
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1] as { options?: { tripId?: string } };
  tripId.value = currentPage.options?.tripId ?? tripId.value;
  if (!tripId.value) {
    uni.showToast({ title: "缺少趟次 ID", icon: "none" });
    return;
  }

  try {
    const detail = await fetchDriverTripDetail(tripId.value);
    trip.value = detail.trip;
  } catch (error) {
    uni.showToast({ title: getApiErrorMessage(error, "小票加载失败"), icon: "none" });
  }
});

onPullDownRefresh(() => {
  void finishPullRefresh(async () => {
    if (!tripId.value) return;
    try {
      const detail = await fetchDriverTripDetail(tripId.value);
      trip.value = detail.trip;
    } catch (error) {
      uni.showToast({ title: getApiErrorMessage(error, "小票加载失败"), icon: "none" });
    }
  });
});

function goBack() {
  uni.navigateBack();
}

async function submitTrip() {
  if (submitDisabled.value) {
    return;
  }

  submitting.value = true;
  try {
    await submitDriverTrip(tripId.value);
    uni.showToast({ title: "已提交", icon: "success" });
    uni.redirectTo({ url: "/pages/trips/index" });
  } catch (error) {
    uni.showToast({ title: getApiErrorMessage(error, "提交失败"), icon: "none" });
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.submit-content {
  display: grid;
  align-items: start;
}

.confirm-card {
  display: grid;
  gap: 16px;
  padding: 22px 18px 18px;
}

.confirm-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 18px;
  background: #eef4ff;
  color: var(--driver-primary-2);
}

.confirm-icon .material-symbols-outlined {
  font-size: 32px;
}

.summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--driver-border);
}

.total {
  color: var(--driver-primary);
  font-family: "Hanken Grotesk", Inter, sans-serif;
  font-size: 24px;
  font-weight: 700;
  line-height: 32px;
}

.missing-box,
.ok-box {
  display: grid;
  gap: 8px;
  padding: 14px;
  border-radius: 18px;
  font-size: 14px;
  line-height: 20px;
}

.missing-box {
  border: 1px solid rgba(194, 59, 54, 0.16);
  background: rgba(194, 59, 54, 0.08);
  color: var(--driver-red);
}

.ok-box {
  display: flex;
  align-items: center;
  border: 1px solid rgba(31, 143, 97, 0.16);
  background: rgba(31, 143, 97, 0.08);
  color: var(--driver-green);
}

.ok-box text:last-child,
.missing-box text {
  min-width: 0;
  overflow-wrap: anywhere;
}

.box-title {
  font-weight: 700;
}

.driver-bottom-action {
  padding: 16px;
}

.submit-button {
  gap: 8px;
  width: 100%;
}
</style>
