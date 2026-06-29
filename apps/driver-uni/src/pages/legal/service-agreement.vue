<template>
  <view class="driver-page legal-page">
    <view class="driver-topbar legal-topbar">
      <button class="driver-icon-button" @tap="goBack">
        <AppIcon name="arrow_back" />
      </button>
      <text class="driver-title">用户服务协议</text>
    </view>

    <scroll-view class="legal-scroll" scroll-y>
      <view class="legal-inner">
        <view class="driver-card legal-card">
        <text class="legal-title">用户服务协议</text>
        <text class="legal-updated">更新日期：2026-06-26</text>
        <text class="legal-paragraph">
          欢迎使用拉货小票。拉货小票为企业内部运输趟次、费用、车辆、司机和账单管理工具。使用本小程序前，请认真阅读并确认同意本协议。
        </text>

        <text class="legal-heading">一、账号使用</text>
        <text class="legal-paragraph">
          用户需使用企业分配的手机号和密码登录。手机号用于识别账号身份、校验登录权限、区分管理员或司机角色，并保障账号安全。
        </text>

        <text class="legal-heading">二、服务内容</text>
        <text class="legal-paragraph">
          本小程序提供趟次查看、趟次提交、费用记录、票据上传、车辆和司机管理、利润统计等企业运输管理相关服务。不同角色可使用的功能以系统授权为准。
        </text>

        <text class="legal-heading">三、用户责任</text>
        <text class="legal-paragraph">
          用户应保证录入的信息真实、准确、完整，不得将账号借给他人使用，不得上传违法、无关或侵犯他人权益的内容。
        </text>

        <text class="legal-heading">四、数据处理</text>
        <text class="legal-paragraph">
          用户在使用过程中提交的手机号、姓名、车辆、趟次、费用、图片等信息，将用于完成企业运输管理、权限校验、账单核算和安全审计。
        </text>

        <text class="legal-heading">五、协议变更</text>
        <text class="legal-paragraph">
          如服务规则发生变化，我们会在小程序内更新相关协议。继续使用本服务即表示接受更新后的内容。
        </text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
function goBack() {
  uni.navigateBack();
}
</script>

<style scoped>
.legal-page {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--driver-bg);
}

.legal-scroll {
  height: 100vh;
  height: 100dvh;
  background: var(--driver-bg);
}

.legal-inner {
  min-height: 100vh;
  min-height: 100dvh;
  padding: calc(var(--driver-topbar-height) + 16px) var(--driver-gutter)
    calc(28px + var(--driver-bottom-safe));
  background: var(--driver-bg);
}

.legal-topbar {
  gap: 12px;
}

.legal-card {
  display: grid;
  gap: 14px;
  width: 100%;
  padding: 20px;
}

.legal-title {
  color: var(--driver-primary);
  font-size: 22px;
  font-weight: 900;
  line-height: 30px;
}

.legal-updated {
  color: var(--driver-muted);
  font-size: 13px;
  line-height: 20px;
}

.legal-heading {
  margin-top: 4px;
  color: var(--driver-primary);
  font-size: 16px;
  font-weight: 800;
  line-height: 24px;
}

.legal-paragraph {
  color: var(--driver-ink);
  font-size: 14px;
  line-height: 24px;
}
</style>
