<template>
  <view class="driver-page">
    <view class="driver-topbar">
      <button class="driver-icon-button" @tap="goBack">
        <AppIcon name="arrow_back" />
      </button>
      <text class="driver-title">{{ isEditing ? "编辑费用" : "新增费用" }}</text>
    </view>

    <view class="driver-content form-content">
      <section class="driver-card form-card">
        <view class="field">
          <text class="field-label">
            费用类型
            <text v-if="selectedType?.requiresReceipt" class="required">*</text>
          </text>
          <picker :disabled="isEditing" :range="expenseTypeNames" @change="onTypeChange">
            <view class="select-field">
              <text>{{ selectedType?.name ?? "请选择费用类型" }}</text>
              <AppIcon name="expand_more" />
            </view>
          </picker>
        </view>

        <view class="field">
          <text class="field-label">费用金额 (元)</text>
          <view class="money-field">
            <text class="currency">¥</text>
            <input v-model="amount" type="digit" placeholder="0.00" />
          </view>
        </view>

        <view class="field">
          <text class="field-label">发生时间</text>
          <view class="input-field">
            <input v-model="occurredAtText" />
            <AppIcon name="calendar_today" />
          </view>
        </view>

        <view class="field">
          <text class="field-label">备注</text>
          <textarea v-model="note" class="textarea-field" placeholder="填写费用说明..." />
        </view>

        <view class="field">
          <text class="field-label">票据照片</text>
          <view class="receipt-grid">
            <view class="upload-tile" @tap="markUploaded">
              <AppIcon name="add_a_photo" />
              <text>{{ uploadingReceipt ? "上传中..." : receiptUploaded ? "更换票据" : "上传票据" }}</text>
            </view>
            <view
              :class="['preview-tile', receiptUploaded ? 'uploaded' : '']"
              @tap="previewReceipt"
            >
              <image
                v-if="receiptPreviewSrc"
                class="receipt-preview-image"
                :src="receiptPreviewSrc"
                mode="aspectFill"
              />
              <view v-else class="receipt-placeholder">
                <AppIcon :name="receiptUploaded ? 'task_alt' : 'receipt_long'" />
                <text>{{ receiptStatusText }}</text>
              </view>
              <button v-if="receiptUploaded" class="remove-button" @tap.stop="removeReceipt">
                <AppIcon name="close" />
              </button>
            </view>
          </view>
          <view class="hint-row">
            <AppIcon name="info" />
            <text>提示：油费、过路费需提供清晰的票据照片</text>
          </view>
        </view>
      </section>
    </view>

    <view class="driver-bottom-action">
      <button class="driver-primary-button save-button" :disabled="submitDisabled || saving" @tap="saveExpense">
        <AppIcon name="save" />
        <text>{{ saving ? "保存中..." : isEditing ? "保存修改" : "保存费用" }}</text>
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  attachReceiptImage,
  createDriverExpense,
  deleteReceiptImage,
  fetchDriverTripDetail,
  fetchExpenseTypes,
  getApiErrorMessage,
  requireDriverSession,
  resolveStorageUrl,
  uploadAppFile,
  updateDriverExpense,
  type DriverExpense,
  type DriverExpenseType,
} from "@/api/client";

const expenseTypes = ref<DriverExpenseType[]>([]);
const selectedIndex = ref(0);
const tripId = ref("");
const expenseId = ref("");
const amount = ref("300.00");
const note = ref("");
const occurredAt = ref(new Date());
const receiptUploaded = ref(false);
const existingReceiptIds = ref<string[]>([]);
const existingReceiptStorageKeys = ref<string[]>([]);
const selectedReceiptPath = ref("");
const selectedReceiptStorageKey = ref("");
const selectedReceiptSize = ref(1);
const selectedReceiptMimeType = ref("image/jpeg");
const saving = ref(false);
const uploadingReceipt = ref(false);

const occurredAtText = ref(formatDateTime(occurredAt.value));
const isEditing = computed(() => Boolean(expenseId.value));
const expenseTypeNames = computed(() => expenseTypes.value.map((type) => type.name));
const selectedType = computed(() => expenseTypes.value[selectedIndex.value]);
const existingReceiptPreview = computed(() =>
  existingReceiptStorageKeys.value.map(resolveStorageUrl).find((key) => isPreviewableReceipt(key)) ?? "",
);
const receiptPreviewSrc = computed(() => selectedReceiptPath.value || existingReceiptPreview.value);
const receiptStatusText = computed(() => {
  if (selectedReceiptPath.value) return "待保存票据";
  if (existingReceiptStorageKeys.value.length > 0) return "已上传票据";
  return "暂无票据";
});
const submitDisabled = computed(() => {
  const type = selectedType.value;
  if (isEditing.value) {
    return (
      !expenseId.value ||
      !amount.value ||
      Number(amount.value) <= 0 ||
      (Boolean(type?.requiresReceipt) && !receiptUploaded.value)
    );
  }

  return (
    !tripId.value ||
    !type ||
    !amount.value ||
    Number(amount.value) <= 0 ||
    (type.requiresReceipt && !receiptUploaded.value)
  );
});

