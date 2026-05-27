<template>
  <view class="page login-page">
    <view class="brand">
      <text class="brand-name">HaulHub</text>
      <text class="brand-subtitle">司机记账</text>
    </view>
    <view class="form-card">
      <label>
        手机号
        <input value="13900000001" placeholder="请输入手机号" />
      </label>
      <label>
        密码
        <input password value="123456" placeholder="请输入密码" />
      </label>
      <button class="primary" @tap="login">登录</button>
    </view>
  </view>
</template>

<script setup lang="ts">
function login() {
  uni.switchTab({ url: "/pages/trips/index" });
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 40px 16px 16px;
}

.brand {
  display: grid;
  gap: 6px;
  margin: 48px 0 28px;
}

.brand-name {
  color: #1a365d;
  font-size: 32px;
  font-weight: 800;
}

.brand-subtitle {
  color: #43474e;
  font-size: 15px;
}

.form-card {
  display: grid;
  gap: 16px;
  padding: 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #ffffff;
}

label {
  display: grid;
  gap: 8px;
  color: #43474e;
  font-size: 14px;
  font-weight: 600;
}

input {
  height: 44px;
  border: 1px solid #c4c6cf;
  border-radius: 4px;
  padding: 0 12px;
  font-size: 15px;
}

.primary {
  height: 48px;
  border-radius: 4px;
  background: #1a365d;
  color: #ffffff;
  font-weight: 700;
}
</style>
