<template>
  <view class="driver-page admin-page">
    <view class="driver-topbar">
      <view>
        <text class="driver-brand">资产管理</text>
        <text class="admin-subbrand">司机与车辆档案</text>
      </view>
      <button class="driver-icon-button" @tap="openActiveCreatePanel">
        <AppIcon :name="activeAssetTab === 'vehicles' ? 'local_shipping' : 'person_add'" />
      </button>
      <AdminAccountMenu />
    </view>

    <view class="driver-content admin-content">
      <view class="asset-tabs">
        <button :class="{ active: activeAssetTab === 'drivers' }" @tap="setAssetTab('drivers')">司机</button>
        <button :class="{ active: activeAssetTab === 'vehicles' }" @tap="setAssetTab('vehicles')">车辆</button>
      </view>

      <section v-if="activeAssetTab === 'drivers'" class="driver-summary">
        <view><text>司机总数</text><text>{{ drivers.length }}</text></view>
        <view><text>启用司机</text><text>{{ activeCount }}</text></view>
      </section>

      <section v-else class="driver-summary vehicle-summary">
        <view><text>车辆总数</text><text>{{ adminVehicles.length }}</text></view>
        <view><text>可用车辆</text><text>{{ vehicleActiveCount }}</text></view>
        <view><text>维修/停用</text><text>{{ vehicleUnavailableCount }}</text></view>
      </section>

      <view class="search-row">
        <AppIcon name="search" />
        <input v-model="searchKeyword" confirm-type="search" :placeholder="activeAssetTab === 'vehicles' ? '搜索车牌号、车型、品牌' : '搜索司机姓名、手机号'" @confirm="loadDrivers" />
        <button v-if="searchKeyword" @tap="clearSearch">清除</button>
      </view>

      <section v-if="activeAssetTab === 'drivers'" class="list-stack">
        <view v-if="loading" class="empty-card">正在加载司机...</view>
        <view v-else-if="drivers.length === 0" class="empty-card">暂无司机数据</view>
        <article v-for="driver in drivers" v-else :key="driver.id" class="driver-card driver-item" @tap="openEditPanel(driver)">
          <view class="avatar">{{ driver.name.slice(0, 1) }}</view>
          <view class="driver-main">
            <view class="name-row">
              <text class="driver-name">{{ driver.name }}</text>
              <text class="state-pill" :class="{ disabled: driver.status !== 'active' }">{{ driver.status === "active" ? "启用" : "停用" }}</text>
            </view>
            <text class="phone">{{ driver.phone }}</text>
            <view class="vehicle-row">
              <AppIcon name="local_shipping" />
              <text>{{ vehicleText(driver) }}</text>
            </view>
          </view>
          <AppIcon class="chevron" name="chevron_right" />
        </article>
      </section>

      <section v-else class="list-stack">
        <view v-if="loading" class="empty-card">正在加载车辆...</view>
        <view v-else-if="adminVehicles.length === 0" class="empty-card">暂无车辆数据</view>
        <article v-for="vehicle in adminVehicles" v-else :key="vehicle.id" class="driver-card vehicle-card" @tap="openEditVehiclePanel(vehicle)">
          <view class="vehicle-card-head">
            <view>
              <text class="vehicle-plate">{{ vehicle.plateNumber }}</text>
              <text class="vehicle-meta">{{ vehicle.vehicleType || vehicle.brandModel || "未设置车辆类型" }}</text>
            </view>
            <text class="state-pill" :class="{ disabled: vehicle.status !== 'available' }">{{ vehicleStatusText(vehicle.status) }}</text>
          </view>
          <view class="vehicle-detail-row">
            <AppIcon name="badge" />
            <text>{{ vehicle.brandModel || "未设置品牌型号" }}</text>
          </view>
          <view class="vehicle-detail-row">
            <AppIcon name="groups" />
            <text>{{ vehicleDriverText(vehicle) }}</text>
          </view>
          <view class="vehicle-detail-row">
            <AppIcon name="route" />
            <text>{{ vehicleOperationalText(vehicle) }}</text>
          </view>
        </article>
      </section>
    </view>

    <view v-if="panelOpen" class="sheet-mask" @tap="closePanel">
      <view class="edit-sheet" @tap.stop>
        <view class="sheet-head">
          <view>
            <text class="sheet-title">{{ editingDriver ? "编辑司机" : "新增司机" }}</text>
            <text class="sheet-subtitle">{{ editingDriver ? "维护司机资料与账号状态" : "创建后司机可登录移动端" }}</text>
          </view>
          <button class="driver-icon-button" @tap="closePanel">
            <AppIcon name="close" />
          </button>
        </view>

        <view class="form-grid">
          <label>
            <text>姓名</text>
            <input v-model="form.name" placeholder="请输入司机姓名" />
          </label>
          <label>
            <text>手机号</text>
            <input v-model="form.phone" inputmode="tel" placeholder="请输入手机号" />
          </label>
          <label v-if="!editingDriver" class="wide-field">
            <text>初始密码</text>
            <input v-model="form.initialPassword" password placeholder="至少 6 位" />
          </label>
          <view v-if="editingDriver" class="switch-card wide-field">
            <view>
              <text>启用状态</text>
              <text>停用后司机不能继续使用账号</text>
            </view>
            <switch :checked="form.status === 'active'" color="#1262b8" @change="setStatus" />
          </view>
        </view>

        <button class="driver-primary-button" :disabled="submitDisabled" @tap="submitDriver">
          {{ submitting ? "保存中..." : "保存司机" }}
        </button>

        <view v-if="editingDriver" class="document-panel-entry">
          <view>
            <text>证件管理</text>
            <text>查看司机上传证件，维护审核状态和到期时间</text>
          </view>
          <button :disabled="documentLoading" @tap="openDocumentPanel">
            {{ documentLoading ? "加载中" : "打开" }}
          </button>
        </view>

        <view v-if="editingDriver" class="binding-panel">
          <view class="panel-head">
            <view>
              <text>车辆绑定</text>
              <text>绑定后可给该司机创建对应车辆趟次</text>
            </view>
          </view>
          <view v-if="editingDriver.boundVehicles.length === 0" class="binding-empty">暂未绑定车辆</view>
          <view v-for="vehicle in editingDriver.boundVehicles" :key="vehicle.id" class="binding-row">
            <view>
              <text>{{ vehicle.plateNumber }}</text>
              <text>{{ vehicle.vehicleType ?? "未设置车辆类型" }}</text>
            </view>
            <button :disabled="bindingBusy" @tap="unbindVehicle(vehicle.id)">解绑</button>
          </view>
          <view class="bind-form">
            <picker :range="availableVehicleLabels" :value="selectedVehicleIndex" @change="selectVehicle">
              <view class="picker-field">{{ selectedVehicleName }}</view>
            </picker>
            <button :disabled="bindDisabled" @tap="bindVehicle">绑定</button>
          </view>
        </view>

        <view v-if="editingDriver" class="password-panel">
          <view>
            <text>重置密码</text>
            <text>重置后司机下次登录需使用新密码</text>
          </view>
          <view class="password-row">
            <input v-model="newPassword" password placeholder="新密码至少 6 位" />
            <button :disabled="resetDisabled" @tap="resetPassword">重置</button>
          </view>
        </view>
      </view>
    </view>

    <view v-if="vehiclePanelOpen" class="sheet-mask" @tap="closeVehiclePanel">
      <view class="edit-sheet" @tap.stop>
        <view class="sheet-head">
          <view>
            <text class="sheet-title">{{ editingVehicle ? "编辑车辆" : "新增车辆" }}</text>
            <text class="sheet-subtitle">{{ editingVehicle ? "维护车辆档案与司机绑定" : "创建后可绑定司机并参与派车" }}</text>
          </view>
          <button class="driver-icon-button" @tap="closeVehiclePanel">
            <AppIcon name="close" />
          </button>
        </view>

        <view class="form-grid">
          <label>
            <text>车牌号</text>
            <input v-model="vehicleForm.plateNumber" placeholder="请输入车牌号" />
          </label>
          <label>
            <text>车辆类型</text>
            <input v-model="vehicleForm.vehicleType" placeholder="如 厢式货车" />
          </label>
          <label>
            <text>品牌型号</text>
            <input v-model="vehicleForm.brandModel" placeholder="如 东风天锦" />
          </label>
          <label>
            <text>核载吨位</text>
            <input v-model="vehicleForm.loadCapacityTons" inputmode="decimal" placeholder="如 12.5" />
          </label>
          <label>
            <text>注册日期</text>
            <picker mode="date" :value="vehicleForm.registeredAt" @change="setVehicleDate('registeredAt', $event)">
              <view class="picker-field">{{ vehicleForm.registeredAt || "未设置" }}</view>
            </picker>
          </label>
          <label>
            <text>保险到期</text>
            <picker mode="date" :value="vehicleForm.insuranceExpiresAt" @change="setVehicleDate('insuranceExpiresAt', $event)">
              <view class="picker-field">{{ vehicleForm.insuranceExpiresAt || "未设置" }}</view>
            </picker>
          </label>
          <label>
            <text>年检到期</text>
            <picker mode="date" :value="vehicleForm.inspectionExpiresAt" @change="setVehicleDate('inspectionExpiresAt', $event)">
              <view class="picker-field">{{ vehicleForm.inspectionExpiresAt || "未设置" }}</view>
            </picker>
          </label>
          <label>
            <text>下次保养</text>
            <picker mode="date" :value="vehicleForm.maintenanceDueAt" @change="setVehicleDate('maintenanceDueAt', $event)">
              <view class="picker-field">{{ vehicleForm.maintenanceDueAt || "未设置" }}</view>
            </picker>
          </label>
          <label class="wide-field">
            <text>车辆图片</text>
            <input v-model="vehicleForm.imageUrl" placeholder="图片 URL" />
          </label>
          <label v-if="editingVehicle" class="wide-field">
            <text>车辆状态</text>
            <picker :range="vehicleStatusLabels" :value="vehicleStatusIndex" @change="setVehicleStatus">
              <view class="picker-field">{{ vehicleStatusText(vehicleForm.status) }}</view>
            </picker>
          </label>
          <label class="wide-field">
            <text>备注</text>
            <textarea v-model="vehicleForm.note" placeholder="填写车辆备注" />
          </label>
        </view>

        <button class="driver-primary-button" :disabled="vehicleSubmitDisabled" @tap="submitVehicle">
          {{ vehicleSubmitting ? "保存中..." : "保存车辆" }}
        </button>

        <view v-if="editingVehicle" class="binding-panel">
          <view class="panel-head">
            <view>
              <text>司机绑定</text>
              <text>绑定后该司机可使用该车辆执行趟次</text>
            </view>
          </view>
          <view v-if="editingVehicle.boundDrivers.length === 0" class="binding-empty">暂未绑定司机</view>
          <view v-for="driver in editingVehicle.boundDrivers" :key="driver.id" class="binding-row">
            <view>
              <text>{{ driver.name }}</text>
              <text>{{ driver.phone }}</text>
            </view>
            <button :disabled="vehicleBindingBusy" @tap="unbindVehicleDriver(driver.id)">解绑</button>
          </view>
          <view class="bind-form">
            <picker :range="bindableDriverLabels" :value="selectedDriverBindIndex" @change="selectDriverBind">
              <view class="picker-field">{{ selectedBindableDriverName }}</view>
            </picker>
            <button :disabled="vehicleBindDisabled" @tap="bindVehicleDriver">绑定</button>
          </view>
        </view>
      </view>
    </view>

    <view v-if="documentPanelOpen" class="sheet-mask document-mask" @tap="closeDocumentPanel">
      <view class="edit-sheet document-sheet" @tap.stop>
        <view class="sheet-head">
          <view>
            <text class="sheet-title">证件管理</text>
            <text class="sheet-subtitle">{{ editingDriver?.name }} · 后台审核</text>
          </view>
          <button class="driver-icon-button" @tap="closeDocumentPanel">
            <AppIcon name="close" />
          </button>
        </view>

        <view v-if="documentLoading" class="empty-card compact">正在加载证件...</view>
        <view v-for="document in driverDocuments" v-else :key="document.type" class="document-card">
          <view class="document-head">
            <view>
              <text>{{ document.name }}</text>
              <text>{{ document.storageKey ? "已上传图片" : "暂未上传图片" }}</text>
            </view>
            <text class="state-pill" :class="{ disabled: document.status !== 'approved' }">
              {{ documentStatusText(document.status) }}
            </text>
          </view>
          <view v-if="document.storageKey" class="document-thumb" @tap="previewDocument(document)">
            <image class="document-thumb-image" mode="aspectFill" :src="documentDisplayUrl(document)" />
            <text>查看</text>
          </view>
          <view v-else class="document-empty-thumb">
            <AppIcon name="badge" />
            <text>暂无图片</text>
          </view>
          <label>
            <text>审核状态</text>
            <picker :range="documentStatusLabels" :value="documentStatusIndex(document.status)" @change="setDocumentStatus(document, $event)">
              <view class="picker-field">{{ documentStatusText(document.status) }}</view>
            </picker>
          </label>
          <label>
            <text>到期时间</text>
            <picker mode="date" :value="dateInputValue(document.expiresAt)" @change="setDocumentExpiresAt(document, $event)">
              <view class="picker-field">{{ dateInputValue(document.expiresAt) || "未设置" }}</view>
            </picker>
          </label>
          <label>
            <text>审核备注</text>
            <textarea v-model="document.note" placeholder="填写退回原因或审核说明" />
          </label>
          <button class="driver-primary-button" :disabled="savingDocumentType === document.type" @tap="saveDocument(document)">
            {{ savingDocumentType === document.type ? "保存中..." : "保存证件" }}
          </button>
        </view>
      </view>
    </view>

    <AdminMobileNav active="drivers" />
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { onPullDownRefresh } from "@dcloudio/uni-app";
import AdminAccountMenu from "@/components/AdminAccountMenu.vue";
import AdminMobileNav from "@/components/AdminMobileNav.vue";
import {
  bindAdminDriverVehicle,
  bindAdminVehicleDriver,
  createAdminDriver,
  createAdminVehicle,
  fetchAdminDriverDocuments,
  fetchAdminDrivers,
  fetchAdminVehicles,
  fetchAdminVehicleOptions,
  getApiErrorMessage,
  requireAdminSession,
  resolveStorageUrl,
  resetAdminDriverPassword,
  unbindAdminDriverVehicle,
  unbindAdminVehicleDriver,
  updateAdminDriverDocument,
  updateAdminDriver,
  updateAdminVehicle,
  type AdminDriver,
  type AdminVehicle,
  type AdminVehicleOption,
  type DriverDocument,
} from "@/api/client";
import {
  getBindableDrivers,
  validateVehicleForm,
  vehicleStatusText,
  type VehicleForm,
  type VehicleStatus,
} from "@/features/admin/vehicle-management-model";
import { finishPullRefresh } from "@/utils/pull-refresh";

