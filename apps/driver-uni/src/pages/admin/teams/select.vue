<template>
  <view class="driver-page team-select-page">
    <view class="driver-topbar">
      <view>
        <text class="driver-title">选择团队</text>
        <text class="top-subtitle">HaulHub 超级管理员</text>
      </view>
      <button class="driver-icon-button" @tap="logout">
        <AppIcon name="logout" />
      </button>
    </view>

    <view class="driver-content page-content">
      <section class="driver-card hero-card">
        <text>进入团队后台</text>
        <text>选择团队后，车辆、司机、趟次、维修和利润统计都会切换到对应团队。</text>
      </section>

      <view v-if="loading" class="driver-card empty-card">正在加载团队...</view>
      <section v-else class="team-list">
        <button
          v-for="team in activeTeams"
          :key="team.id"
          class="driver-card team-card"
          @tap="selectTeam(team)"
        >
          <view>
            <text class="team-name">{{ team.name }}</text>
            <text class="team-meta">{{ team.userCount }} 成员 · {{ team.vehicleCount }} 车辆 · {{ team.tripCount }} 趟次</text>
          </view>
          <AppIcon name="chevron_right" />
        </button>
        <view v-if="activeTeams.length === 0" class="driver-card empty-card">
          <AppIcon name="groups" />
          <text>暂无可进入团队</text>
          <text>请先在后台 Web 端创建或启用团队。</text>
        </view>
      </section>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { onPullDownRefresh } from "@dcloudio/uni-app";
import {
  fetchAdminTeams,
  getApiErrorMessage,
  logoutDriver,
  requireAdminSession,
  setActiveAdminTeam,
  type AdminTeam,
} from "@/api/client";
import { finishPullRefresh } from "@/utils/pull-refresh";

const loading = ref(true);
const teams = ref<AdminTeam[]>([]);
const activeTeams = computed(() => teams.value.filter((team) => team.status === "active"));

onMounted(() => {
  if (!requireAdminSession({ allowMissingTeam: true })) return;
  void loadTeams();
});

onPullDownRefresh(() => {
  void finishPullRefresh(loadTeams);
});

async function loadTeams() {
  loading.value = true;
  try {
    teams.value = await fetchAdminTeams();
  } catch (error) {
    uni.showToast({ title: getApiErrorMessage(error, "团队加载失败"), icon: "none" });
  } finally {
    loading.value = false;
  }
}

function selectTeam(team: AdminTeam) {
  const session = setActiveAdminTeam({ id: team.id, name: team.name });
  if (!session) {
    uni.showToast({ title: "当前账号不能切换团队", icon: "none" });
    return;
  }
  uni.reLaunch({ url: "/pages/admin/trips/index" });
}

function logout() {
  logoutDriver();
  uni.reLaunch({ url: "/pages/login/index" });
}
</script>

<style scoped>
.team-select-page {
  min-height: 100vh;
}

.driver-topbar > view {
  display: grid;
  gap: 3px;
}

.top-subtitle {
  color: var(--driver-muted);
  font-size: 12px;
  font-weight: 700;
}

.page-content,
.team-list {
  display: grid;
  gap: 14px;
}

.hero-card {
  display: grid;
  gap: 8px;
  padding: 18px;
  background: linear-gradient(135deg, var(--driver-primary), var(--driver-primary-2));
  color: #ffffff;
}

.hero-card text:first-child {
  font-size: 22px;
  font-weight: 900;
  line-height: 28px;
}

.hero-card text:last-child {
  color: rgba(255, 255, 255, 0.78);
  font-size: 13px;
  line-height: 20px;
}

.team-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  margin: 0;
  padding: 16px;
  text-align: left;
}

.team-card::after {
  display: none;
}

.team-card > view {
  display: grid;
  min-width: 0;
  gap: 5px;
}

.team-name {
  color: var(--driver-primary);
  font-size: 17px;
  font-weight: 900;
  line-height: 22px;
}

.team-meta {
  color: var(--driver-muted);
  font-size: 12px;
  line-height: 18px;
}

.team-card .material-symbols-outlined {
  color: var(--driver-primary-2);
  font-size: 22px;
}

.empty-card {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 24px 16px;
  color: var(--driver-muted);
  font-size: 13px;
  text-align: center;
}
</style>
