<template>
  <view class="driver-page admin-page">
    <view class="driver-topbar">
      <view>
        <text class="driver-brand">维修记录</text>
        <text class="admin-subbrand">HaulHub 管理端</text>
      </view>
      <button class="driver-icon-button" @tap="openCreatePanel">
        <text class="material-symbols-outlined">add</text>
      </button>
      <AdminAccountMenu />
    </view>

    <view class="driver-content admin-content">
      <section class="summary-card">
        <view><text>本页维修支出</text><text>{{ totalAmount }}</text></view>
        <view><text>记录数量</text><text>{{ records.length }}</text></view>
      </section>

      <view class="search-row">
        <text class="material-symbols-outlined">search</text>
        <input v-model="searchKeyword" confirm-type="search" placeholder="搜索车牌、部件、备注、凭证" @confirm="loadPageData" />
        <button v-if="searchKeyword" @tap="clearSearch">清除</button>
      </view>

      <section class="list-stack">
        <view v-if="loading" class="empty-card">正在加载维修记录...</view>
        <view v-else-if="records.length === 0" class="empty-card">暂无维修记录</view>
        <article v-for="record in records" v-else :key="record.id" class="driver-card record-card" @tap="openEditPanel(record)">
          <view class="card-head">
            <view>
              <text class="card-title">{{ record.vehiclePlate }}</text>
              <text class="card-subtitle">{{ record.occurredAt }}</text>
            </view>
            <text class="amount">{{ record.amount }}</text>
          </view>
          <view class="component-line">
            <text class="material-symbols-outlined">construction</text>
            <text>{{ record.component }}</text>
          </view>
          <text class="note">{{ record.note }}</text>
          <view class="record-actions">
            <text class="voucher-row">{{ record.voucherStorageKey ? "已上传凭证" : "无凭证" }}</text>
            <button class="delete-button" :disabled="deletingId === record.id" @tap.stop="confirmDelete(record)">
              <text class="material-symbols-outlined">delete</text>
              <text>{{ deletingId === record.id ? "删除中" : "删除" }}</text>
            </button>
          </view>
        </article>
      </section>
    </view>

    <view v-if="createPanelOpen" class="sheet-mask" @tap="closeCreatePanel">
      <view class="create-sheet" @tap.stop>
        <view class="sheet-head">
          <view>
            <text class="sheet-title">{{ editingRecord ? "编辑维修记录" : "新增维修记录" }}</text>
            <text class="sheet-subtitle">{{ editingRecord ? "修改后会同步影响利润统计" : "录入后自动计入利润统计支出" }}</text>
          </view>
          <button class="driver-icon-button" @tap="closeCreatePanel">
            <text class="material-symbols-outlined">close</text>
          </button>
        </view>

        <view class="form-grid">
          <label>
            <text>车辆</text>
            <picker :range="vehicleLabels" :value="selectedVehicleIndex" @change="selectVehicle">
              <view class="picker-field">{{ selectedVehicleName }}</view>
            </picker>
          </label>
          <label>
            <text>维修部件</text>
            <input v-model="form.component" placeholder="例如：轮胎、刹车片、机油" />
          </label>
          <label>
            <text>金额</text>
            <input v-model="form.amount" inputmode="decimal" placeholder="0.00" />
          </label>
          <label>
            <text>日期</text>
            <picker mode="date" :value="form.occurredAt" @change="selectDate">
              <view class="picker-field">{{ form.occurredAt }}</view>
            </picker>
          </label>
          <label class="wide-field">
            <text>凭证编号/文件名（可选）</text>
            <input v-model="form.voucherStorageKey" placeholder="例如：repair-20260527.jpg" />
          </label>
          <view class="wide-field voucher-uploader">
            <button class="voucher-upload-button" @tap="chooseVoucher">
              <text class="material-symbols-outlined">upload_file</text>
              <text>{{ form.voucherStorageKey ? "更换凭证" : "选择凭证" }}</text>
            </button>
            <button
              v-if="form.voucherStorageKey"
              class="voucher-preview-button"
              @tap="previewVoucher"
            >
              <text class="material-symbols-outlined">visibility</text>
              <text>预览</text>
            </button>
            <button
              v-if="form.voucherStorageKey"
              class="voucher-remove-button"
              @tap="removeVoucher"
            >
              <text class="material-symbols-outlined">close</text>
              <text>移除</text>
            </button>
          </view>
          <label class="wide-field">
            <text>备注</text>
            <textarea v-model="form.note" placeholder="补充维修原因、门店等信息" />
          </label>
        </view>

        <button class="driver-primary-button" :disabled="submitDisabled" @tap="submitMaintenance">
          {{ submitting ? "保存中..." : editingRecord ? "保存修改" : "保存维修记录" }}
        </button>
      </view>
    </view>

    <AdminMobileNav active="maintenance" />
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import AdminAccountMenu from "@/components/AdminAccountMenu.vue";
import AdminMobileNav from "@/components/AdminMobileNav.vue";
import {
  createAdminMaintenanceRecord,
  deleteAdminMaintenanceRecord,
  fetchAdminMaintenanceRecords,
  fetchAdminVehicleOptions,
  getApiErrorMessage,
  requireAdminSession,
  updateAdminMaintenanceRecord,
  type AdminMaintenanceRecord,
  type AdminVehicleOption,
} from "@/api/client";

