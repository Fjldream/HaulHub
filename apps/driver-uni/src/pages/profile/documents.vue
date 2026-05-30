<template>
  <view class="driver-page">
    <view class="driver-topbar">
      <button class="driver-icon-button" @tap="goBack">
        <AppIcon name="arrow_back" />
      </button>
      <text class="driver-title">证件管理</text>
    </view>

    <view class="driver-content page-content">
      <section class="driver-card notice-card">
        <AppIcon name="verified_user" />
        <view>
          <text>证件资料会提交后台审核</text>
          <text>上传或更新后状态会变为待审核，审核通过后司机端会同步展示。</text>
        </view>
      </section>

      <section class="document-list">
        <view v-for="document in documents" :key="document.type" class="driver-card document-card">
          <view class="document-head">
            <view class="document-icon">
              <AppIcon :name="documentIcon(document.type)" />
            </view>
            <view class="document-main">
              <text class="document-title">{{ document.name }}</text>
              <text class="document-meta">{{ documentMeta(document) }}</text>
            </view>
            <text :class="['document-status', statusTone(document.status)]">
              {{ statusLabel(document.status) }}
            </text>
          </view>

          <view v-if="document.storageKey" class="preview-row" @tap="previewDocument(document)">
            <AppIcon name="image" />
            <text>查看已上传图片</text>
          </view>

          <view class="document-form">
            <picker mode="date" :value="dateValue(document.expiresAt)" @change="setExpiresAt(document.type, $event)">
              <view class="date-field">
                <text>{{ dateValue(document.expiresAt) || "选择到期时间" }}</text>
                <AppIcon name="calendar_month" />
              </view>
            </picker>
            <button class="upload-button" :disabled="uploadingType === document.type" @tap="chooseDocument(document)">
              <AppIcon name="upload_file" />
              <text>{{ uploadingType === document.type ? "上传中..." : document.storageKey ? "更换图片" : "上传图片" }}</text>
            </button>
          </view>
          <text v-if="document.note" class="document-note">{{ document.note }}</text>
        </view>
      </section>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { onPullDownRefresh } from "@dcloudio/uni-app";
import {
  fetchDriverDocuments,
  getApiErrorMessage,
  requireDriverSession,
  resolveStorageUrl,
  updateDriverDocument,
  uploadAppFile,
  type DriverDocument,
} from "@/api/client";
import { finishPullRefresh } from "@/utils/pull-refresh";

const documents = ref<DriverDocument[]>([]);
const uploadingType = ref("");
const pendingExpiresAt = ref<Record<string, string>>({});

onMounted(async () => {
  if (!requireDriverSession()) return;
  await loadDocuments();
});

onPullDownRefresh(() => {
  void finishPullRefresh(loadDocuments);
});

async function loadDocuments() {
  try {
    documents.value = await fetchDriverDocuments();
  } catch (error) {
    uni.showToast({ title: getApiErrorMessage(error, "证件加载失败"), icon: "none" });
  }
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    missing: "未上传",
    pending: "待审核",
    approved: "已通过",
    rejected: "已退回",
    expired: "已过期",
  };
  return labels[status] ?? status;
}

function statusTone(status: string) {
  if (status === "approved") return "success";
  if (status === "pending") return "warning";
  if (status === "rejected" || status === "expired") return "danger";
  return "muted";
}

function documentIcon(type: string) {
  if (type === "driver_license") return "badge";
  if (type === "qualification_certificate") return "assignment_ind";
  return "fact_check";
}

