<template>
  <text :class="['status-badge', tone]">{{ label }}</text>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ status: string }>();

const labels: Record<string, string> = {
  assigned: "待出车",
  in_progress: "进行中",
  submitted: "已提交",
  under_review: "审核中",
  completed: "已完成",
  returned: "已退回",
  cancelled: "已撤销",
};

const label = computed(() => labels[props.status] ?? props.status);

const tone = computed(() => {
  if (props.status === "in_progress" || label.value === "进行中") return "accent";
  if (props.status === "submitted" || props.status === "under_review") return "warning";
  if (label.value === "已提交" || label.value === "审核中") return "warning";
  if (props.status === "completed" || label.value === "已完成") return "success";
  if (props.status === "returned" || props.status === "cancelled" || label.value === "已退回" || label.value === "已撤销") return "danger";
  return "neutral";
});
</script>

<style scoped>
.status-badge {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  min-height: 26px;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 16px;
  white-space: nowrap;
}

.neutral {
  background: #eef4ff;
  color: var(--driver-primary);
}

.accent {
  background: rgba(255, 180, 84, 0.18);
  color: #996014;
}

.warning {
  background: rgba(18, 98, 184, 0.12);
  color: var(--driver-primary-2);
}

.success {
  background: rgba(31, 143, 97, 0.12);
  color: var(--driver-green);
}

.danger {
  background: rgba(194, 59, 54, 0.12);
  color: var(--driver-red);
}
</style>