type AssetTab = "drivers" | "vehicles";
type VehicleDateField = "registeredAt" | "insuranceExpiresAt" | "inspectionExpiresAt" | "maintenanceDueAt";

const loading = ref(true);
const submitting = ref(false);
const resetting = ref(false);
const bindingBusy = ref(false);
const vehicleSubmitting = ref(false);
const vehicleBindingBusy = ref(false);
const panelOpen = ref(false);
const vehiclePanelOpen = ref(false);
const documentPanelOpen = ref(false);
const documentLoading = ref(false);
const savingDocumentType = ref("");
const documentLocalUrls = ref<Record<string, string>>({});
const activeAssetTab = ref<AssetTab>("drivers");
const drivers = ref<AdminDriver[]>([]);
const allDrivers = ref<AdminDriver[]>([]);
const vehicles = ref<AdminVehicleOption[]>([]);
const adminVehicles = ref<AdminVehicle[]>([]);
const driverDocuments = ref<DriverDocument[]>([]);
const editingDriver = ref<AdminDriver | null>(null);
const editingVehicle = ref<AdminVehicle | null>(null);
const newPassword = ref("");
const selectedVehicleIndex = ref(0);
const selectedDriverBindIndex = ref(0);
const driverSearchKeyword = ref("");
const vehicleSearchKeyword = ref("");
const form = ref({
  name: "",
  phone: "",
  initialPassword: "",
  status: "active" as "active" | "disabled",
});
const vehicleForm = ref<VehicleForm>(emptyVehicleForm());
const documentStatusOptions = [
  { value: "missing", label: "未上传" },
  { value: "pending", label: "待审核" },
  { value: "approved", label: "已通过" },
  { value: "rejected", label: "已退回" },
  { value: "expired", label: "已过期" },
];
const documentStatusLabels = documentStatusOptions.map((status) => status.label);
const vehicleStatusOptions: Array<{ value: Exclude<VehicleStatus, "">; label: string }> = [
  { value: "available", label: vehicleStatusText("available") },
  { value: "maintenance", label: vehicleStatusText("maintenance") },
  { value: "disabled", label: vehicleStatusText("disabled") },
];
const vehicleStatusLabels = vehicleStatusOptions.map((status) => status.label);

