<template>
  <view class="account-menu">
    <button class="avatar-button" @tap="toggleMenu">
      <text>{{ initials }}</text>
    </button>

    <view v-if="open" class="menu-popover">
      <view class="account-head">
        <view class="avatar-large">{{ initials }}</view>
        <view>
          <text>{{ accountName }}</text>
          <text>管理端账号</text>
        </view>
      </view>

      <view class="team-row">
        <AppIcon name="groups" />
        <view>
          <text>团队信息</text>
          <text>{{ teamName }}</text>
        </view>
      </view>

      <button class="logout-button" @tap="logout">
        <AppIcon name="logout" />
        <text>退出登录</text>
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { getDriverSession, logoutDriver } from "@/api/client";

const open = ref(false);
const session = computed(() => getDriverSession());
const accountName = computed(() => session.value?.name ?? "管理员");
const teamName = computed(() => session.value?.teamName ?? "拉货小票");
const initials = computed(() => accountName.value.slice(0, 1) || "管");

function toggleMenu() {
  open.value = !open.value;
}

function logout() {
  uni.showModal({
    title: "退出登录",
    content: "确认退出当前管理账号吗？",
    confirmColor: "#0b2f5b",
    success: (result) => {
      if (result.confirm) {
        logoutDriver();
        uni.reLaunch({ url: "/pages/login/index" });
      }
    },
  });
}
</script>

<style scoped>
.account-menu {
  position: relative;
  z-index: 20;
  flex: 0 0 auto;
}

.avatar-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  margin: 0;
  padding: 0;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--driver-primary), var(--driver-primary-2));
  color: #ffffff;
  box-shadow: 0 5px 16px rgba(16, 39, 74, 0.16);
}

.avatar-button text {
  font-size: 17px;
  font-weight: 900;
  line-height: 1;
}

.menu-popover {
  position: absolute;
  top: 50px;
  right: 0;
  z-index: 90;
  display: grid;
  width: min(270px, calc(100vw - 32px));
  gap: 12px;
  padding: 14px;
  border: 1px solid rgba(255, 255, 255, 0.82);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 18px 40px rgba(16, 39, 74, 0.18);
}

.account-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.avatar-large {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 16px;
  background: #eef4ff;
  color: var(--driver-primary);
  font-size: 18px;
  font-weight: 900;
}

.account-head view:last-child,
.team-row view {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.account-head text:first-child,
.team-row view text:first-child {
  color: var(--driver-primary);
  font-size: 14px;
  font-weight: 900;
  line-height: 18px;
}

.account-head text:last-child,
.team-row view text:last-child {
  color: var(--driver-muted);
  font-size: 12px;
  line-height: 16px;
  overflow-wrap: anywhere;
}

.team-row {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 10px;
  border-radius: 16px;
  background: #f7faff;
}

.team-row > .material-symbols-outlined {
  color: var(--driver-primary-2);
  font-size: 20px;
}

.logout-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 42px;
  margin: 0;
  padding: 0 12px;
  border-radius: 16px;
  background: rgba(214, 79, 79, 0.1);
  color: var(--driver-red);
  font-size: 14px;
  font-weight: 900;
}

.logout-button .material-symbols-outlined {
  font-size: 18px;
}
</style>
