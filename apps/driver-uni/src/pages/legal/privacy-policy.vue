<template>
  <view class="driver-page legal-page">
    <view class="driver-topbar legal-topbar">
      <button class="driver-icon-button" @tap="goBack">
        <AppIcon name="arrow_back" />
      </button>
      <text class="driver-title">隐私政策</text>
    </view>

    <scroll-view class="legal-scroll" scroll-y>
      <view class="legal-inner">
        <view class="driver-card legal-card">
          <text class="legal-title">隐私政策</text>
          <text class="legal-updated">更新日期：2026-06-29</text>
          <text class="legal-paragraph">
            拉货小票重视用户信息保护。我们仅处理实现企业运输管理服务所必要的信息，并在本政策明示的用途范围内使用。
          </text>

          <text class="legal-heading">一、我们收集的信息及用途</text>
          <text class="legal-paragraph">
            1. 订单信息：用于记录和管理运输趟次、小票、费用、账单、结算状态及利润统计，便于企业进行运输业务管理和对账。
          </text>
          <text class="legal-paragraph">
            2. 手机号：在获取你的明示同意后，用于账号登录、身份识别、权限校验、区分管理员和司机账号，以及保障账号安全。
          </text>
          <text class="legal-paragraph">
            3. 选中的照片或视频信息：用于上传和保存费用票据、司机证件、车辆证件、维修凭证等业务图片，便于费用审核、证件管理和业务留痕。
          </text>
          <text class="legal-paragraph">
            4. 选择的位置信息：用于记录装货地、卸货地和路线相关信息，便于趟次创建、运输管理和路线核对。
          </text>
          <text class="legal-paragraph">
            5. 操作日志：用于记录管理员和用户的关键操作，便于系统安全审计、问题排查和业务追溯。
          </text>
          <text class="legal-paragraph">
            6. 运输业务信息：包括司机姓名、管理员姓名、团队信息、车辆信息、车牌号、趟次信息和费用信息，用于身份展示、团队权限管理、车辆档案管理、趟次派单、费用记录、账单核算和企业运输业务管理。
          </text>

          <text class="legal-heading">二、收集方式</text>
          <text class="legal-paragraph">
            我们通过用户在登录页主动输入、在业务页面主动填写或上传、在地图/地点功能中主动选择，以及企业管理员维护资料等方式收集上述信息。
          </text>

          <text class="legal-heading">三、信息存储</text>
          <text class="legal-paragraph">
            用户信息会存储在企业系统服务器中。除法律法规另有规定外，我们对你的信息的保存期限为实现处理目的所必要的最短时间。
          </text>

          <text class="legal-heading">四、使用规则</text>
          <text class="legal-paragraph">
            我们将在本政策所明示的用途内使用收集的信息。如使用目的或范围发生变化，我们会通过小程序弹窗、页面提示或协议更新提示等方式再次告知并征得你的明示同意。
          </text>

          <text class="legal-heading">五、信息对外提供</text>
          <text class="legal-paragraph">
            我们不会主动共享或转让你的信息至任何第三方，不会对外公开披露你的信息。如确需共享、转让或公开披露，我们会依法告知并征得你的单独同意。
          </text>

          <text class="legal-heading">六、未成年人保护</text>
          <text class="legal-paragraph">
            若你是14周岁以下的未成年人，请和监护人共同阅读本政策，并在征得监护人明示同意后继续使用本小程序服务。
          </text>

          <text class="legal-heading">七、你的权利</text>
          <text class="legal-paragraph">
            你可以通过邮箱 fjl_dream@163.com 联系开发者，行使查阅、复制、更正、删除个人信息，以及申请注销账号等法定权利。我们将在十五个工作日内完成核查和处理。
          </text>

          <text class="legal-heading">八、授权同意</text>
          <text class="legal-paragraph">
            用户勾选同意本隐私政策后，方可使用手机号登录。若不同意本政策，请停止登录和使用本小程序。
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
