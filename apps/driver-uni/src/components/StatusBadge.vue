<template>
  <text :class="['status-badge', tone]">{{ label }}</text>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ status: string }>();

const labels: Record<string, string> = {
  assigned: "\u5f85\u51fa\u8f66",
  in_progress: "\u8fdb\u884c\u4e2d",
  submitted: "\u5df2\u63d0\u4ea4",
  under_review: "\u5ba1\u6838\u4e2d",
  completed: "\u5df2\u5b8c\u6210",
  returned: "\u5df2\u9000\u56de",
};

const label = computed(() => labels[props.status] ?? props.status);

const tone = computed(() => {
  if (props.status === "in_progress" || label.value === "\u8fdb\u884c\u4e2d") return "info";
  if (
    props.status === "submitted" ||
    props.status === "under_review" ||
    label.value === "\u5df2\u63d0\u4ea4" ||
    label.value === "\u5ba1\u6838\u4e2d"
  ) {
    return "warning";
  }
  if (props.status === "completed" || label.value === "\u5df2\u5b8c\u6210") return "success";
  if (props.status === "returned" || label.value === "\u5df2\u9000\u56de") return "danger";
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
