<template>
  <view class="driver-page login-page">
    <view class="login-orbit">
      <AppIcon name="local_shipping" />
    </view>
    <view class="brand-block">
      <text class="brand-name">拉货小票</text>
      <text class="brand-subtitle">司机趟次与费用小票</text>
    </view>

    <view class="driver-card form-card">
      <label>
        <text>手机号</text>
        <input v-model="phone" inputmode="tel" placeholder="请输入手机号" />
      </label>
      <label>
        <text>密码</text>
        <input v-model="password" password placeholder="请输入密码" />
      </label>
      <button class="driver-primary-button" :disabled="loginDisabled" @tap="login">
        {{ loggingIn ? "登录中..." : "登录" }}
      </button>
    </view>
    <view class="login-tip">
      <AppIcon name="verified_user" />
      <text>每一趟货，都有清楚小票</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { loginDriver } from "@/api/client";

const phone = ref("13900000001");
const password = ref("123456");
const loggingIn = ref(false);
const loginDisabled = computed(
  () => loggingIn.value || phone.value.trim().length < 6 || password.value.length < 1,
);

async function login() {
  if (loginDisabled.value) {
    return;
  }

  loggingIn.value = true;
  try {
    const session = await loginDriver({ phone: phone.value.trim(), password: password.value });
    uni.redirectTo({
      url: session.role === "driver" ? "/pages/trips/index" : "/pages/admin/trips/index",
    });
  } catch {
    uni.showToast({ title: "手机号或密码错误", icon: "none" });
  } finally {
    loggingIn.value = false;
  }
}
</script>

<style scoped>
.login-page {
  display: grid;
  align-content: center;
  min-height: 100vh;
  min-height: 100dvh;
  padding: 48px var(--driver-gutter) 28px;
}

.login-orbit {
  display: grid;
  place-items: center;
  width: 72px;
  height: 72px;
  margin-bottom: 18px;
  border-radius: 24px;
  background: linear-gradient(135deg, var(--driver-primary), var(--driver-primary-2));
  color: #ffffff;
  box-shadow: var(--driver-shadow);
}

.login-orbit .material-symbols-outlined {
  font-size: 38px;
}

.brand-block {
  display: grid;
  gap: 8px;
  margin-bottom: 32px;
}

.brand-name {
  color: var(--driver-primary);
  font-family: "Hanken Grotesk", Inter, sans-serif;
  font-size: 40px;
  font-weight: 700;
  line-height: 48px;
}

.brand-subtitle {
  color: var(--driver-muted);
  font-size: 16px;
  line-height: 24px;
}

.form-card {
  display: grid;
  gap: 20px;
  padding: 20px;
}

label {
  display: grid;
  gap: 8px;
  color: var(--driver-muted);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.05em;
  line-height: 16px;
}

input {
  height: 48px;
  padding: 0 16px;
  border: 1px solid var(--driver-border);
  border-radius: 16px;
  background: #f7faff;
  color: var(--driver-ink);
  font-size: 16px;
}

.login-tip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 18px;
  color: var(--driver-muted);
  font-size: 13px;
}

.login-tip .material-symbols-outlined {
  color: var(--driver-green);
  font-size: 18px;
}
</style>
