<template>
  <view class="driver-page">
    <view class="driver-topbar">
      <view class="top-title-group">
        <text class="driver-brand">拉货小票</text>
        <button class="driver-icon-button notification-button" @tap="goNotifications">
          <AppIcon name="notifications" />
          <text v-if="unreadNoticeCount > 0" class="notice-badge">{{ unreadNoticeCount > 9 ? "9+" : unreadNoticeCount }}</text>
        </button>
      </view>
      <view class="capsule-spacer" />
    </view>

    <view class="driver-content profile-content">
      <section class="driver-card profile-card">
        <view class="avatar">{{ profile.name.slice(0, 1) }}</view>
        <view class="profile-main">
          <view class="name-row">
            <text class="driver-heading">{{ profile.name }}</text>
            <text class="level-chip">认证司机</text>
          </view>
          <text class="driver-muted">{{ profile.phone }}</text>
          <view class="team-row">
            <AppIcon name="group" />
            <text>拉货小票 {{ profile.teamName ?? "未分配团队" }}</text>
          </view>
        </view>
        <AppIcon class="chevron" name="chevron_right" />
      </section>

      <section class="stats-grid">
        <view class="income-card">
          <text class="income-label">本月小票进度</text>
          <text class="income-value">{{ completedTripCount }} 张已完成</text>
          <view class="income-meta">
            <text>待提交 {{ submittedTripCount }} 张</text>
            <text>进行中 {{ inProgressTripCount }} 张</text>
          </view>
        </view>
        <view class="stat-card">
          <text class="driver-label">本月累计趟次</text>
          <view class="stat-value"><text>{{ monthlyTripCount }}</text><text>趟</text></view>
        </view>
        <view class="stat-card">
          <text class="driver-label">司机总趟次</text>
          <view class="stat-value"><text>{{ totalTripCount }}</text><text>趟</text></view>
        </view>
      </section>

      <section class="driver-card menu-card">
        <button class="menu-item" @tap="goVehicle">
          <view class="menu-icon"><AppIcon name="local_shipping" /></view>
          <view class="menu-copy">
            <text>我的车辆</text>
            <text>{{ primaryVehicle.plateNumber }} ({{ primaryVehicle.vehicleType ?? "车辆类型未维护" }})</text>
          </view>
          <AppIcon name="chevron_right" />
        </button>
        <button class="menu-item" @tap="goDocuments">
          <view class="menu-icon"><AppIcon name="badge" /></view>
          <view class="menu-copy">
            <text>证件管理</text>
            <text>驾照正常，从业资格 30 天后到期</text>
          </view>
          <AppIcon name="chevron_right" />
        </button>
        <button class="menu-item" @tap="goIncome">
          <view class="menu-icon"><AppIcon name="payments" /></view>
          <view class="menu-copy">
            <text>小票明细</text>
            <text>查看历史小票、状态和票据记录</text>
          </view>
          <AppIcon name="chevron_right" />
        </button>
        <button class="menu-item" @tap="goSettings">
          <view class="menu-icon"><AppIcon name="settings" /></view>
          <view class="menu-copy">
            <text>系统设置</text>
            <text>隐私、通知及版本信息</text>
          </view>
          <AppIcon name="chevron_right" />
        </button>
      </section>

      <section class="help-card" @tap="goHelp">
        <AppIcon name="headset_mic" />
        <view>
          <text>需要帮助？</text>
          <text>联系车队调度员或在线客服</text>
        </view>
        <AppIcon class="help-chevron" name="chevron_right" />
      </section>
    </view>

    <view class="driver-bottom-nav">
      <button class="driver-nav-item" @tap="goTrips">
        <AppIcon name="local_shipping" />
        <text>我的小票</text>
      </button>
      <button class="driver-nav-item active">
        <AppIcon name="person" />
        <text>个人中心</text>
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { onPullDownRefresh, onShow } from "@dcloudio/uni-app";
import {
  fetchDriverProfile,
  fetchDriverTrips,
  getApiErrorMessage,
  requireDriverSession,
  type DriverProfile,
  type DriverTrip,
} from "@/api/client";
import { fetchUnreadDriverNoticeCount } from "@/utils/notification-service";
import { finishPullRefresh } from "@/utils/pull-refresh";

const profile = ref<DriverProfile>({
  id: "",
  teamId: null,
  teamName: null,
  name: "-",
  phone: "-",
  status: "active",
  boundVehicles: [],
});
const unreadNoticeCount = ref(0);
const trips = ref<DriverTrip[]>([]);

const completedTripCount = computed(() => trips.value.filter((trip) => trip.rawStatus === "completed").length);
const monthlyTripCount = computed(() => {
  const now = new Date();
  return trips.value.filter((trip) => {
    const createdAt = new Date(trip.rawCreatedAt);
    return createdAt.getFullYear() === now.getFullYear() && createdAt.getMonth() === now.getMonth();
  }).length;
});
const totalTripCount = computed(() => trips.value.length);
const submittedTripCount = computed(() =>
  trips.value.filter((trip) => ["submitted", "under_review"].includes(trip.rawStatus)).length,
);
const inProgressTripCount = computed(() => trips.value.filter((trip) => trip.rawStatus === "in_progress").length);

const primaryVehicle = computed(
  () =>
    profile.value.boundVehicles[0] ?? {
      id: "empty",
      plateNumber: "暂无绑定车辆",
      status: "unbound",
      vehicleType: null,
    },
);

onMounted(async () => {
  if (!requireDriverSession()) return;
  await loadProfile();
  await refreshUnreadNoticeCount();
});

