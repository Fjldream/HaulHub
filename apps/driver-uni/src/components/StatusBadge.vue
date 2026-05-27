<template>
  <text :class="['status-badge', tone]">{{ status }}</text>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ status: string }>();

const tone = computed(() => {
  if (props.status === "进行中") return "info";
  if (props.status === "已提交" || props.status === "审核中") return "warning";
  if (props.status === "已完成") return "success";
  if (props.status === "已退回") return "danger";
  return "neutral";
});
</script>

<style scoped>
.status-badge {
  min-height: 24px;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.neutral {
  background: #f3f4f6;
  color: #43474e;
}

.info {
  background: #eff6ff;
  color: #2d476f;
}

.warning {
  background: #fff8ea;
  color: #875200;
}

.success {
  background: #f0fbf5;
  color: #2f855a;
}

.danger {
  background: #fff5f5;
  color: #ba1a1a;
}
</style>
