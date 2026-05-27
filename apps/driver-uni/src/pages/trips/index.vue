<template>
  <view class="page">
    <view class="header">
      <view>
        <text class="title">我的趟次</text>
        <text class="subtitle">只显示分配给你的运输任务</text>
      </view>
      <button class="ghost" @tap="goProfile">我的</button>
    </view>
    <view class="tabs">
      <text class="active">全部</text>
      <text>进行中</text>
      <text>已提交</text>
      <text>已完成</text>
    </view>
    <view class="list">
      <TripCard v-for="trip in trips" :key="trip.id" :trip="trip" />
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import TripCard from "@/components/TripCard.vue";
import { trips as mockTrips } from "@/api/mock";
import { fetchDriverTrips } from "@/api/client";

const trips = ref(mockTrips);

onMounted(async () => {
  trips.value = await fetchDriverTrips();
});

function goProfile() {
  uni.switchTab({ url: "/pages/profile/index" });
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 16px;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.title {
  display: block;
  color: #111c2c;
  font-size: 22px;
  font-weight: 800;
}

.subtitle {
  color: #74777f;
  font-size: 13px;
}

.ghost {
  height: 36px;
  border: 1px solid #c4c6cf;
  border-radius: 4px;
  background: #ffffff;
  color: #1a365d;
  font-size: 14px;
}

.tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
  white-space: nowrap;
}

.tabs text {
  padding: 7px 10px;
  border-radius: 999px;
  background: #ffffff;
  color: #74777f;
  font-size: 13px;
}

.tabs .active {
  background: #d6e3ff;
  color: #1a365d;
  font-weight: 700;
}

.list {
  display: grid;
  gap: 14px;
}
</style>
