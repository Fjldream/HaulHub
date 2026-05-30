<template>
  <view class="driver-page admin-page">
    <view class="driver-topbar">
      <view>
        <text class="driver-brand">费用类型</text>
        <text class="admin-subbrand">报销规则与票据要求</text>
      </view>
      <button class="driver-icon-button" @tap="openCreatePanel">
        <AppIcon name="add" />
      </button>
      <AdminAccountMenu />
    </view>

    <view class="driver-content admin-content">
      <section class="rule-summary">
        <view><text>启用类型</text><text>{{ enabledCount }}</text></view>
        <view><text>需票据</text><text>{{ receiptCount }}</text></view>
      </section>

      <view class="search-row">
        <AppIcon name="search" />
        <input v-model="searchKeyword" confirm-type="search" placeholder="搜索费用类型" @confirm="loadExpenseTypes" />
        <button v-if="searchKeyword" @tap="clearSearch">清除</button>
      </view>

      <section class="list-stack">
        <view v-if="loading" class="empty-card">正在加载费用类型...</view>
        <view v-else-if="expenseTypes.length === 0" class="empty-card">暂无费用类型</view>
        <article v-for="type in expenseTypes" v-else :key="type.id" class="driver-card type-card" @tap="openEditPanel(type)">
          <view class="type-icon"><AppIcon name="receipt_long" /></view>
          <view class="type-main">
            <text class="type-name">{{ type.name }}</text>
            <text class="type-meta">排序 {{ type.sortOrder }} · {{ type.requiresReceipt ? "必须上传票据" : "票据可选" }}</text>
          </view>
          <view class="type-actions">
            <text class="state-pill" :class="{ disabled: !type.enabled }">{{ type.enabled ? "启用" : "停用" }}</text>
            <AppIcon class="chevron" name="chevron_right" />
          </view>
        </article>
      </section>
    </view>

    <view v-if="panelOpen" class="sheet-mask" @tap="closePanel">
      <view class="edit-sheet" @tap.stop>
        <view class="sheet-head">
          <view>
            <text class="sheet-title">{{ editingType ? "编辑费用类型" : "新增费用类型" }}</text>
            <text class="sheet-subtitle">司机端费用录入会按这里的规则显示</text>
          </view>
          <button class="driver-icon-button" @tap="closePanel">
            <AppIcon name="close" />
          </button>
        </view>

        <view class="form-grid">
          <label class="wide-field">
            <text>类型名称</text>
            <input v-model="form.name" placeholder="例如：油费、过路费、装卸费" />
          </label>
          <label>
            <text>排序</text>
            <input v-model="form.sortOrder" inputmode="numeric" placeholder="0" />
          </label>
          <view class="switch-card">
            <view>
              <text>需要票据</text>
              <text>开启后司机必须上传票据</text>
            </view>
            <switch :checked="form.requiresReceipt" color="#1262b8" @change="setRequiresReceipt" />
          </view>
          <view v-if="editingType" class="switch-card wide-field">
            <view>
              <text>启用状态</text>
              <text>停用后不再作为可选费用类型</text>
            </view>
            <switch :checked="form.enabled" color="#1262b8" @change="setEnabled" />
          </view>
        </view>

        <button class="driver-primary-button" :disabled="submitDisabled" @tap="submitExpenseType">
          {{ submitting ? "保存中..." : "保存费用类型" }}
        </button>
      </view>
    </view>

    <AdminMobileNav active="expenseTypes" />
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import AdminAccountMenu from "@/components/AdminAccountMenu.vue";
import AdminMobileNav from "@/components/AdminMobileNav.vue";
import {
  createAdminExpenseType,
  fetchAdminExpenseTypes,
  getApiErrorMessage,
  requireAdminSession,
  updateAdminExpenseType,
  type AdminExpenseType,
} from "@/api/client";

const loading = ref(true);
const submitting = ref(false);
const panelOpen = ref(false);
const expenseTypes = ref<AdminExpenseType[]>([]);
const editingType = ref<AdminExpenseType | null>(null);
const searchKeyword = ref("");
const form = ref({
  name: "",
  requiresReceipt: true,
  enabled: true,
  sortOrder: "0",
});

const enabledCount = computed(() => expenseTypes.value.filter((type) => type.enabled).length);
const receiptCount = computed(() => expenseTypes.value.filter((type) => type.requiresReceipt).length);
const submitDisabled = computed(
  () =>
    submitting.value ||
    !form.value.name.trim() ||
    !/^\d+$/.test(form.value.sortOrder.trim()),
);

onMounted(() => {
  if (!requireAdminSession()) return;
  loadExpenseTypes();
});

async function loadExpenseTypes() {
  loading.value = true;
  try {
    expenseTypes.value = await fetchAdminExpenseTypes(searchKeyword.value.trim() || undefined);
  } finally {
    loading.value = false;
  }
}

function clearSearch() {
  searchKeyword.value = "";
  void loadExpenseTypes();
}

function openCreatePanel() {
  editingType.value = null;
  form.value = {
    name: "",
    requiresReceipt: true,
    enabled: true,
    sortOrder: String(expenseTypes.value.length + 1),
  };
  panelOpen.value = true;
}

function openEditPanel(type: AdminExpenseType) {
  editingType.value = type;
  form.value = {
    name: type.name,
    requiresReceipt: type.requiresReceipt,
    enabled: type.enabled,
    sortOrder: String(type.sortOrder),
  };
  panelOpen.value = true;
}