const loading = ref(true);
const records = ref<AdminMaintenanceRecord[]>([]);
const vehicles = ref<AdminVehicleOption[]>([]);
const searchKeyword = ref("");
const createPanelOpen = ref(false);
const submitting = ref(false);
const deletingId = ref("");
const editingRecord = ref<AdminMaintenanceRecord | null>(null);
const selectedVehicleIndex = ref(0);
const form = ref({
  component: "",
  amount: "",
  occurredAt: new Date().toISOString().slice(0, 10),
  voucherStorageKey: "",
  note: "",
});

const totalAmount = computed(() => {
  const total = records.value.reduce(
    (sum, record) => sum + Number(record.amount.replace(/[^\d.-]/g, "")),
    0,
  );
  return `¥ ${total.toFixed(2)}`;
});
const vehicleLabels = computed(() =>
  vehicles.value.map((vehicle) => `${vehicle.plateNumber}${vehicle.vehicleType ? ` · ${vehicle.vehicleType}` : ""}`),
);
const selectedVehicleName = computed(() => vehicleLabels.value[selectedVehicleIndex.value] ?? "请选择车辆");
const submitDisabled = computed(
  () =>
    submitting.value ||
    vehicles.value.length === 0 ||
    !form.value.component.trim() ||
    !/^\d+(\.\d{1,2})?$/.test(form.value.amount.trim()) ||
    !form.value.occurredAt,
);

onMounted(() => {
  if (!requireAdminSession()) return;
  loadPageData();
});

async function loadPageData() {
  loading.value = true;
  try {
    const [maintenanceRecords, vehicleOptions] = await Promise.all([
      fetchAdminMaintenanceRecords(searchKeyword.value.trim() || undefined),
      fetchAdminVehicleOptions(),
    ]);
    records.value = maintenanceRecords;
    vehicles.value = vehicleOptions;
  } finally {
    loading.value = false;
  }
}

function clearSearch() {
  searchKeyword.value = "";
  void loadPageData();
}

function openCreatePanel() {
  editingRecord.value = null;
  selectedVehicleIndex.value = 0;
  form.value = {
    component: "",
    amount: "",
    occurredAt: new Date().toISOString().slice(0, 10),
    voucherStorageKey: "",
    note: "",
  };
  createPanelOpen.value = true;
}

function openEditPanel(record: AdminMaintenanceRecord) {
  editingRecord.value = record;
  const vehicleIndex = vehicles.value.findIndex((vehicle) => vehicle.id === record.vehicleId);
  selectedVehicleIndex.value = Math.max(0, vehicleIndex);
  form.value = {
    component: record.component,
    amount: record.amount.replace(/[^\d.]/g, ""),
    occurredAt: record.rawOccurredAt.slice(0, 10),
    voucherStorageKey: record.voucherStorageKey ?? "",
    note: record.note === "无备注" ? "" : record.note,
  };
  createPanelOpen.value = true;
}

function closeCreatePanel() {
  if (!submitting.value) {
    createPanelOpen.value = false;
    editingRecord.value = null;
  }
}

function selectVehicle(event: { detail: { value: number } }) {
  selectedVehicleIndex.value = Number(event.detail.value);
}

function selectDate(event: { detail: { value: string } }) {
  form.value.occurredAt = event.detail.value;
}

function isPreviewableVoucher(value: string) {
  return /^(https?:|blob:|data:image|file:|wxfile:|\/|\.\/|\.\.\/)/.test(value);
}

function chooseVoucher() {
  uni.chooseImage({
    count: 1,
    sizeType: ["compressed"],
    sourceType: ["camera", "album"],
    success: (result) => {
      const files = (result.tempFiles ?? []) as Array<string | { path?: string }>;
      const file = files[0];
      const path = typeof file === "string" ? file : file?.path;
      if (!path) {
        uni.showToast({ title: "未选择凭证", icon: "none" });
        return;
      }
      form.value.voucherStorageKey = path;
    },
    fail: () => {
      uni.showToast({ title: "未选择凭证", icon: "none" });
    },
  });
}

function previewVoucher() {
  const voucher = form.value.voucherStorageKey.trim();
  if (!voucher) return;
  if (!isPreviewableVoucher(voucher)) {
    uni.showToast({ title: "该凭证仅保存了编号", icon: "none" });
    return;
  }
  uni.previewImage({ urls: [voucher], current: voucher });
}

function removeVoucher() {
  form.value.voucherStorageKey = "";
}

