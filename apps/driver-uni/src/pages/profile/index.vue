<template>
  <view class="driver-page">
    <view class="driver-topbar">
      <text class="driver-brand">拉货小票</text>
      <view class="top-spacer" />
      <button class="driver-icon-button notification-button" @tap="goNotifications">
        <text class="material-symbols-outlined">notifications</text>
        <text v-if="unreadNoticeCount > 0" class="notice-badge">{{ unreadNoticeCount > 9 ? "9+" : unreadNoticeCount }}</text>
      </button>
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
            <text class="material-symbols-outlined">group</text>
            <text>拉货小票 华东车队</text>
          </view>
        </view>
        <text class="material-symbols-outlined chevron">chevron_right</text>
      </section>

      <section class="stats-grid">
        <view class="income-card">
          <text class="income-label">本月预计收入 (CNY)</text>
          <text class="income-value">¥ 18,450.00</text>
          <view class="income-meta">
            <text>较上月 +12.4%</text>
            <text>结算中: ¥2,100</text>
          </view>
        </view>
        <view class="stat-card">
          <text class="driver-label">本月累计趟次</text>
          <view class="stat-value"><text>42</text><text>趟</text></view>
        </view>
        <view class="stat-card">
          <text class="driver-label">安全行驶里程</text>
          <view class="stat-value"><text>3,892</text><text>KM</text></view>
        </view>
      </section>

      <section class="driver-card menu-card">
        <button class="menu-item" @tap="goVehicle">
          <view class="menu-icon"><text class="material-symbols-outlined">local_shipping</text></view>
          <view class="menu-copy">
            <text>我的车辆</text>
            <text>{{ primaryVehicle.plateNumber }} ({{ primaryVehicle.vehicleType ?? "车辆类型未维护" }})</text>
          </view>
          <text class="material-symbols-outlined">chevron_right</text>
        </button>
        <button class="menu-item" @tap="goDocuments">
          <view class="menu-icon"><text class="material-symbols-outlined">badge</text></view>
          <view class="menu-copy">
            <text>证件管理</text>
            <text>驾照正常，从业资格 30 天后到期</text>
          </view>
          <text class="material-symbols-outlined">chevron_right</text>
        </button>
        <button class="menu-item" @tap="goIncome">
          <view class="menu-icon"><text class="material-symbols-outlined">payments</text></view>
          <view class="menu-copy">
            <text>收入明细</text>
            <text>查看历史运单与工资结转</text>
          </view>
          <text class="material-symbols-outlined">chevron_right</text>
        </button>
        <button class="menu-item" @tap="goSettings">
          <view class="menu-icon"><text class="material-symbols-outlined">settings</text></view>
          <view class="menu-copy">
            <text>系统设置</text>
            <text>隐私、通知及版本信息</text>
          </view>
          <text class="material-symbols-outlined">chevron_right</text>
        </button>
      </section>

      <section class="help-card" @tap="goHelp">
        <text class="material-symbols-outlined">headset_mic</text>
        <view>
          <text>需要帮助？</text>
          <text>联系车队调度员或在线客服</text>
        </view>
        <text class="material-symbols-outlined help-chevron">chevron_right</text>
      </section>
    </view>

    <view class="driver-bottom-nav">
      <button class="driver-nav-item" @tap="goTrips">
        <text class="material-symbols-outlined">local_shipping</text>
        <text>我的小票</text>
      </button>
      <button class="driver-nav-item active">
        <text class="material-symbols-outlined">person</text>
        <text>个人中心</text>
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import {
  fetchDriverProfile,
  fetchDriverTrips,
  getApiErrorMessage,
  requireDriverSession,
  type DriverProfile,
} from "@/api/client";
import { countUnreadDriverNotices } from "@/utils/notifications";

const profile = ref<DriverProfile>({
  id: "",
  name: "-",
  phone: "-",
  status: "active",
  boundVehicles: [],
});
const unreadNoticeCount = ref(0);

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

async function refreshUnreadNoticeCount() {
  try {
    const trips = await fetchDriverTrips();
    unreadNoticeCount.value = countUnreadDriverNotices(trips);
  } catch {
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
.top-spacer {
  flex: 1;
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
  letter-spacing: 0.05em;
  line-height: 16px;
}

.income-value {
  font-family: "Hanken Grotesk", Inter, sans-serif;
  font-size: 32px;
  font-weight: 700;
  line-height: 40px;
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
