<template>
  <text class="material-symbols-outlined app-icon">{{ displayName }}</text>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  name: string;
}>();

const displayName = computed(() => props.name);
</script>

<style scoped>
</style>