const activeCount = computed(() => drivers.value.filter((driver) => driver.status === "active").length);
const vehicleActiveCount = computed(() => adminVehicles.value.filter((vehicle) => vehicle.status === "available").length);
const vehicleUnavailableCount = computed(
  () => adminVehicles.value.filter((vehicle) => vehicle.status === "maintenance" || vehicle.status === "disabled").length,
);
const submitDisabled = computed(
  () =>
    submitting.value ||
    form.value.name.trim().length < 1 ||
    form.value.phone.trim().length < 6 ||
    (!editingDriver.value && form.value.initialPassword.length < 6),
);
const resetDisabled = computed(() => resetting.value || newPassword.value.length < 6 || !editingDriver.value);
const availableVehicles = computed(() => {
  const boundIds = new Set(editingDriver.value?.boundVehicles.map((vehicle) => vehicle.id) ?? []);
  return vehicles.value.filter((vehicle) => vehicle.status === "available" && !boundIds.has(vehicle.id));
});
const availableVehicleLabels = computed(() =>
  availableVehicles.value.map((vehicle) => `${vehicle.plateNumber}${vehicle.vehicleType ? ` · ${vehicle.vehicleType}` : ""}`),
);
const selectedVehicleName = computed(() => availableVehicleLabels.value[selectedVehicleIndex.value] ?? "暂无可绑定车辆");
const bindDisabled = computed(
  () => bindingBusy.value || !editingDriver.value || !availableVehicles.value[selectedVehicleIndex.value],
);
const bindableDrivers = computed(() => {
  const boundDriverIds = editingVehicle.value?.boundDrivers.map((driver) => driver.id) ?? [];
  return getBindableDrivers(allDrivers.value, boundDriverIds);
});
const bindableDriverLabels = computed(() =>
  bindableDrivers.value.map((driver) => `${driver.name}${driver.phone ? ` · ${driver.phone}` : ""}`),
);
const selectedBindableDriverName = computed(() => bindableDriverLabels.value[selectedDriverBindIndex.value] ?? "暂无可绑定司机");
const vehicleBindDisabled = computed(
  () => vehicleBindingBusy.value || !editingVehicle.value || !bindableDrivers.value[selectedDriverBindIndex.value],
);
const vehicleStatusIndex = computed(() =>
  Math.max(0, vehicleStatusOptions.findIndex((status) => status.value === vehicleForm.value.status)),
);
const vehicleSubmitDisabled = computed(() => vehicleSubmitting.value || validateVehicleForm(vehicleForm.value).length > 0);
const searchKeyword = computed({
  get() {
    return activeAssetTab.value === "vehicles" ? vehicleSearchKeyword.value : driverSearchKeyword.value;
  },
  set(value: string) {
    if (activeAssetTab.value === "vehicles") {
      vehicleSearchKeyword.value = value;
    } else {
      driverSearchKeyword.value = value;
    }
  },
});

