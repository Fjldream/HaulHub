<template>
  <view class="page">
    <view class="profile-card">
      <view class="avatar">{{ currentDriver.name.slice(0, 1) }}</view>
      <view>
        <text class="name">{{ currentDriver.name }}</text>
        <text class="phone">{{ currentDriver.phone }}</text>
      </view>
    </view>
    <view class="list-card">
      <view>
        <text>绑定车辆</text>
        <strong>{{ currentDriver.vehicle }}</strong>
      </view>
      <view>
        <text>账号状态</text>
        <strong>正常</strong>
      </view>
      <view>
        <text>隐私说明</text>
        <strong>敏感经营数据仅后台可见</strong>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { currentDriver } from "@/api/mock";
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 16px;
}

.profile-card,
.list-card {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #ffffff;
}

.profile-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
}

.avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 999px;
  background: #1a365d;
  color: #ffffff;
  font-weight: 800;
}

.name,
.phone {
  display: block;
}

.name {
  font-size: 18px;
  font-weight: 800;
}

.phone {
  color: #74777f;
  font-size: 13px;
}

.list-card {
  margin-top: 14px;
}

.list-card view {
  display: flex;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid #e2e8f0;
  color: #43474e;
}

.list-card strong {
  color: #111c2c;
  text-align: right;
}
</style>
