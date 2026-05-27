<template>
  <view class="page">
    <view class="card">
      <text class="title">提交前确认</text>
      <text class="subtitle">请确认费用和必传票据。提交后会计开始审核前仍可修改。</text>
      <view class="summary">
        <text>费用合计</text>
        <strong>{{ trip.expenseTotal }}</strong>
      </view>
      <view v-if="trip.missingItems.length" class="missing-box">
        <text class="missing-title">缺少项目</text>
        <text v-for="item in trip.missingItems" :key="item">{{ item }}</text>
      </view>
      <view v-else class="ok-box">票据完整，可以提交</view>
    </view>
    <button class="primary" :disabled="trip.missingItems.length > 0" @tap="submitTrip">
      提交账单
    </button>
  </view>
</template>

<script setup lang="ts">
import { trips } from "@/api/mock";
import { submitDriverTrip } from "@/api/client";

const trip = trips[0];

async function submitTrip() {
  try {
    await submitDriverTrip(trip.id);
    uni.showToast({ title: "已提交", icon: "success" });
    uni.switchTab({ url: "/pages/trips/index" });
  } catch {
    uni.showToast({ title: "提交失败", icon: "none" });
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 16px;
}

.card {
  display: grid;
  gap: 14px;
  padding: 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #ffffff;
}

.title {
  font-size: 20px;
  font-weight: 800;
}

.subtitle {
  color: #74777f;
  font-size: 13px;
  line-height: 20px;
}

.summary {
  display: flex;
  justify-content: space-between;
  padding-top: 12px;
  border-top: 1px solid #e2e8f0;
}

.missing-box,
.ok-box {
  display: grid;
  gap: 6px;
  padding: 12px;
  border-radius: 4px;
  font-size: 14px;
}

.missing-box {
  background: #fff5f5;
  color: #ba1a1a;
}

.ok-box {
  background: #f0fbf5;
  color: #2f855a;
}

.missing-title {
  font-weight: 800;
}

.primary {
  position: fixed;
  right: 16px;
  bottom: 24px;
  left: 16px;
  height: 48px;
  border-radius: 4px;
  background: #1a365d;
  color: #ffffff;
  font-weight: 800;
}

.primary[disabled] {
  background: #c4c6cf;
}
</style>