async function submitMaintenance() {
  if (submitDisabled.value) return;
  const vehicle = vehicles.value[selectedVehicleIndex.value];
  if (!vehicle) return;

  submitting.value = true;
  try {
    const payload = {
      vehicleId: vehicle.id,
      component: form.value.component.trim(),
      amount: form.value.amount.trim(),
      occurredAt: `${form.value.occurredAt}T00:00:00.000Z`,
      voucherStorageKey: form.value.voucherStorageKey.trim() || undefined,
      note: form.value.note.trim() || undefined,
    };
    const record = editingRecord.value
      ? await updateAdminMaintenanceRecord(editingRecord.value.id, payload)
      : await createAdminMaintenanceRecord(payload);
    records.value = editingRecord.value
      ? records.value.map((item) => (item.id === record.id ? record : item))
      : [record, ...records.value];
    editingRecord.value = null;
    createPanelOpen.value = false;
    uni.showToast({ title: "已保存", icon: "success" });
  } catch (error) {
    uni.showToast({ title: getApiErrorMessage(error, "保存失败，请稍后重试"), icon: "none" });
  } finally {
    submitting.value = false;
  }
}

function confirmDelete(record: AdminMaintenanceRecord) {
  uni.showModal({
    title: "删除维修记录",
    content: `确认删除 ${record.vehiclePlate} 的 ${record.component} 维修记录吗？`,
    confirmColor: "#d64f4f",
    success: (result) => {
      if (result.confirm) {
        void removeRecord(record.id);
      }
    },
  });
}

async function removeRecord(recordId: string) {
  deletingId.value = recordId;
  try {
    await deleteAdminMaintenanceRecord(recordId);
    records.value = records.value.filter((record) => record.id !== recordId);
    uni.showToast({ title: "已删除", icon: "success" });
  } catch (error) {
    uni.showToast({ title: getApiErrorMessage(error, "删除失败，请稍后重试"), icon: "none" });
  } finally {
    deletingId.value = "";
  }
}
</script>

<style scoped>
.admin-page { padding-bottom: 96px; }
.driver-topbar { align-items: center; gap: 10px; }
.driver-topbar > view:first-child { display: grid; flex: 1; min-width: 0; gap: 2px; }
.admin-subbrand, .card-subtitle, .note, .voucher-row { color: var(--driver-muted); font-size: 12px; }
.admin-content, .list-stack, .record-card { display: grid; }
.admin-content {
  align-content: start;
  gap: 12px;
}
.list-stack, .record-card { gap: 14px; }
.summary-card {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.summary-card view {
  display: grid;
  box-sizing: border-box;
  height: 82px;
  align-content: center;
  gap: 6px;
  padding: 12px 14px;
  border-radius: 22px;
  background: linear-gradient(135deg, rgba(11, 47, 91, 0.96), rgba(18, 98, 184, 0.9));
  color: #ffffff;
  box-shadow: var(--driver-soft-shadow);
}
.summary-card text:first-child {
  color: rgba(255, 255, 255, 0.72);
  font-size: 12px;
  line-height: 16px;
}
.summary-card text:last-child {
  overflow: hidden;
  color: #ffffff;
  font-size: 24px;
  font-weight: 800;
  line-height: 30px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.search-row {
  display: grid;
  align-self: start;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  box-sizing: border-box;
  min-height: 52px;
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
.list-stack {
  align-self: start;
}
.record-card { padding: 16px; }
.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.card-title { display: block; color: var(--driver-primary); font-size: 18px; font-weight: 800; }
.amount { color: var(--driver-red); font-size: 18px; font-weight: 800; }
.component-line {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-radius: 16px;
  background: #f4f7fc;
  color: var(--driver-primary);
  font-size: 15px;
  font-weight: 800;
}
.component-line .material-symbols-outlined { font-size: 20px; }
.record-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.voucher-row {
  justify-self: start;
  padding: 5px 9px;
  border-radius: 999px;
  background: rgba(18, 98, 184, 0.08);
}
.delete-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 32px;
  min-width: 76px;
  margin: 0;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(214, 79, 79, 0.1);
  color: var(--driver-red);
  font-size: 12px;
  font-weight: 800;
}
.delete-button .material-symbols-outlined { font-size: 16px; }
.sheet-mask {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(11, 47, 91, 0.34);
}
.create-sheet {
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
input,
textarea,
.picker-field {
  box-sizing: border-box;
  width: 100%;
  border: 1px solid var(--driver-border);
  border-radius: 16px;
  background: #f7faff;
  color: var(--driver-ink);
  font-size: 14px;
}
input,
.picker-field {
  height: 46px;
  padding: 0 13px;
  line-height: 46px;
}
textarea {
  min-height: 78px;
  padding: 12px 13px;
  line-height: 20px;
}
.voucher-uploader {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.voucher-uploader button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 38px;
  margin: 0;
  padding: 0 12px;
  border-radius: 14px;
  font-size: 12px;
  font-weight: 900;
}
.voucher-uploader .material-symbols-outlined {
  font-size: 17px;
}
.voucher-upload-button,
.voucher-preview-button {
  background: #eef4ff;
  color: var(--driver-primary);
}
.voucher-remove-button {
  background: rgba(214, 79, 79, 0.1);
  color: var(--driver-red);
}
@media (max-width: 360px) {
  .summary-card { gap: 8px; }
  .summary-card view { height: 76px; padding: 10px 12px; }
  .summary-card text:last-child { font-size: 20px; line-height: 26px; }
  .form-grid { grid-template-columns: 1fr; }
}
</style>
