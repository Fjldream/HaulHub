<template>
  <view class="driver-bottom-nav admin-mobile-nav">
    <button
      v-for="item in items"
      :key="item.key"
      class="driver-nav-item admin-nav-item"
      :class="{ active: active === item.key }"
      @tap="go(item.url)"
    >
      <AppIcon :name="item.icon" />
      <text>{{ item.label }}</text>
    </button>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  active: "trips" | "maintenance" | "expenseTypes" | "reports" | "drivers";
}>();

const items = [
  { key: "trips", label: "趟次", icon: "route", url: "/pages/admin/trips/index" },
  { key: "maintenance", label: "维修", icon: "build", url: "/pages/admin/maintenance/index" },
  { key: "expenseTypes", label: "费用", icon: "receipt_long", url: "/pages/admin/expense-types/index" },
  { key: "reports", label: "利润", icon: "monitoring", url: "/pages/admin/reports/index" },
  { key: "drivers", label: "资产", icon: "inventory_2", url: "/pages/admin/drivers/index" },
] as const;

function go(url: string) {
  uni.redirectTo({ url });
}
</script>

<style scoped>
.admin-mobile-nav {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 4px;
  width: min(100%, var(--driver-max-width));
  padding: 8px max(8px, env(safe-area-inset-left)) calc(8px + env(safe-area-inset-bottom))
    max(8px, env(safe-area-inset-right));
}

.admin-nav-item {
  min-width: 0;
  height: 58px;
  padding: 6px 2px;
  border-radius: 18px;
  font-size: 11px;
}

.admin-nav-item .material-symbols-outlined {
  font-size: 21px;
  line-height: 22px;
}

.admin-nav-item text:last-child {
  width: 100%;
  overflow: hidden;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 360px) {
  .admin-mobile-nav {
    gap: 2px;
    padding-right: 6px;
    padding-left: 6px;
  }

  .admin-nav-item {
    height: 54px;
    border-radius: 16px;
    font-size: 10px;
  }
}
</style>