onMounted(() => {
  if (!requireAdminSession()) return;
  loadDrivers();
});

onPullDownRefresh(() => {
  void finishPullRefresh(loadDrivers);
});

async function loadDrivers() {
  loading.value = true;
  try {
    const driverKeyword = driverSearchKeyword.value.trim() || undefined;
    const vehicleKeyword = vehicleSearchKeyword.value.trim() || undefined;
    const driverRowsPromise = fetchAdminDrivers(driverKeyword);
    const allDriverRowsPromise = driverKeyword ? fetchAdminDrivers() : driverRowsPromise;
    const [driverRows, vehicleRows, adminVehicleRows, allDriverRows] = await Promise.all([
      driverRowsPromise,
      fetchAdminVehicleOptions(),
      fetchAdminVehicles(vehicleKeyword),
      allDriverRowsPromise,
    ]);
    drivers.value = driverRows;
    allDrivers.value = allDriverRows;
    vehicles.value = vehicleRows;
    adminVehicles.value = adminVehicleRows;
  } finally {
    loading.value = false;
  }
}

function clearSearch() {
  searchKeyword.value = "";
  void loadDrivers();
}

function setAssetTab(tab: AssetTab) {
  activeAssetTab.value = tab;
}

function openActiveCreatePanel() {
  if (activeAssetTab.value === "vehicles") {
    openCreateVehiclePanel();
    return;
  }
  openCreatePanel();
}

function openCreatePanel() {
  editingDriver.value = null;
  newPassword.value = "";
  form.value = {
    name: "",
    phone: "",
    initialPassword: "123456",
    status: "active",
  };
  panelOpen.value = true;
}