function dateValue(value: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function documentMeta(document: DriverDocument) {
  const expiresAt = pendingExpiresAt.value[document.type] || dateValue(document.expiresAt);
  if (!expiresAt) return "未维护到期时间";
  return `有效期至 ${expiresAt}`;
}

function setExpiresAt(type: string, event: { detail: { value: string } }) {
  pendingExpiresAt.value = {
    ...pendingExpiresAt.value,
    [type]: event.detail.value,
  };
  documents.value = documents.value.map((document) =>
    document.type === type ? { ...document, expiresAt: `${event.detail.value}T00:00:00.000Z` } : document,
  );
}

function chooseDocument(document: DriverDocument) {
  if (uploadingType.value) return;
  uni.chooseImage({
    count: 1,
    sizeType: ["compressed"],
    sourceType: ["camera", "album"],
    success: async (result) => {
      const file = (result.tempFiles ?? [])[0] as { path?: string; size?: number } | undefined;
      if (!file?.path) {
        uni.showToast({ title: "未选择图片", icon: "none" });
        return;
      }
      uploadingType.value = document.type;
      try {
        const uploaded = await uploadAppFile(file.path);
        const updated = await updateDriverDocument(document.type, {
          storageKey: uploaded.storageKey || uploaded.url,
          expiresAt: pendingExpiresAt.value[document.type] || dateValue(document.expiresAt) || undefined,
        });
        documents.value = documents.value.map((item) => (item.type === updated.type ? updated : item));
        uni.showToast({ title: "已提交审核", icon: "success" });
      } catch (error) {
        uni.showToast({ title: getApiErrorMessage(error, "证件上传失败"), icon: "none" });
      } finally {
        uploadingType.value = "";
      }
    },
    fail: () => {
      uni.showToast({ title: "未选择图片", icon: "none" });
    },
  });
}

function previewDocument(document: DriverDocument) {
  if (!document.storageKey) return;
  const url = resolveStorageUrl(document.storageKey);
  uni.previewImage({ urls: [url], current: url });
}

function goBack() {
  uni.navigateBack();
}
</script>

<style scoped>
.page-content,
.document-list {
  display: grid;
  gap: 14px;
}

.notice-card {
  display: flex;
  gap: 14px;
  padding: 18px;
  background: rgba(31, 143, 97, 0.08);
  color: var(--driver-green);
}

.notice-card > .material-symbols-outlined {
  font-size: 30px;
}

.notice-card view {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.notice-card text:nth-child(1) {
  font-size: 17px;
  font-weight: 800;
}

.notice-card text:nth-child(2) {
  color: var(--driver-muted);
  font-size: 13px;
  line-height: 20px;
}

.document-card {
  display: grid;
  gap: 14px;
  padding: 16px;
}

.document-head {
  display: flex;
  align-items: center;
  gap: 14px;
}

.document-icon {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 16px;
  background: #eef4ff;
  color: var(--driver-primary-2);
}

.document-main {
  display: grid;
  flex: 1;
  gap: 4px;
  min-width: 0;
}

.document-title {
  color: var(--driver-primary);
  font-size: 16px;
  font-weight: 800;
}

.document-meta,
.document-note {
  color: var(--driver-muted);
  font-size: 13px;
  overflow-wrap: anywhere;
}

.document-status {
  flex: 0 0 auto;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
}

.document-status.success {
  background: rgba(31, 143, 97, 0.12);
  color: var(--driver-green);
}

.document-status.warning {
  background: rgba(255, 180, 84, 0.18);
  color: #996014;
}

.document-status.danger {
  background: rgba(194, 59, 54, 0.12);
  color: var(--driver-red);
}

.document-status.muted {
  background: #eef4ff;
  color: var(--driver-muted);
}

.preview-row,
.date-field,
.upload-button {
  display: flex;
  align-items: center;
}

.preview-row {
  gap: 8px;
  color: var(--driver-primary-2);
  font-size: 13px;
  font-weight: 700;
}

.document-form {
  display: grid;
  grid-template-columns: 1fr 132px;
  gap: 10px;
}

.date-field,
.upload-button {
  justify-content: space-between;
  min-height: 44px;
  padding: 0 12px;
  border-radius: 14px;
  background: #f7faff;
  color: var(--driver-primary);
  font-size: 13px;
  font-weight: 700;
}

.upload-button {
  justify-content: center;
  gap: 6px;
  background: linear-gradient(135deg, var(--driver-primary), var(--driver-primary-2));
  color: #ffffff;
}

.upload-button[disabled] {
  opacity: 0.55;
}

@media (max-width: 360px) {
  .document-form {
    grid-template-columns: 1fr;
  }
}
</style>