onShow(() => {
  refreshUnreadNoticeCount();
});

onPullDownRefresh(() => {
  void finishPullRefresh(async () => {
    await loadProfile();
    await refreshUnreadNoticeCount();
  });
});

async function refreshUnreadNoticeCount() {
  try {
    const [allTrips, count] = await Promise.all([
      fetchDriverTrips(),
      fetchUnreadDriverNoticeCount(),
    ]);
    trips.value = allTrips;
    unreadNoticeCount.value = count;
  } catch {
    trips.value = [];
    unreadNoticeCount.value = 0;
  }
}

async function loadProfile() {
  try {
    profile.value = await fetchDriverProfile();
  } catch (error) {
    uni.showToast({ title: getApiErrorMessage(error, "个人信息加载失败"), icon: "none" });
  }
}

function goTrips() {
  uni.redirectTo({ url: "/pages/trips/index" });
}

function goVehicle() {
  uni.navigateTo({ url: "/pages/profile/vehicle" });
}

function goDocuments() {
  uni.navigateTo({ url: "/pages/profile/documents" });
}

function goIncome() {
  uni.navigateTo({ url: "/pages/profile/income" });
}

function goSettings() {
  uni.navigateTo({ url: "/pages/profile/settings" });
}

function goNotifications() {
  uni.navigateTo({ url: "/pages/profile/notifications" });
}

function goHelp() {
  uni.navigateTo({ url: "/pages/profile/help" });
}
</script>

<style scoped>
.notification-button {
  flex: 0 0 38px;
  width: 38px;
  height: 38px;
  position: relative;
}

.top-title-group {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.top-title-group .driver-brand {
  flex: 0 0 auto;
  white-space: nowrap;
}

.capsule-spacer {
  flex: 1;
  min-width: 0;
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

.profile-content {
  display: grid;
  gap: 18px;
}

.profile-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px;
}

.avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border: 3px solid rgba(255, 255, 255, 0.86);
  border-radius: 24px;
  background: linear-gradient(135deg, var(--driver-primary), var(--driver-primary-2));
  color: #ffffff;
  font-family: "Hanken Grotesk", Inter, sans-serif;
  font-size: 28px;
  font-weight: 700;
}

.profile-main {
  flex: 1;
  min-width: 0;
}

.name-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.level-chip {
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(18, 98, 184, 0.12);
  color: var(--driver-primary-2);
  font-size: 10px;
  font-weight: 700;
}

.team-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  color: var(--driver-muted);
  font-size: 14px;
  line-height: 20px;
  overflow-wrap: anywhere;
}

.team-row .material-symbols-outlined {
  font-size: 16px;
}

.chevron {
  color: var(--driver-muted);
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.income-card {
  position: relative;
  grid-column: 1 / -1;
  display: grid;
  gap: 8px;
  overflow: hidden;
  padding: 16px;
  border-radius: 24px;
  background:
    linear-gradient(135deg, rgba(11, 47, 91, 0.96), rgba(18, 98, 184, 0.9)),
    var(--driver-primary);
  color: #ffffff;
  box-shadow: var(--driver-shadow);
}

.income-label {
  color: rgba(214, 227, 255, 0.9);
  font-size: 14px;
  font-weight: 600;
  line-height: 16px;
}

.income-value {
  font-family: "Hanken Grotesk", Inter, sans-serif;
  font-size: 28px;
  font-weight: 700;
  line-height: 36px;
}

.income-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  color: rgba(255, 255, 255, 0.75);
  font-size: 12px;
}

.income-meta text:first-child {
  padding: 4px 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.2);
}

.stat-card {
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.78);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: var(--driver-soft-shadow);
}

.stat-value {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  margin-top: 8px;
}

.stat-value text:first-child {
  color: var(--driver-primary);
  font-size: 24px;
  font-weight: 700;
  line-height: 32px;
}

.stat-value text:last-child {
  padding-bottom: 4px;
  color: var(--driver-muted);
  font-size: 14px;
}

.menu-item {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 16px;
  padding: 16px;
  border-bottom: 1px solid var(--driver-border);
  background: transparent;
  text-align: left;
}

.menu-item:last-child {
  border-bottom: 0;
}

.menu-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 16px;
  background: #eef4ff;
  color: var(--driver-primary-2);
}

.menu-copy {
  display: grid;
  flex: 1;
  gap: 4px;
  min-width: 0;
}

.menu-copy text:first-child {
  color: var(--driver-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}

.menu-copy text:last-child {
  color: var(--driver-muted);
  font-size: 14px;
  line-height: 20px;
  overflow-wrap: anywhere;
}

.help-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border: 1px solid rgba(255, 180, 84, 0.22);
  border-radius: 22px;
  background: rgba(255, 247, 236, 0.86);
  color: #7a4d12;
}

.help-card:active {
  transform: scale(0.99);
}

.help-card > .material-symbols-outlined {
  color: #996014;
  font-size: 28px;
}

.help-card view {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.help-card text:first-child {
  font-size: 14px;
  font-weight: 600;
}

.help-card text:last-child {
  font-size: 14px;
  opacity: 0.8;
  overflow-wrap: anywhere;
}

.help-chevron {
  margin-left: auto;
  color: #996014;
  font-size: 22px;
}

@media (max-width: 360px) {
  .profile-card {
    align-items: flex-start;
    gap: 12px;
  }

  .avatar {
    width: 64px;
    height: 64px;
    font-size: 24px;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
