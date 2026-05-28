<template>
  <view class="driver-page">
    <view class="driver-topbar">
      <button class="driver-icon-button" @tap="goBack">
        <text class="material-symbols-outlined">arrow_back</text>
      </button>
      <text class="driver-title">帮助与客服</text>
    </view>

    <view class="driver-content page-content">
      <section class="driver-card service-card">
        <view class="service-icon">
          <text class="material-symbols-outlined">support_agent</text>
        </view>
        <view class="service-copy">
          <text>车队调度热线</text>
          <text>{{ servicePhone }}</text>
          <text>工作日 08:00-22:00，紧急运输问题优先联系调度。</text>
        </view>
        <view class="service-actions">
          <button class="call-button" @tap="callService">
            <text class="material-symbols-outlined">call</text>
            <text>拨打</text>
          </button>
          <button class="copy-button" @tap="copyPhone">
            <text class="material-symbols-outlined">content_copy</text>
            <text>复制</text>
          </button>
        </view>
      </section>

      <section class="faq-list">
        <view v-for="item in faqs" :key="item.question" class="driver-card faq-card">
          <text class="faq-question">{{ item.question }}</text>
          <text class="faq-answer">{{ item.answer }}</text>
        </view>
      </section>
    </view>
  </view>
</template>

<script setup lang="ts">
const servicePhone = "400-618-0527";
const faqs = [
  {
    question: "小票什么时候可以提交？",
    answer: "趟次进行中或被退回时可以补费用和票据。所有必传票据完整后，即可在小票详情里提交。",
  },
  {
    question: "费用填错了怎么办？",
    answer: "在小票未进入审核前，可以回到费用明细编辑或删除费用。已提交后请联系会计退回。",
  },
  {
    question: "票据上传失败怎么办？",
    answer: "先检查照片是否清晰、网络是否正常。仍然失败时可先保存费用，再联系调度协助处理。",
  },
  {
    question: "收入为什么和实际到账不同？",
    answer: "收入明细为预计值，最终以后台结算结果为准。",
  },
];

function goBack() {
  uni.navigateBack();
}

function callService() {
  uni.makePhoneCall({
    phoneNumber: servicePhone,
    fail: () => {
      copyPhone();
    },
  });
}

function copyPhone() {
  uni.setClipboardData({
    data: servicePhone,
    success: () => {
      uni.showToast({ title: "热线已复制", icon: "none" });
    },
  });
}
</script>

<style scoped>
.page-content,
.faq-list {
  display: grid;
  gap: 14px;
}

.service-card {
  display: grid;
  gap: 16px;
  padding: 18px;
}

.service-icon {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: 18px;
  background: #eef4ff;
  color: var(--driver-primary-2);
}

.service-icon .material-symbols-outlined {
  font-size: 34px;
}

.service-copy {
  display: grid;
  gap: 6px;
}

.service-copy text:first-child {
  color: var(--driver-muted);
  font-size: 13px;
  font-weight: 700;
}

.service-copy text:nth-child(2) {
  color: var(--driver-primary);
  font-family: "Hanken Grotesk", Inter, sans-serif;
  font-size: 30px;
  font-weight: 800;
  line-height: 36px;
}

.service-copy text:last-child {
  color: var(--driver-muted);
  font-size: 13px;
  line-height: 20px;
}

.service-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.call-button,
.copy-button {
  display: flex !important;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 48px;
  border-radius: 16px;
  font-size: 15px;
  font-weight: 800;
}

.call-button {
  background: linear-gradient(135deg, var(--driver-primary), var(--driver-primary-2));
  color: #ffffff;
}

.copy-button {
  background: #eef4ff;
  color: var(--driver-primary);
}

.faq-card {
  display: grid;
  gap: 8px;
  padding: 16px;
}

.faq-question {
  color: var(--driver-primary);
  font-size: 16px;
  font-weight: 800;
}

.faq-answer {
  color: var(--driver-muted);
  font-size: 14px;
  line-height: 22px;
  overflow-wrap: anywhere;
}
</style>
