<template>
  <view class="trip-card" @tap="openDetail">
    <view class="card-head">
      <view class="title-stack">
        <text class="plate">{{ trip.plateNumber }}</text>
        <text class="customer">{{ trip.customerName }}</text>
      </view>
      <StatusBadge :status="trip.rawStatus || trip.status" />
    </view>

    <view class="route-box">
      <view class="route-rail">
        <view class="route-dot" />
        <view class="route-line" />
        <view class="route-square" />
      </view>
      <view class="route-copy">
        <view>
          <text class="driver-label">装货地</text>
          <text class="route-place">{{ trip.loadLocation }}</text>
        </view>
        <view>
          <text class="driver-label">卸货地</text>
          <text class="route-place">{{ trip.unloadLocation }}</text>
        </view>
      </view>
    </view>

    <view class="card-foot">
      <text class="driver-label">{{ trip.plannedAt }}</text>
      <view class="expense-pill">
        <text class="material-symbols-outlined">payments</text>
        <text>{{ trip.expenseTotal }}</text>
      </view>
      <button class="detail-button" @tap.stop="openDetail">查看详情</button>
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
    rawStatus?: string;
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
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.78);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: var(--driver-soft-shadow);
}

.trip-card::before {
  position: absolute;
  top: 0;
  right: 0;
  width: 112px;
  height: 112px;
  border-radius: 0 0 0 999px;
  background: rgba(18, 98, 184, 0.08);
  content: "";
}

.trip-card:active {
  transform: scale(0.98);
}

.card-head,
.card-foot {
  position: relative;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 16px;
}

.title-stack {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.plate {
  color: var(--driver-primary);
  font-family: "Hanken Grotesk", Inter, sans-serif;
  font-size: 20px;
  font-weight: 600;
  line-height: 28px;
}

.customer {
  color: var(--driver-muted);
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
}

.plate,
.customer {
  overflow-wrap: anywhere;
}

.route-box {
  display: flex;
  gap: 16px;
  position: relative;
  margin: 0 16px 14px;
  padding: 16px;
  border-radius: 18px;
  background: #f4f8ff;
}

.route-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 4px;
}

.route-dot {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: var(--driver-primary-2);
}

.route-line {
  width: 1px;
  height: 32px;
  background: rgba(18, 98, 184, 0.24);
}

.route-square {
  width: 12px;
  height: 12px;
  border: 2px solid var(--driver-primary-2);
  border-radius: 2px;
}

.route-copy {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  flex: 1;
}

.route-place {
  display: block;
  color: var(--driver-ink);
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
  overflow-wrap: anywhere;
}

.card-foot {
  align-items: center;
  flex-wrap: wrap;
  padding-top: 0;
}

.expense-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 32px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(31, 143, 97, 0.1);
  color: var(--driver-green);
  font-size: 12px;
  font-weight: 800;
}

.expense-pill .material-symbols-outlined {
  font-size: 16px;
}

.detail-button {
  display: flex !important;
  align-items: center;
  justify-content: center;
  flex: 0 1 136px;
  min-width: 132px;
  min-height: 40px;
  padding: 0 18px;
  border-radius: 16px;
  background: var(--driver-primary);
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.2 !important;
}

@media (max-width: 340px) {
  .card-head,
  .card-foot {
    gap: 12px;
    padding: 14px;
  }

  .route-box {
    gap: 12px;
    margin: 0 14px 14px;
  }

  .detail-button {
    flex-basis: 100%;
  }
}
</style>
