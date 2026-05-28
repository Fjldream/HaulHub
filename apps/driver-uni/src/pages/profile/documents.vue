<template>
  <view class="driver-page">
    <view class="driver-topbar">
      <button class="driver-icon-button" @tap="goBack">
        <text class="material-symbols-outlined">arrow_back</text>
      </button>
      <text class="driver-title">证件管理</text>
    </view>

    <view class="driver-content page-content">
      <section class="driver-card notice-card">
        <text class="material-symbols-outlined">verified</text>
        <view>
          <text>证件状态正常</text>
          <text>调度后台审核通过后，证件状态会同步到这里。</text>
        </view>
      </section>

      <section class="document-list">
        <view v-for="document in documents" :key="document.name" class="driver-card document-card">
          <view class="document-icon">
            <text class="material-symbols-outlined">{{ document.icon }}</text>
          </view>
          <view class="document-main">
            <text class="document-title">{{ document.name }}</text>
            <text class="document-meta">{{ document.meta }}</text>
          </view>
          <text :class="['document-status', document.warning ? 'warning' : '']">{{ document.status }}</text>
        </view>
      </section>
    </view>
  </view>
</template>

<script setup lang="ts">
const documents = [
  {
    name: "驾驶证",
    meta: "有效期至 2028-05-26",
    status: "正常",
    icon: "badge",
    warning: false,
  },
  {
    name: "从业资格证",
    meta: "30 天后到期",
    status: "待更新",
    icon: "assignment_ind",
    warning: true,
  },
  {
    name: "车辆通行备案",
    meta: "随绑定车辆自动同步",
    status: "已同步",
    icon: "fact_check",
    warning: false,
  },
];

function goBack() {
  uni.navigateBack();
}
</script>

<style scoped>
.page-content,
.document-list {
  display: grid;
  gap: 14px;
}

.notice-card {
  display: flex;
  gap: 14px;
  padding: 18px;
  background: rgba(31, 143, 97, 0.08);
  color: var(--driver-green);
}

.notice-card > .material-symbols-outlined {
  font-size: 30px;
}

.notice-card view {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.notice-card text:nth-child(1) {
  font-size: 17px;
  font-weight: 800;
}

.notice-card text:nth-child(2) {
  color: var(--driver-muted);
  font-size: 13px;
  line-height: 20px;
}

.document-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
}

.document-icon {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 16px;
  background: #eef4ff;
  color: var(--driver-primary-2);
}

.document-main {
  display: grid;
  flex: 1;
  gap: 4px;
  min-width: 0;
}

.document-title {
  color: var(--driver-primary);
  font-size: 16px;
  font-weight: 800;
}

.document-meta {
  color: var(--driver-muted);
  font-size: 13px;
  overflow-wrap: anywhere;
}

.document-status {
  flex: 0 0 auto;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(31, 143, 97, 0.12);
  color: var(--driver-green);
  font-size: 12px;
  font-weight: 800;
}

.document-status.warning {
  background: rgba(255, 180, 84, 0.18);
  color: #996014;
}
</style>
