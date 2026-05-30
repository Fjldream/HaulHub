<template>
  <view class="driver-page">
    <view class="driver-topbar">
      <button class="driver-icon-button" @tap="goBack">
        <AppIcon name="arrow_back" />
      </button>
      <text class="driver-title">系统设置</text>
    </view>

    <view class="driver-content page-content">
      <section class="driver-card settings-card">
        <view class="setting-row">
          <view>
            <text>新小票提醒</text>
            <text>调度派单、退回、审核完成时提醒</text>
          </view>
          <switch :checked="newTicketNotify" color="#1262b8" @change="onNewTicketNotifyChange" />
        </view>
        <view class="setting-row">
          <view>
            <text>费用缺票提醒</text>
            <text>提交前提醒缺少票据的费用项</text>
          </view>
          <switch :checked="missingReceiptNotify" color="#1262b8" @change="onMissingReceiptNotifyChange" />
        </view>
      </section>

      <section class="driver-card version-card">
        <view>
          <text>拉货小票司机端</text>
          <text>版本 0.1.0</text>
        </view>
        <AppIcon name="receipt_long" />
      </section>

      <button class="logout-button" @tap="logout">
        <AppIcon name="logout" />
        <text>退出登录</text>
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { onPullDownRefresh } from "@dcloudio/uni-app";
import { logoutDriver } from "@/api/client";
import { driverSettingsStorageKey } from "@/utils/notifications";
import { finishPullRefresh } from "@/utils/pull-refresh";

const newTicketNotify = ref(true);
const missingReceiptNotify = ref(true);

onMounted(() => {
  loadSettings();
});

onPullDownRefresh(() => {
  void finishPullRefresh(loadSettings);
});

function loadSettings() {
  try {
    const settings = uni.getStorageSync(driverSettingsStorageKey) as
      | { newTicketNotify?: boolean; missingReceiptNotify?: boolean }
      | "";
    if (settings) {
      newTicketNotify.value = settings.newTicketNotify ?? true;
      missingReceiptNotify.value = settings.missingReceiptNotify ?? true;
    }
  } catch {
    newTicketNotify.value = true;
    missingReceiptNotify.value = true;
  }
}

function saveSettings() {
  uni.setStorageSync(driverSettingsStorageKey, {
    newTicketNotify: newTicketNotify.value,
    missingReceiptNotify: missingReceiptNotify.value,
  });
  uni.showToast({ title: "设置已保存", icon: "none" });
}

function onNewTicketNotifyChange(event: { detail: { value: boolean } }) {
  newTicketNotify.value = event.detail.value;
  saveSettings();
}

function onMissingReceiptNotifyChange(event: { detail: { value: boolean } }) {
  missingReceiptNotify.value = event.detail.value;
  saveSettings();
}

function goBack() {
  uni.navigateBack();
}

function logout() {
  uni.showModal({
    title: "退出登录",
    content: "确认退出当前司机账号？",
    confirmColor: "#c23b36",
    success: (result) => {
      if (!result.confirm) {
        return;
      }
      logoutDriver();
      uni.reLaunch({ url: "/pages/login/index" });
    },
  });
}
</script>

<style scoped>
.page-content {
  display: grid;
  gap: 14px;
}

.settings-card,
.version-card {
  display: grid;
}

.setting-row,
.version-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px;
}

.setting-row + .setting-row {
  border-top: 1px solid var(--driver-border);
}

.setting-row view,
.version-card view {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.setting-row view text:first-child,
.version-card view text:first-child {
  color: var(--driver-primary);
  font-size: 16px;
  font-weight: 800;
}

.setting-row view text:last-child,
.version-card view text:last-child {
  color: var(--driver-muted);
  font-size: 13px;
  line-height: 20px;
  overflow-wrap: anywhere;
}

.version-card > .material-symbols-outlined {
  color: var(--driver-primary-2);
  font-size: 34px;
}

.logout-button {
  display: flex !important;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 56px;
  border-radius: 18px;
  background: rgba(194, 59, 54, 0.1);
  color: var(--driver-red);
  font-size: 16px;
  font-weight: 800;
}
</style>