onMounted(async () => {
  if (!requireDriverSession()) return;
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1] as {
    options?: {
      tripId?: string;
      expenseId?: string;
    };
  };
  tripId.value = currentPage.options?.tripId ?? "";
  expenseId.value = currentPage.options?.expenseId ?? "";
  try {
    expenseTypes.value = await fetchExpenseTypes();

    if (expenseId.value && tripId.value) {
      const detail = await fetchDriverTripDetail(tripId.value);
      const expense = detail.expenses.find((item) => item.id === expenseId.value);
      if (expense) {
        fillExpense(expense);
      }
    }
  } catch (error) {
    uni.showToast({ title: getApiErrorMessage(error, "费用信息加载失败"), icon: "none" });
  }
});

function formatDateTime(date: Date) {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function parseDateTime(value: string) {
  const normalized = value.trim().replace(" ", "T");
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function fillExpense(expense: DriverExpense) {
  const typeIndex = expenseTypes.value.findIndex(
    (type) => type.id === expense.expenseTypeId || type.name === expense.type,
  );
  if (typeIndex >= 0) {
    selectedIndex.value = typeIndex;
  }
  amount.value = expense.rawAmount;
  note.value = expense.note === "-" ? "" : expense.note;
  occurredAt.value = new Date(expense.rawOccurredAt);
  occurredAtText.value = formatDateTime(occurredAt.value);
  existingReceiptIds.value = expense.receiptImages.map((receipt) => receipt.id);
  existingReceiptStorageKeys.value = expense.receiptImages.map((receipt) => receipt.storageKey).filter(Boolean);
  receiptUploaded.value = existingReceiptIds.value.length > 0;
  selectedReceiptPath.value = "";
  selectedReceiptStorageKey.value = "";
  selectedReceiptSize.value = 1;
  selectedReceiptMimeType.value = "image/jpeg";
}

function onTypeChange(event: { detail: { value: number } }) {
  selectedIndex.value = event.detail.value;
}

function isPreviewableReceipt(value: string) {
  return /^(https?:|blob:|data:image|file:|wxfile:|\/|\.\/|\.\.\/)/.test(value);
}

function chooseImage(): Promise<{ path: string; size?: number }> {
  return new Promise((resolve, reject) => {
    uni.chooseImage({
      count: 1,
      sizeType: ["compressed"],
      sourceType: ["camera", "album"],
      success: (result) => {
        const files = (result.tempFiles ?? []) as Array<string | { path?: string; size?: number }>;
        const file = files[0];
        const path = typeof file === "string" ? file : file?.path;
        if (!path) {
          reject(new Error("No image selected"));
          return;
        }
        resolve({ path, size: typeof file === "string" ? undefined : file.size });
      },
      fail: reject,
    });
  });
}

async function markUploaded() {
  if (uploadingReceipt.value) return;
  try {
    const image = await chooseImage();
    uploadingReceipt.value = true;
    const uploaded = await uploadAppFile(image.path);
    selectedReceiptPath.value = image.path;
    selectedReceiptStorageKey.value = uploaded.storageKey || uploaded.url;
    selectedReceiptSize.value = uploaded.sizeBytes || image.size || 1;
    selectedReceiptMimeType.value = uploaded.mimeType;
    receiptUploaded.value = true;
  } catch (error) {
    uni.showToast({ title: getApiErrorMessage(error, "未选择票据"), icon: "none" });
  } finally {
    uploadingReceipt.value = false;
  }
}

function previewReceipt() {
  const current = receiptPreviewSrc.value;
  if (!current) {
    if (existingReceiptStorageKeys.value.length > 0) {
      uni.showToast({ title: "该票据仅保存了编号", icon: "none" });
    }
    return;
  }

  uni.previewImage({
    urls: [current],
    current,
  });
}

function removeReceipt() {
  receiptUploaded.value = false;
  selectedReceiptPath.value = "";
  selectedReceiptStorageKey.value = "";
  existingReceiptStorageKeys.value = [];
  selectedReceiptSize.value = 1;
  selectedReceiptMimeType.value = "image/jpeg";
}

function receiptPayload() {
  return {
    storageKey: selectedReceiptStorageKey.value || selectedReceiptPath.value || `driver-local-${Date.now()}.jpg`,
    mimeType: selectedReceiptMimeType.value,
    sizeBytes: selectedReceiptSize.value,
  };
}

function goBack() {
  uni.navigateBack();
}

async function saveExpense() {
  if (submitDisabled.value || !selectedType.value) {
    return;
  }

  saving.value = true;
  try {
    occurredAt.value = parseDateTime(occurredAtText.value);

    if (isEditing.value) {
      await updateDriverExpense(expenseId.value, {
        amount: amount.value,
        occurredAt: occurredAt.value.toISOString(),
        note: note.value || undefined,
      });

      if ((!receiptUploaded.value || selectedReceiptPath.value) && existingReceiptIds.value.length > 0) {
        await Promise.all(existingReceiptIds.value.map((receiptId) => deleteReceiptImage(receiptId)));
      }

      if (receiptUploaded.value && (existingReceiptIds.value.length === 0 || selectedReceiptPath.value)) {
        await attachReceiptImage(expenseId.value, receiptPayload());
      }

      uni.showToast({ title: "已保存", icon: "success" });
      uni.navigateBack();
      return;
    }

    const expense = await createDriverExpense({
      tripId: tripId.value,
      expenseTypeId: selectedType.value.id,
      amount: amount.value,
      occurredAt: occurredAt.value.toISOString(),
      note: note.value || undefined,
    });

    if (receiptUploaded.value) {
      await attachReceiptImage(expense.id, receiptPayload());
    }

    uni.showToast({ title: "已保存", icon: "success" });
    uni.navigateBack();
  } catch (error) {
    uni.showToast({ title: getApiErrorMessage(error, "保存失败"), icon: "none" });
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.form-content {
  padding-bottom: 116px;
}

.form-card {
  display: grid;
  gap: 22px;
  padding: 18px;
}

.field {
  display: grid;
  gap: 8px;
}

.field-label {
  color: var(--driver-muted);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.05em;
  line-height: 16px;
}

.required {
  color: var(--driver-red);
}

.select-field,
.input-field,
.money-field {
  display: flex;
  align-items: center;
  min-width: 0;
  height: 48px;
  border: 1px solid var(--driver-border);
  border-radius: 16px;
  background: #f7faff;
  color: var(--driver-ink);
}

.select-field {
  justify-content: space-between;
  padding: 0 16px;
  font-size: 16px;
}

.select-field text:first-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.input-field {
  padding: 0 16px;
}

.input-field input {
  flex: 1;
  min-width: 0;
  height: 46px;
  color: var(--driver-ink);
  font-size: 16px;
}

.money-field {
  height: 56px;
  padding: 0 16px;
}

.currency {
  margin-right: 8px;
  color: var(--driver-muted);
  font-family: "Hanken Grotesk", Inter, sans-serif;
  font-size: 20px;
  font-weight: 600;
}

.money-field input {
  flex: 1;
  min-width: 0;
  height: 54px;
  color: var(--driver-primary);
  font-family: "Hanken Grotesk", Inter, sans-serif;
  font-size: 20px;
  font-weight: 700;
}

.textarea-field {
  min-height: 96px;
  padding: 16px;
  border: 1px solid var(--driver-border);
  border-radius: 16px;
  background: #f7faff;
  color: var(--driver-ink);
  font-size: 16px;
  line-height: 24px;
}

.receipt-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.upload-tile,
.preview-tile {
  aspect-ratio: 1 / 1;
  border-radius: 18px;
}

.upload-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px dashed rgba(18, 98, 184, 0.42);
  background: #eef4ff;
  color: var(--driver-primary);
  font-size: 12px;
  font-weight: 500;
  text-align: center;
}

.upload-tile .material-symbols-outlined {
  font-size: 40px;
}

.preview-tile {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #f4f8ff;
  color: rgba(104, 115, 133, 0.55);
}

.preview-tile.uploaded {
  background:
    linear-gradient(135deg, rgba(18, 98, 184, 0.14), rgba(255, 180, 84, 0.2)),
    #eef4ff;
  color: var(--driver-primary);
}

.preview-tile > .material-symbols-outlined,
.receipt-placeholder .material-symbols-outlined {
  font-size: 44px;
}

.receipt-placeholder {
  display: grid;
  place-items: center;
  gap: 8px;
  padding: 12px;
  text-align: center;
}

.receipt-placeholder text:last-child {
  color: var(--driver-muted);
  font-size: 12px;
  font-weight: 700;
  line-height: 16px;
}

.preview-tile.uploaded .receipt-placeholder text:last-child {
  color: var(--driver-primary);
}

.receipt-preview-image {
  display: block;
  width: 100%;
  height: 100%;
}

.remove-button {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: rgba(194, 59, 54, 0.92);
  color: #ffffff;
}

.remove-button .material-symbols-outlined {
  font-size: 18px;
}

.hint-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 12px;
  color: var(--driver-muted);
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
}

.hint-row text:last-child {
  min-width: 0;
  overflow-wrap: anywhere;
}

.hint-row .material-symbols-outlined {
  font-size: 16px;
}

.driver-bottom-action {
  padding: 16px;
}

.save-button {
  gap: 8px;
  width: 100%;
}

@media (max-width: 340px) {
  .receipt-grid {
    gap: 12px;
  }
}
</style>