function openEditPanel(driver: AdminDriver) {
  editingDriver.value = driver;
  newPassword.value = "";
  selectedVehicleIndex.value = 0;
  form.value = {
    name: driver.name,
    phone: driver.phone,
    initialPassword: "",
    status: driver.status === "active" ? "active" : "disabled",
  };
  panelOpen.value = true;
}

function closePanel() {
  if (!submitting.value && !resetting.value) {
    panelOpen.value = false;
    documentPanelOpen.value = false;
  }
}

function setStatus(event: { detail: { value: boolean } }) {
  form.value.status = event.detail.value ? "active" : "disabled";
}

async function submitDriver() {
  if (submitDisabled.value) return;
  submitting.value = true;
  try {
    if (editingDriver.value) {
      const updated = await updateAdminDriver(editingDriver.value.id, {
        name: form.value.name.trim(),
        phone: form.value.phone.trim(),
        status: form.value.status,
      });
      await refreshDrivers(updated.id);
    } else {
      await createAdminDriver({
        name: form.value.name.trim(),
        phone: form.value.phone.trim(),
        initialPassword: form.value.initialPassword,
      });
      await loadDrivers();
      panelOpen.value = false;
    }
    uni.showToast({ title: "已保存", icon: "success" });
  } catch (error) {
    uni.showToast({ title: getApiErrorMessage(error, "保存失败，请稍后重试"), icon: "none" });
  } finally {
    submitting.value = false;
  }
}

async function resetPassword() {
  if (resetDisabled.value || !editingDriver.value) return;
  resetting.value = true;
  try {
    await resetAdminDriverPassword(editingDriver.value.id, newPassword.value);
    newPassword.value = "";
    uni.showToast({ title: "已重置", icon: "success" });
  } catch (error) {
    uni.showToast({ title: getApiErrorMessage(error, "重置失败，请稍后重试"), icon: "none" });
  } finally {
    resetting.value = false;
  }
}

function selectVehicle(event: { detail: { value: number } }) {
  selectedVehicleIndex.value = Number(event.detail.value);
}

async function bindVehicle() {
  if (bindDisabled.value || !editingDriver.value) return;
  const vehicle = availableVehicles.value[selectedVehicleIndex.value];
  if (!vehicle) return;

  bindingBusy.value = true;
  try {
    await bindAdminDriverVehicle(editingDriver.value.id, vehicle.id);
    await refreshEditingDriver(editingDriver.value.id);
    await refreshVehicles();
    vehicles.value = await fetchAdminVehicleOptions();
    selectedVehicleIndex.value = 0;
    uni.showToast({ title: "已绑定", icon: "success" });
  } catch (error) {
    uni.showToast({ title: getApiErrorMessage(error, "绑定失败，请确认车辆可用"), icon: "none" });
  } finally {
    bindingBusy.value = false;
  }
}

async function unbindVehicle(vehicleId: string) {
  if (!editingDriver.value) return;
  bindingBusy.value = true;
  try {
    await unbindAdminDriverVehicle(editingDriver.value.id, vehicleId);
    await refreshEditingDriver(editingDriver.value.id);
    await refreshVehicles();
    vehicles.value = await fetchAdminVehicleOptions();
    selectedVehicleIndex.value = 0;
    uni.showToast({ title: "已解绑", icon: "success" });
  } catch (error) {
    uni.showToast({ title: getApiErrorMessage(error, "解绑失败，请稍后重试"), icon: "none" });
  } finally {
    bindingBusy.value = false;
  }
}

async function refreshEditingDriver(driverId: string) {
  await refreshDrivers(driverId);
}

async function refreshDrivers(driverId?: string) {
  const driverKeyword = driverSearchKeyword.value.trim() || undefined;
  const driverRowsPromise = fetchAdminDrivers(driverKeyword);
  const allDriverRowsPromise = driverKeyword ? fetchAdminDrivers() : driverRowsPromise;
  const [freshDrivers, freshAllDrivers] = await Promise.all([driverRowsPromise, allDriverRowsPromise]);
  drivers.value = freshDrivers;
  allDrivers.value = freshAllDrivers;
  if (driverId) {
    editingDriver.value = freshAllDrivers.find((driver) => driver.id === driverId) ?? editingDriver.value;
  }
}

function emptyVehicleForm(): VehicleForm {
  return {
    plateNumber: "",
    vehicleType: "",
    brandModel: "",
    loadCapacityTons: "",
    registeredAt: "",
    insuranceExpiresAt: "",
    inspectionExpiresAt: "",
    maintenanceDueAt: "",
    imageUrl: "",
    note: "",
    status: "available",
  };
}

function coerceVehicleStatus(status: string): VehicleStatus {
  return status === "available" || status === "maintenance" || status === "disabled" ? status : "";
}

