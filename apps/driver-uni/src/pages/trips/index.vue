<template>
  <view class="driver-page">
    <view class="driver-topbar">
      <button class="driver-icon-button" @tap="goBack">
        <text class="material-symbols-outlined">arrow_back</text>
      </button>
      <text class="driver-brand">拉货小票</text>
      <button class="driver-icon-button notification-button" @tap="goNotifications">
        <text class="material-symbols-outlined">notifications</text>
        <text v-if="unreadNoticeCount > 0" class="notice-badge">{{ unreadNoticeCount > 9 ? "9+" : unreadNoticeCount }}</text>
      </button>
    </view>

    <view class="trip-hero">
      <view>
        <text class="hero-kicker">今日任务</text>
        <text class="hero-title">{{ filteredTrips.length }} 张{{ activeLabel }}小票</text>
      </view>
      <view class="hero-meter">
        <text>{{ trips.length }}</text>
        <text>全部</text>
      </view>
    </view>

    <view class="tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        :class="['tab-button', activeTab === tab.key ? 'active' : '']"
        @tap="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </view>

    <view class="trip-list">
      <TripCard v-for="trip in filteredTrips" :key="trip.id" :trip="trip" />
      <view v-if="filteredTrips.length === 0" class="empty-state">
        <text class="material-symbols-outlined">local_shipping</text>
        <text>暂无{{ activeLabel }}小票</text>
        <text>调度派单后会自动生成拉货小票</text>
      </view>
    </view>

    <view class="driver-bottom-nav">
      <button class="driver-nav-item active">
        <text class="material-symbols-outlined">local_shipping</text>
        <text>我的小票</text>
      </button>
      <button class="driver-nav-item" @tap="goProfile">
        <text class="material-symbols-outlined">person</text>
        <text>个人中心</text>
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import TripCard from "@/components/TripCard.vue";
import { fetchDriverTrips, getApiErrorMessage, requireDriverSession, type DriverTrip } from "@/api/client";
import { countUnreadDriverNotices } from "@/utils/notifications";

const tabs = [
  { key: "assigned", label: "待出车" },
  { key: "in_progress", label: "进行中" },
  { key: "submitted", label: "已提交" },
  { key: "completed", label: "已完成" },
];

const trips = ref<DriverTrip[]>([]);
const activeTab = ref("assigned");
const unreadNoticeCount = ref(0);
const activeLabel = computed(() => tabs.find((tab) => tab.key === activeTab.value)?.label ?? "");
const filteredTrips = computed(() =>
  trips.value.filter((trip) => statusKey(trip) === activeTab.value),
);

onMounted(async () => {
  if (!requireDriverSession()) return;
  await loadTrips();
});

onShow(() => {
  refreshUnreadNoticeCount();
});

function refreshUnreadNoticeCount() {
  unreadNoticeCount.value = countUnreadDriverNotices(trips.value);
}

async function loadTrips() {
  try {
    trips.value = await fetchDriverTrips();
    activeTab.value = trips.value[0] ? statusKey(trips.value[0]) : "assigned";
    refreshUnreadNoticeCount();
  } catch (error) {
    trips.value = [];
    refreshUnreadNoticeCount();
    uni.showToast({ title: getApiErrorMessage(error, "趟次加载失败"), icon: "none" });
  }
}

function statusKey(trip: DriverTrip) {
  if (trip.rawStatus) return trip.rawStatus;
  const labels: Record<string, string> = {
    待出车: "assigned",
    进行中: "in_progress",
    已提交: "submitted",
    审核中: "submitted",
    已完成: "completed",
  };
  return labels[trip.status] ?? "assigned";
}

function goBack() {
  uni.navigateBack();
}

function goProfile() {
  uni.redirectTo({ url: "/pages/profile/index" });
}

function goNotifications() {
  uni.navigateTo({ url: "/pages/profile/notifications" });
}
</script>

<style scoped>
.driver-page {
  padding-bottom: calc(var(--driver-bottom-height) + 16px);
}

.notification-button {
  position: relative;
}

.notice-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border: 2px solid #ffffff;
  border-radius: 999px;
  background: var(--driver-red);
  color: #ffffff;
  font-size: 10px;
  font-weight: 800;
  line-height: 12px;
}

.trip-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin: calc(var(--driver-topbar-height) + 16px) var(--driver-gutter) 12px;
  padding: 18px;
  border-radius: 26px;
  background:
    linear-gradient(135deg, rgba(11, 47, 91, 0.96), rgba(18, 98, 184, 0.88)),
    #0b2f5b;
  color: #ffffff;
  box-shadow: var(--driver-shadow);
}

.hero-kicker,
.hero-title,
.hero-meter text {
  display: block;
}

.hero-kicker {
  color: rgba(255, 255, 255, 0.72);
  font-size: 13px;
  font-weight: 700;
  line-height: 18px;
}

.hero-title {
  margin-top: 6px;
  font-family: "Hanken Grotesk", Inter, sans-serif;
  font-size: 26px;
  font-weight: 800;
  line-height: 32px;
}

.hero-meter {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 72px;
  height: 72px;
  border: 1px solid rgba(255, 255, 255, 0.36);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.14);
}

.hero-meter text:first-child {
  font-family: "Hanken Grotesk", Inter, sans-serif;
  font-size: 24px;
  font-weight: 800;
  line-height: 24px;
}

.hero-meter text:last-child {
  color: rgba(255, 255, 255, 0.72);
  font-size: 12px;
}

.tabs {
  position: sticky;
  top: var(--driver-topbar-height);
  z-index: 40;
  display: flex;
  gap: 8px;
  width: 100%;
  min-height: 48px;
  overflow-x: auto;
  padding: 6px var(--driver-gutter) 8px;
  border-bottom: 0;
  background: rgba(248, 251, 255, 0.9);
  backdrop-filter: blur(16px);
  white-space: nowrap;
  scrollbar-width: none;
}

.tabs::-webkit-scrollbar {
  display: none;
}

.tab-button {
  display: flex !important;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  flex: 1 1 0;
  min-width: 0;
  max-width: none;
  margin: 0;
  padding: 0 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.82);
  color: var(--driver-muted);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.2 !important;
  text-align: center;
}

.tab-button {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab-button.active {
  background: linear-gradient(135deg, var(--driver-primary), var(--driver-primary-2));
  color: #ffffff;
  box-shadow: 0 6px 14px rgba(18, 98, 184, 0.18);
}

.trip-list {
  display: grid;
  gap: 16px;
  padding: 16px var(--driver-gutter) calc(var(--driver-bottom-height) + 32px);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 260px;
  padding: 36px 20px;
  border: 1px dashed var(--driver-border);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.68);
  color: var(--driver-muted);
  font-size: 14px;
}

.empty-state text:nth-child(2) {
  color: var(--driver-ink);
  font-size: 17px;
  font-weight: 800;
}

.empty-state .material-symbols-outlined {
  color: var(--driver-primary-2);
  font-size: 52px;
}

@media (max-width: 340px) {
  .tabs {
    gap: 6px;
  }

  .tab-button {
    padding: 0 12px;
    font-size: 13px;
  }
}

@media (min-width: 520px) {
  .tabs {
    justify-content: center;
  }

  .tab-button {
    flex: 0 0 168px;
  }
}

@media (max-width: 360px) {
  .trip-hero {
    align-items: flex-start;
    margin-top: calc(var(--driver-topbar-height) + 12px);
    padding: 16px;
  }

  .hero-title {
    font-size: 22px;
    line-height: 28px;
  }

  .hero-meter {
    width: 62px;
    height: 62px;
  }
}
</style>
