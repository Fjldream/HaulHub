<template>
  <view class="driver-page">
    <view class="driver-topbar">
      <button class="driver-icon-button" @tap="goBack">
        <text class="material-symbols-outlined">arrow_back</text>
      </button>
      <text class="driver-title">收入明细</text>
    </view>

    <view class="driver-content page-content">
      <section class="driver-card income-hero">
        <text>本月预计收入</text>
        <text>¥ 18,450.00</text>
        <view>
          <text>{{ completedTrips.length }} 张已完成小票</text>
          <text>结算中 ¥2,100</text>
        </view>
      </section>

      <section class="driver-card summary-card">
        <view>
          <text class="driver-label">全部小票</text>
          <text>{{ trips.length }}</text>
        </view>
        <view>
          <text class="driver-label">待结算</text>
          <text>{{ pendingTrips.length }}</text>
        </view>
        <view>
          <text class="driver-label">已完成</text>
          <text>{{ completedTrips.length }}</text>
        </view>
      </section>

      <section class="income-list">
        <view v-for="trip in trips.slice(0, 8)" :key="trip.id" class="driver-card income-row">
          <view>
            <text class="income-title">{{ trip.plateNumber }}</text>
            <text class="income-meta">{{ trip.loadLocation }} -> {{ trip.unloadLocation }}</text>
          </view>
          <view class="income-right">
            <text>{{ trip.expenseTotal }}</text>
            <text>{{ trip.status }}</text>
          </view>
        </view>
      </section>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { fetchDriverTrips, getApiErrorMessage, requireDriverSession, type DriverTrip } from "@/api/client";

const trips = ref<DriverTrip[]>([]);
const completedTrips = computed(() => trips.value.filter((trip) => trip.rawStatus === "completed"));
const pendingTrips = computed(() =>
  trips.value.filter((trip) => ["submitted", "under_review"].includes(trip.rawStatus)),
);

onMounted(async () => {
  if (!requireDriverSession()) return;
  try {
    trips.value = await fetchDriverTrips();
  } catch (error) {
    uni.showToast({ title: getApiErrorMessage(error, "收入明细加载失败"), icon: "none" });
  }
});

function goBack() {
  uni.navigateBack();
}
</script>

<style scoped>
.page-content {
  display: grid;
  gap: 14px;
}

.income-hero {
  display: grid;
  gap: 8px;
  padding: 20px;
  background: linear-gradient(135deg, var(--driver-primary), var(--driver-primary-2));
  color: #ffffff;
}

.income-hero > text:first-child {
  color: rgba(255, 255, 255, 0.74);
  font-size: 13px;
  font-weight: 700;
}

.income-hero > text:nth-child(2) {
  font-family: "Hanken Grotesk", Inter, sans-serif;
  font-size: 34px;
  font-weight: 800;
  line-height: 40px;
}

.income-hero view,
.summary-card {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.income-hero view text {
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  font-size: 12px;
}

.summary-card {
  justify-content: space-between;
  padding: 16px;
}

.summary-card view {
  display: grid;
  gap: 4px;
  min-width: 86px;
}

.summary-card view > text:last-child {
  color: var(--driver-primary);
  font-size: 24px;
  font-weight: 800;
}

.income-list {
  display: grid;
  gap: 12px;
}

.income-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
}

.income-title,
.income-meta,
.income-right text {
  display: block;
}

.income-title {
  color: var(--driver-primary);
  font-size: 16px;
  font-weight: 800;
}

.income-meta {
  margin-top: 4px;
  color: var(--driver-muted);
  font-size: 13px;
  overflow-wrap: anywhere;
}

.income-right {
  flex: 0 0 auto;
  text-align: right;
}

.income-right text:first-child {
  color: var(--driver-green);
  font-size: 15px;
  font-weight: 800;
}

.income-right text:last-child {
  margin-top: 5px;
  color: var(--driver-muted);
  font-size: 12px;
}
</style>
