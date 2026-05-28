<template>
  <view class="driver-page">
    <view class="driver-topbar">
      <button class="driver-icon-button" @tap="goBack">
        <text class="material-symbols-outlined">arrow_back</text>
      </button>
      <text class="driver-title">我的车辆</text>
    </view>

    <view class="driver-content page-content">
      <section class="driver-card hero-card">
        <text class="eyebrow">当前绑定</text>
        <text class="hero-title">{{ primaryVehicle.plateNumber }}</text>
        <text class="driver-muted">{{ primaryVehicle.vehicleType ?? "车辆类型未维护" }}</text>
      </section>

      <section class="vehicle-list">
        <view v-for="vehicle in profile.boundVehicles" :key="vehicle.id" class="driver-card vehicle-card">
          <view class="vehicle-icon">
            <text class="material-symbols-outlined">local_shipping</text>
          </view>
          <view>
            <text class="vehicle-title">{{ vehicle.plateNumber }}</text>
            <text class="vehicle-subtitle">{{ vehicle.vehicleType ?? "车辆类型未维护" }}</text>
          </view>
          <text class="status-chip">{{ vehicle.status === "available" ? "可用" : vehicle.status }}</text>
        </view>
        <view v-if="profile.boundVehicles.length === 0" class="driver-card empty-card">
          <text class="material-symbols-outlined">link_off</text>
          <text>暂无绑定车辆</text>
          <text>请联系调度为你绑定车辆后再接收趟次。</text>
        </view>
      </section>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { fetchDriverProfile, getApiErrorMessage, requireDriverSession, type DriverProfile } from "@/api/client";

const profile = ref<DriverProfile>({
  id: "",
  name: "",
  phone: "",
  status: "active",
  boundVehicles: [],
});

const primaryVehicle = computed(
  () =>
    profile.value.boundVehicles[0] ?? {
      id: "empty",
      plateNumber: "暂无车辆",
      status: "unbound",
      vehicleType: null,
    },
);

onMounted(async () => {
  if (!requireDriverSession()) return;
  try {
    profile.value = await fetchDriverProfile();
  } catch (error) {
    uni.showToast({ title: getApiErrorMessage(error, "车辆信息加载失败"), icon: "none" });
  }
});

function goBack() {
  uni.navigateBack();
}
</script>

<style scoped>
.page-content {
  display: grid;
  gap: 16px;
}

.hero-card {
  display: grid;
  gap: 8px;
  padding: 20px;
  background: linear-gradient(135deg, var(--driver-primary), var(--driver-primary-2));
  color: #ffffff;
}

.eyebrow {
  color: rgba(255, 255, 255, 0.72);
  font-size: 13px;
  font-weight: 700;
}

.hero-title {
  font-family: "Hanken Grotesk", Inter, sans-serif;
  font-size: 30px;
  font-weight: 800;
  line-height: 36px;
}

.hero-card .driver-muted {
  color: rgba(255, 255, 255, 0.82);
}

.vehicle-list {
  display: grid;
  gap: 12px;
}

.vehicle-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
}

.vehicle-icon {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 16px;
  background: #eef4ff;
  color: var(--driver-primary-2);
}

.vehicle-title,
.vehicle-subtitle {
  display: block;
}

.vehicle-title {
  color: var(--driver-primary);
  font-size: 18px;
  font-weight: 800;
}

.vehicle-subtitle {
  margin-top: 4px;
  color: var(--driver-muted);
  font-size: 13px;
}

.status-chip {
  margin-left: auto;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(31, 143, 97, 0.12);
  color: var(--driver-green);
  font-size: 12px;
  font-weight: 800;
}

.empty-card {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 32px 18px;
  color: var(--driver-muted);
  text-align: center;
}

.empty-card text:nth-child(2) {
  color: var(--driver-ink);
  font-size: 18px;
  font-weight: 800;
}
</style>
