<template>
  <view class="driver-page">
    <view class="driver-topbar">
      <button class="driver-icon-button" @tap="goBack">
        <AppIcon name="arrow_back" />
      </button>
      <text class="driver-title">通知中心</text>
    </view>

    <view class="driver-content page-content">
      <section class="driver-card summary-card">
        <view>
          <text>未读提醒</text>
          <text>{{ unreadCount }}</text>
        </view>
        <button class="read-button" @tap="markAllRead">全部已读</button>
      </section>

      <section class="notice-list">
        <view
          v-for="notice in notices"
          :key="notice.id"
          :class="['driver-card', 'notice-card', notice.read ? 'read' : '']"
          @tap="markRead(notice.id)"
        >
          <view class="notice-icon">
            <AppIcon :name="notice.icon" />
          </view>
          <view class="notice-main">
            <view class="notice-title-row">
              <text class="notice-title">{{ notice.title }}</text>
              <text v-if="!notice.read" class="unread-dot" />
            </view>
            <text class="notice-body">{{ notice.body }}</text>
            <text class="notice-time">{{ notice.time }}</text>
          </view>
        </view>
        <view v-if="notices.length === 0" class="driver-card empty-card">
          <AppIcon name="notifications_off" />
          <text>暂无提醒</text>
          <text>小票更新、缺票和审核结果会显示在这里。</text>
        </view>
      </section>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { onPullDownRefresh } from "@dcloudio/uni-app";
import { fetchDriverTrips, getApiErrorMessage, requireDriverSession } from "@/api/client";
import {
  buildDriverNotices,
  loadDriverNotificationSettings,
  loadReadNoticeIds,
  saveReadNoticeIds,
  type DriverNotice,
} from "@/utils/notifications";
import { finishPullRefresh } from "@/utils/pull-refresh";

const notices = ref<DriverNotice[]>([]);
const unreadCount = computed(() => notices.value.filter((notice) => !notice.read).length);

onMounted(async () => {
  if (!requireDriverSession()) return;
  try {
    const trips = await fetchDriverTrips();
    notices.value = buildDriverNotices(
      trips,
      loadDriverNotificationSettings(),
      loadReadNoticeIds(),
    );
  } catch (error) {
    uni.showToast({ title: getApiErrorMessage(error, "通知加载失败"), icon: "none" });
  }
});

onPullDownRefresh(() => {
  void finishPullRefresh(async () => {
    try {
      const trips = await fetchDriverTrips();
      notices.value = buildDriverNotices(
        trips,
        loadDriverNotificationSettings(),
        loadReadNoticeIds(),
      );
    } catch (error) {
      uni.showToast({ title: getApiErrorMessage(error, "通知加载失败"), icon: "none" });
    }
  });
});

function saveReadIds() {
  saveReadNoticeIds(
    notices.value.filter((notice) => notice.read).map((notice) => notice.id),
  );
}

function markRead(id: string) {
  const notice = notices.value.find((item) => item.id === id);
  if (notice) {
    notice.read = true;
    saveReadIds();
  }
}

function markAllRead() {
  notices.value = notices.value.map((notice) => ({ ...notice, read: true }));
  saveReadIds();
  uni.showToast({ title: "已全部标为已读", icon: "none" });
}

function goBack() {
  uni.navigateBack();
}
</script>

<style scoped>
.page-content,
.notice-list {
  display: grid;
  gap: 14px;
}

.summary-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px;
}

.summary-card view {
  display: grid;
  gap: 4px;
}

.summary-card view text:first-child {
  color: var(--driver-muted);
  font-size: 13px;
  font-weight: 700;
}

.summary-card view text:last-child {
  color: var(--driver-primary);
  font-size: 30px;
  font-weight: 800;
  line-height: 34px;
}

.read-button {
  display: flex !important;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  padding: 0 14px;
  border-radius: 999px;
  background: #eef4ff;
  color: var(--driver-primary-2);
  font-size: 13px;
  font-weight: 800;
}

.notice-card {
  display: flex;
  gap: 14px;
  padding: 16px;
}

.notice-card.read {
  opacity: 0.72;
}

.notice-icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 16px;
  background: #eef4ff;
  color: var(--driver-primary-2);
}

.notice-main {
  display: grid;
  flex: 1;
  gap: 5px;
  min-width: 0;
}

.notice-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.notice-title {
  color: var(--driver-primary);
  font-size: 16px;
  font-weight: 800;
}

.unread-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--driver-red);
}

.notice-body {
  color: var(--driver-ink);
  font-size: 14px;
  line-height: 20px;
  overflow-wrap: anywhere;
}

.notice-time {
  color: var(--driver-muted);
  font-size: 12px;
}

.empty-card {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 34px 18px;
  color: var(--driver-muted);
  text-align: center;
}

.empty-card .material-symbols-outlined {
  color: var(--driver-primary-2);
  font-size: 44px;
}

.empty-card text:nth-child(2) {
  color: var(--driver-ink);
  font-size: 18px;
  font-weight: 800;
}
</style>