function optionalFormValue(value: string) {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function vehiclePayload() {
  return {
    plateNumber: vehicleForm.value.plateNumber.trim(),
    vehicleType: optionalFormValue(vehicleForm.value.vehicleType),
    brandModel: optionalFormValue(vehicleForm.value.brandModel),
    loadCapacityTons: optionalFormValue(vehicleForm.value.loadCapacityTons),
    registeredAt: optionalFormValue(vehicleForm.value.registeredAt),
    insuranceExpiresAt: optionalFormValue(vehicleForm.value.insuranceExpiresAt),
    inspectionExpiresAt: optionalFormValue(vehicleForm.value.inspectionExpiresAt),
    maintenanceDueAt: optionalFormValue(vehicleForm.value.maintenanceDueAt),
    imageUrl: optionalFormValue(vehicleForm.value.imageUrl),
    note: optionalFormValue(vehicleForm.value.note),
  };
}

function openCreateVehiclePanel() {
  editingVehicle.value = null;
  selectedDriverBindIndex.value = 0;
  vehicleForm.value = emptyVehicleForm();
  vehiclePanelOpen.value = true;
}

function openEditVehiclePanel(vehicle: AdminVehicle) {
  editingVehicle.value = vehicle;
  selectedDriverBindIndex.value = 0;
  vehicleForm.value = {
    plateNumber: vehicle.plateNumber,
    vehicleType: vehicle.vehicleType ?? "",
    brandModel: vehicle.brandModel ?? "",
    loadCapacityTons: vehicle.loadCapacityTons ?? "",
    registeredAt: dateInputValue(vehicle.registeredAt),
    insuranceExpiresAt: dateInputValue(vehicle.insuranceExpiresAt),
    inspectionExpiresAt: dateInputValue(vehicle.inspectionExpiresAt),
    maintenanceDueAt: dateInputValue(vehicle.maintenanceDueAt),
    imageUrl: vehicle.imageUrl ?? "",
    note: vehicle.note ?? "",
    status: coerceVehicleStatus(vehicle.status),
  };
  vehiclePanelOpen.value = true;
}

function closeVehiclePanel() {
  if (!vehicleSubmitting.value && !vehicleBindingBusy.value) {
    vehiclePanelOpen.value = false;
  }
}

function setVehicleDate(field: VehicleDateField, event: { detail: { value: string } }) {
  vehicleForm.value[field] = event.detail.value;
}

function setVehicleStatus(event: { detail: { value: number } }) {
  vehicleForm.value.status = vehicleStatusOptions[Number(event.detail.value)]?.value ?? vehicleForm.value.status;
}

async function submitVehicle() {
  const errors = validateVehicleForm(vehicleForm.value);
  if (vehicleSubmitting.value || errors.length > 0) {
    if (errors[0]) uni.showToast({ title: errors[0], icon: "none" });
    return;
  }

  vehicleSubmitting.value = true;
  try {
    if (editingVehicle.value) {
      const updated = await updateAdminVehicle(editingVehicle.value.id, {
        ...vehiclePayload(),
        status: vehicleForm.value.status,
      });
      editingVehicle.value = updated;
    } else {
      await createAdminVehicle(vehiclePayload());
      vehiclePanelOpen.value = false;
    }
    await loadDrivers();
    if (editingVehicle.value) {
      editingVehicle.value = adminVehicles.value.find((vehicle) => vehicle.id === editingVehicle.value?.id) ?? editingVehicle.value;
    }
    uni.showToast({ title: "已保存", icon: "success" });
  } catch (error) {
    uni.showToast({ title: getApiErrorMessage(error, "车辆保存失败，请稍后重试"), icon: "none" });
  } finally {
    vehicleSubmitting.value = false;
  }
}

async function refreshVehicles(vehicleId?: string) {
  adminVehicles.value = await fetchAdminVehicles(vehicleSearchKeyword.value.trim() || undefined);
  if (vehicleId) {
    editingVehicle.value = adminVehicles.value.find((vehicle) => vehicle.id === vehicleId) ?? editingVehicle.value;
  } else if (editingVehicle.value) {
    editingVehicle.value = adminVehicles.value.find((vehicle) => vehicle.id === editingVehicle.value?.id) ?? editingVehicle.value;
  }
}

function selectDriverBind(event: { detail: { value: number } }) {
  selectedDriverBindIndex.value = Number(event.detail.value);
}

async function bindVehicleDriver() {
  if (vehicleBindDisabled.value || !editingVehicle.value) return;
  const driver = bindableDrivers.value[selectedDriverBindIndex.value];
  if (!driver) return;

  vehicleBindingBusy.value = true;
  try {
    await bindAdminVehicleDriver(editingVehicle.value.id, driver.id);
    await loadDrivers();
    editingVehicle.value = adminVehicles.value.find((vehicle) => vehicle.id === editingVehicle.value?.id) ?? editingVehicle.value;
    selectedDriverBindIndex.value = 0;
    uni.showToast({ title: "已绑定", icon: "success" });
  } catch (error) {
    uni.showToast({ title: getApiErrorMessage(error, "绑定失败，请确认司机可用"), icon: "none" });
  } finally {
    vehicleBindingBusy.value = false;
  }
}

async function unbindVehicleDriver(driverId: string) {
  if (!editingVehicle.value) return;
  vehicleBindingBusy.value = true;
  try {
    await unbindAdminVehicleDriver(editingVehicle.value.id, driverId);
    await loadDrivers();
    editingVehicle.value = adminVehicles.value.find((vehicle) => vehicle.id === editingVehicle.value?.id) ?? editingVehicle.value;
    selectedDriverBindIndex.value = 0;
    uni.showToast({ title: "已解绑", icon: "success" });
  } catch (error) {
    uni.showToast({ title: getApiErrorMessage(error, "解绑失败，请稍后重试"), icon: "none" });
  } finally {
    vehicleBindingBusy.value = false;
  }
}

async function openDocumentPanel() {
  if (!editingDriver.value) return;
  documentPanelOpen.value = true;
  documentLoading.value = true;
  try {
    driverDocuments.value = await fetchAdminDriverDocuments(editingDriver.value.id);
    cacheDocumentImages(driverDocuments.value);
  } catch (error) {
    uni.showToast({ title: getApiErrorMessage(error, "证件加载失败"), icon: "none" });
  } finally {
    documentLoading.value = false;
  }
}

function closeDocumentPanel() {
  if (!savingDocumentType.value) {
    documentPanelOpen.value = false;
  }
}

function documentStatusText(status: string) {
  return documentStatusOptions.find((option) => option.value === status)?.label ?? status;
}

function documentStatusIndex(status: string) {
  return Math.max(0, documentStatusOptions.findIndex((option) => option.value === status));
}

function setDocumentStatus(document: DriverDocument, event: { detail: { value: number } }) {
  document.status = documentStatusOptions[Number(event.detail.value)]?.value ?? document.status;
}

function dateInputValue(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function setDocumentExpiresAt(document: DriverDocument, event: { detail: { value: string } }) {
  document.expiresAt = event.detail.value;
}

function documentImageUrl(storageKey: string) {
  return resolveStorageUrl(storageKey);
}

function documentDisplayUrl(document: DriverDocument) {
  if (!document.storageKey) return "";
  return documentLocalUrls.value[document.type] ?? documentImageUrl(document.storageKey);
}

function downloadDocumentImage(document: DriverDocument) {
  return new Promise<void>((resolve) => {
    if (!document.storageKey) {
      resolve();
      return;
    }
    const url = documentImageUrl(document.storageKey);
    if (/^(file:|wxfile:|blob:|data:image)/.test(url)) {
      documentLocalUrls.value = { ...documentLocalUrls.value, [document.type]: url };
      resolve();
      return;
    }
    uni.downloadFile({
      url,
      success: (response) => {
        if (response.statusCode >= 200 && response.statusCode < 300 && response.tempFilePath) {
          documentLocalUrls.value = { ...documentLocalUrls.value, [document.type]: response.tempFilePath };
        }
        resolve();
      },
      fail: () => resolve(),
    });
  });
}

function cacheDocumentImages(documents: DriverDocument[]) {
  void Promise.all(documents.map((document) => downloadDocumentImage(document)));
}

function previewDocument(document: DriverDocument) {
  if (!document.storageKey) return;
  const url = documentDisplayUrl(document);
  uni.previewImage({ urls: [url], current: url });
}

async function saveDocument(document: DriverDocument) {
  if (!editingDriver.value) return;
  savingDocumentType.value = document.type;
  try {
    const saved = await updateAdminDriverDocument(editingDriver.value.id, document.type, {
      status: document.status,
      expiresAt: dateInputValue(document.expiresAt) || undefined,
      note: document.note ?? undefined,
    });
    driverDocuments.value = driverDocuments.value.map((item) => (item.type === saved.type ? saved : item));
    cacheDocumentImages([saved]);
    uni.showToast({ title: "已保存", icon: "success" });
  } catch (error) {
    uni.showToast({ title: getApiErrorMessage(error, "证件保存失败"), icon: "none" });
  } finally {
    savingDocumentType.value = "";
  }
}

function vehicleText(driver: AdminDriver) {
  if (driver.boundVehicles.length === 0) return "暂未绑定车辆";
  return driver.boundVehicles.map((vehicle) => vehicle.plateNumber).join("、");
}

function vehicleDriverText(vehicle: AdminVehicle) {
  if (vehicle.boundDrivers.length === 0) return "暂未绑定司机";
  return vehicle.boundDrivers.map((driver) => driver.name).join("、");
}

function vehicleOperationalText(vehicle: AdminVehicle) {
  const unfinishedCount = vehicle.unfinishedTripCount ?? 0;
  if (unfinishedCount > 0) return `${unfinishedCount} 个未完成趟次`;
  return vehicle.operationalStatus || "暂无未完成趟次";
}
</script>

<style scoped>
.admin-page { padding-bottom: 96px; }
.driver-topbar { align-items: center; gap: 10px; }
.driver-topbar > view:first-child, .admin-content, .list-stack { display: grid; }
.admin-content {
  align-content: start;
  gap: 12px;
}
.asset-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  padding: 4px;
  border: 1px solid var(--driver-border);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.86);
}
.asset-tabs button {
  height: 38px;
  margin: 0;
  border-radius: 14px;
  background: transparent;
  color: var(--driver-muted);
  font-size: 14px;
  font-weight: 900;
}
.asset-tabs button.active {
  background: var(--driver-primary);
  color: #ffffff;
}
.list-stack {
  align-self: start;
  gap: 14px;
}
.driver-topbar > view:first-child { flex: 1; min-width: 0; gap: 2px; }
.admin-subbrand, .phone, .vehicle-row { color: var(--driver-muted); font-size: 12px; }
.driver-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.vehicle-summary {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.driver-summary view {
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
.driver-summary text:first-child {
  color: rgba(255,255,255,0.72);
  font-size: 12px;
  line-height: 16px;
}
.driver-summary text:last-child {
  overflow: hidden;
  font-size: 24px;
  font-weight: 900;
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
.driver-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px;
}
.driver-item:active { transform: scale(0.99); }
.vehicle-card {
  display: grid;
  gap: 10px;
  padding: 14px;
}
.vehicle-card:active { transform: scale(0.99); }
.vehicle-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}
.vehicle-card-head > view {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 4px;
}
.vehicle-plate {
  color: var(--driver-primary);
  font-size: 18px;
  font-weight: 900;
  overflow-wrap: anywhere;
}
.vehicle-meta,
.vehicle-detail-row {
  color: var(--driver-muted);
  font-size: 12px;
}
.vehicle-detail-row {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 5px;
}
.vehicle-detail-row text:last-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.vehicle-detail-row .material-symbols-outlined {
  flex: 0 0 auto;
  font-size: 16px;
}
.avatar {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: 20px;
  background: linear-gradient(135deg, var(--driver-primary), var(--driver-primary-2));
  color: #ffffff;
  font-size: 22px;
  font-weight: 900;
}
.driver-main {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 5px;
}
.name-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.driver-name {
  color: var(--driver-primary);
  font-size: 17px;
  font-weight: 800;
  overflow-wrap: anywhere;
}
.state-pill {
  flex: 0 0 auto;
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
.vehicle-row {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.vehicle-row text:last-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.vehicle-row .material-symbols-outlined { font-size: 16px; }
.chevron {
  flex: 0 0 auto;
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
.switch-card view,
.password-panel > view,
.panel-head > view,
.binding-row > view {
  display: grid;
  gap: 3px;
}
.switch-card text:first-child,
.password-panel > view text:first-child,
.panel-head > view text:first-child,
.binding-row > view text:first-child {
  color: var(--driver-primary);
  font-size: 14px;
  font-weight: 800;
}
.switch-card text:last-child,
.password-panel > view text:last-child,
.panel-head > view text:last-child,
.binding-row > view text:last-child,
.binding-empty {
  color: var(--driver-muted);
  font-size: 12px;
}
.password-panel,
.binding-panel,
.document-panel-entry {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid rgba(18, 98, 184, 0.12);
  border-radius: 18px;
  background: #f7faff;
}
.document-panel-entry {
  grid-template-columns: minmax(0, 1fr) 76px;
  align-items: center;
}
.document-panel-entry > view {
  display: grid;
  gap: 3px;
}
.document-panel-entry > view text:first-child {
  color: var(--driver-primary);
  font-size: 14px;
  font-weight: 900;
}
.document-panel-entry > view text:last-child {
  color: var(--driver-muted);
  font-size: 12px;
  line-height: 18px;
}
.document-panel-entry button {
  height: 40px;
  margin: 0;
  border-radius: 14px;
  background: var(--driver-primary);
  color: #ffffff;
  font-size: 12px;
  font-weight: 900;
}
.document-mask {
  z-index: 90;
  background: rgba(11, 47, 91, 0.48);
}
.document-sheet {
  width: calc(100vw - 20px);
  max-height: 86vh;
  padding-left: 14px;
  padding-right: 14px;
}
.document-card {
  display: grid;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--driver-border);
  border-radius: 18px;
  background: #f7faff;
}
.document-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}
.document-head > view {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 3px;
}
.document-head > view text:first-child {
  color: var(--driver-primary);
  font-size: 15px;
  font-weight: 900;
}
.document-head > view text:last-child {
  color: var(--driver-muted);
  font-size: 12px;
}
.document-thumb,
.document-empty-thumb {
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  height: 176px;
  overflow: hidden;
  border: 1px solid var(--driver-border);
  border-radius: 18px;
  background: #eef4ff;
  color: var(--driver-muted);
}
.document-thumb-image {
  width: 100%;
  height: 176px;
}
.document-thumb > text {
  position: absolute;
  right: 10px;
  bottom: 10px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(11, 47, 91, 0.72);
  color: #ffffff;
  font-size: 12px;
  font-weight: 900;
}
.document-empty-thumb {
  gap: 6px;
  font-size: 13px;
}
.document-empty-thumb .material-symbols-outlined {
  font-size: 28px;
}
textarea {
  box-sizing: border-box;
  width: 100%;
  min-height: 72px;
  padding: 10px 12px;
  border: 1px solid var(--driver-border);
  border-radius: 14px;
  background: #ffffff;
  color: var(--driver-ink);
  font-size: 13px;
  line-height: 20px;
}
.empty-card.compact {
  padding: 18px 10px;
  font-size: 12px;
}
.panel-head,
.binding-row,
.bind-form {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.binding-row {
  padding: 10px;
  border-radius: 14px;
  background: #ffffff;
}
.binding-row > view {
  flex: 1;
  min-width: 0;
}
.binding-row button,
.bind-form button {
  flex: 0 0 auto;
  height: 38px;
  margin: 0;
  padding: 0 14px;
  border-radius: 14px;
  background: rgba(214, 79, 79, 0.1);
  color: var(--driver-red);
  font-size: 12px;
  font-weight: 900;
}
.bind-form button {
  background: var(--driver-primary);
  color: #ffffff;
}
.picker-field {
  box-sizing: border-box;
  width: 100%;
  height: 42px;
  padding: 0 12px;
  overflow: hidden;
  border: 1px solid var(--driver-border);
  border-radius: 14px;
  background: #ffffff;
  color: var(--driver-ink);
  font-size: 13px;
  line-height: 42px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bind-form picker {
  flex: 1;
  min-width: 0;
}
.password-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 82px;
  gap: 8px;
}
.password-row button {
  height: 46px;
  margin: 0;
  border-radius: 16px;
  background: var(--driver-primary);
  color: #ffffff;
  font-size: 13px;
  font-weight: 900;
}
@media (max-width: 360px) {
  .driver-summary { gap: 8px; }
  .driver-summary view { height: 76px; padding: 10px 12px; }
  .driver-summary text:last-child { font-size: 20px; line-height: 26px; }
  .vehicle-summary { grid-template-columns: 1fr; }
  .form-grid { grid-template-columns: 1fr; }
}
</style>
