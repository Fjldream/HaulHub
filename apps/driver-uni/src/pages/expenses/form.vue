<template>
  <view class="page">
    <view class="form-card">
      <label>
        费用类型
        <picker :range="expenseTypes" @change="onTypeChange">
          <view class="picker">{{ selectedType }}</view>
        </picker>
      </label>
      <label>
        金额（元）
        <input v-model="amount" type="digit" placeholder="0.00" />
      </label>
      <label>
        发生时间
        <input value="2026-05-27 12:34" />
      </label>
      <label>
        备注
        <textarea placeholder="可填写地点、原因或说明" />
      </label>
      <view class="upload-box" @tap="markUploaded">
        <text class="upload-title">票据照片</text>
        <text :class="receiptUploaded ? 'ok' : 'hint'">
          {{ receiptUploaded ? "已上传 1 张" : "点击拍照或从相册选择" }}
        </text>
      </view>
    </view>
    <button class="primary" :disabled="submitDisabled">保存费用</button>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { expenseTypes } from "@/api/mock";

const selectedType = ref(expenseTypes[0]);
const amount = ref("300.00");
const receiptUploaded = ref(false);

const submitDisabled = computed(
  () => !amount.value || Number(amount.value) <= 0 || !receiptUploaded.value,
);

function onTypeChange(event: { detail: { value: number } }) {
  selectedType.value = expenseTypes[event.detail.value];
}

function markUploaded() {
  receiptUploaded.value = true;
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 16px;
}

.form-card {
  display: grid;
  gap: 16px;
  padding: 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #ffffff;
}

label {
  display: grid;
  gap: 8px;
  color: #43474e;
  font-size: 14px;
  font-weight: 700;
}

input,
textarea,
.picker {
  min-height: 44px;
  border: 1px solid #c4c6cf;
  border-radius: 4px;
  padding: 0 12px;
  background: #ffffff;
  color: #111c2c;
  font-size: 15px;
}

.picker {
  display: flex;
  align-items: center;
}

textarea {
  min-height: 92px;
  padding: 10px 12px;
}

.upload-box {
  display: grid;
  gap: 6px;
  min-height: 96px;
  padding: 14px;
  border: 1px dashed #c4c6cf;
  border-radius: 8px;
  background: #f9fafb;
}

.upload-title {
  font-weight: 800;
}

.hint {
  color: #74777f;
  font-size: 13px;
}

.ok {
  color: #2f855a;
  font-size: 13px;
}

.primary {
  position: fixed;
  right: 16px;
  bottom: 24px;
  left: 16px;
  height: 48px;
  border-radius: 4px;
  background: #1a365d;
  color: white;
  font-weight: 800;
}

.primary[disabled] {
  background: #c4c6cf;
  color: #ffffff;
}
</style>