function closePanel() {
  if (!submitting.value) {
    panelOpen.value = false;
  }
}

function setRequiresReceipt(event: { detail: { value: boolean } }) {
  form.value.requiresReceipt = event.detail.value;
}

function setEnabled(event: { detail: { value: boolean } }) {
  form.value.enabled = event.detail.value;
}

async function submitExpenseType() {
  if (submitDisabled.value) return;

  submitting.value = true;
  try {
    const payload = {
      name: form.value.name.trim(),
      requiresReceipt: form.value.requiresReceipt,
      sortOrder: Number(form.value.sortOrder),
    };
    const saved = editingType.value
      ? await updateAdminExpenseType(editingType.value.id, {
          ...payload,
          enabled: form.value.enabled,
        })
      : await createAdminExpenseType(payload);

    if (editingType.value) {
      expenseTypes.value = expenseTypes.value.map((type) => (type.id === saved.id ? saved : type));
    } else {
      expenseTypes.value = [...expenseTypes.value, saved];
    }
    expenseTypes.value = [...expenseTypes.value].sort((left, right) => left.sortOrder - right.sortOrder);
    panelOpen.value = false;
    uni.showToast({ title: "已保存", icon: "success" });
  } catch (error) {
    uni.showToast({ title: getApiErrorMessage(error, "保存失败，请稍后重试"), icon: "none" });
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.admin-page { padding-bottom: 96px; }
.driver-topbar { align-items: center; gap: 10px; }
.driver-topbar > view:first-child, .admin-content, .list-stack, .type-main { display: grid; gap: 14px; }
.driver-topbar > view:first-child { flex: 1; min-width: 0; }
.driver-topbar > view:first-child, .type-main { gap: 2px; }
.admin-subbrand, .type-meta { color: var(--driver-muted); font-size: 12px; }
.rule-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.rule-summary view {
  display: grid;
  gap: 6px;
  padding: 16px;
  border: 1px solid var(--driver-border);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.9);
}
.rule-summary text:first-child { color: var(--driver-muted); font-size: 12px; }
.rule-summary text:last-child { color: var(--driver-primary); font-size: 28px; font-weight: 800; }
.search-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--driver-border);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.9);
}
.search-row .material-symbols-outlined {
  color: var(--driver-muted);
  font-size: 20px;
}
.search-row input {
  height: 34px;
  padding: 0;
  border: 0;
  background: transparent;
}
.search-row button {
  height: 30px;
  margin: 0;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(18, 98, 184, 0.1);
  color: var(--driver-primary);
  font-size: 12px;
  font-weight: 800;
}
.empty-card {
  padding: 28px 16px;
  border: 1px dashed var(--driver-border);
  border-radius: 22px;
  color: var(--driver-muted);
  text-align: center;
}
.type-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
}
.type-card:active { transform: scale(0.99); }
.type-icon {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 16px;
  background: #eef4ff;
  color: var(--driver-primary-2);
}
.type-main { flex: 1; min-width: 0; }
.type-name {
  color: var(--driver-primary);
  font-size: 16px;
  font-weight: 800;
  overflow-wrap: anywhere;
}
.type-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
}
.state-pill {
  padding: 5px 9px;
  border-radius: 999px;
  background: rgba(20, 133, 94, 0.12);
  color: var(--driver-green);
  font-size: 12px;
  font-weight: 800;
}
.state-pill.disabled {
  background: rgba(121, 137, 157, 0.14);
  color: var(--driver-muted);
}
.chevron {
  color: var(--driver-muted);
  font-size: 18px;
}
.sheet-mask {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(11, 47, 91, 0.34);
}
.edit-sheet {
  display: grid;
  width: min(100%, var(--driver-max-width));
  max-height: 88vh;
  gap: 16px;
  overflow-y: auto;
  padding: 18px var(--driver-gutter) calc(18px + env(safe-area-inset-bottom));
  border-radius: 28px 28px 0 0;
  background: #ffffff;
  box-shadow: 0 -20px 45px rgba(16, 39, 74, 0.22);
}
.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.sheet-head > view { display: grid; gap: 3px; }
.sheet-title { color: var(--driver-primary); font-size: 20px; font-weight: 900; }
.sheet-subtitle { color: var(--driver-muted); font-size: 12px; }
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
label {
  display: grid;
  gap: 7px;
  color: var(--driver-muted);
  font-size: 12px;
  font-weight: 800;
}
.wide-field { grid-column: 1 / -1; }
input {
  box-sizing: border-box;
  width: 100%;
  height: 46px;
  padding: 0 13px;
  border: 1px solid var(--driver-border);
  border-radius: 16px;
  background: #f7faff;
  color: var(--driver-ink);
  font-size: 14px;
}
.switch-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--driver-border);
  border-radius: 16px;
  background: #f7faff;
}
.switch-card view {
  display: grid;
  gap: 3px;
}
.switch-card text:first-child {
  color: var(--driver-primary);
  font-size: 14px;
  font-weight: 800;
}
.switch-card text:last-child {
  color: var(--driver-muted);
  font-size: 12px;
}
@media (max-width: 360px) {
  .form-grid { grid-template-columns: 1fr; }
  .rule-summary { gap: 8px; }
  .rule-summary text:last-child { font-size: 24px; }
}
</style>
