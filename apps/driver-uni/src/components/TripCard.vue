<template>
  <view class="trip-card" @tap="openDetail">
    <view class="trip-head">
      <view>
        <text class="plate">{{ trip.plateNumber }}</text>
        <text class="time">{{ trip.plannedAt }}</text>
      </view>
      <StatusBadge :status="trip.status" />
    </view>
    <text class="customer">{{ trip.customerName }}</text>
    <view class="route">
      <text>{{ trip.loadLocation }}</text>
      <text>-></text>
      <text>{{ trip.unloadLocation }}</text>
    </view>
    <view class="trip-foot">
      <text>费用合计 {{ trip.expenseTotal }}</text>
      <text class="action">查看</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import StatusBadge from "./StatusBadge.vue";

const props = defineProps<{
  trip: {
    id: string;
    plateNumber: string;
    customerName: string;
    loadLocation: string;
    unloadLocation: string;
    status: string;
    plannedAt: string;
    expenseTotal: string;
  };
}>();

function openDetail() {
  uni.navigateTo({ url: `/pages/trips/detail?id=${props.trip.id}` });
}
</script>

<style scoped>
.trip-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #ffffff;
}

.trip-head,
.trip-foot,
.route {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.plate {
  display: block;
  color: #111c2c;
  font-size: 18px;
  font-weight: 700;
}

.time,
.trip-foot {
  color: #74777f;
  font-size: 13px;
}

.customer {
  color: #111c2c;
  font-size: 16px;
  font-weight: 600;
}

.route {
  justify-content: flex-start;
  color: #43474e;
  font-size: 14px;
}

.action {
  color: #1a365d;
  font-weight: 600;
}
</style>
