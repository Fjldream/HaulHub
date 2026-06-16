<template>
  <view class="driver-page admin-page">
    <view class="driver-topbar">
      <view>
        <text class="driver-brand">拉货小票</text>
        <text class="admin-subbrand">HaulHub 管理端</text>
      </view>
      <button class="driver-icon-button" @tap="openTripActionMenu">
        <AppIcon name="add" />
      </button>
      <AdminAccountMenu />
    </view>

    <view class="driver-content admin-content">
      <section class="admin-hero">
        <view>
          <text class="hero-label">趟次管理</text>
          <text class="hero-title">{{ trips.length }}</text>
          <text class="hero-copy">{{ sessionName }} · 审核、退回与结算小票</text>
        </view>
        <view class="hero-icon"><AppIcon name="route" /></view>
      </section>

      <view class="status-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.value ?? 'all'"
          :class="{ active: statusFilter === tab.value }"
          @tap="setStatus(tab.value)"
        >
          {{ tab.label }}
        </button>
      </view>

      <view class="search-row">
        <AppIcon name="search" />
        <input v-model="searchKeyword" confirm-type="search" placeholder="搜索客户、车牌、司机、路线" @confirm="loadTrips" />
        <button v-if="searchKeyword" @tap="clearSearch">清除</button>
      </view>

      <section class="metric-grid">
        <view class="metric-card">
          <text>待处理</text>
          <text>{{ pendingCount }}</text>
        </view>
        <view class="metric-card">
          <text>已完成</text>
          <text>{{ completedCount }}</text>
        </view>
      </section>

      <section class="list-stack">
        <view v-if="loading" class="empty-card">正在加载趟次...</view>
        <view v-else-if="trips.length === 0" class="empty-card">暂无趟次数据</view>
        <article v-for="trip in trips" v-else :key="trip.id" class="driver-card trip-card">
          <view class="card-head">
            <view>
              <text class="card-title">{{ trip.tripNo }}</text>
              <text class="card-subtitle">{{ trip.customerName }}</text>
            </view>
            <text class="status-pill">{{ trip.statusText }}</text>
          </view>
          <view class="route-line">
            <text>{{ trip.loadLocation }}</text>
            <AppIcon name="arrow_forward" />
            <text>{{ trip.unloadLocation }}</text>
          </view>
          <view class="info-grid">
            <view><text>车辆</text><text>{{ trip.vehiclePlate }}</text></view>
            <view><text>司机</text><text>{{ trip.driverName }}</text></view>
            <view><text>费用</text><text>{{ trip.expenseTotal }}</text></view>
            <view><text>利润</text><text>{{ trip.profit }}</text></view>
          </view>
          <view class="card-footer">
            <text>{{ trip.createdAt }}</text>
            <text>{{ trip.actualFreight }}</text>
          </view>
          <view class="action-row">
            <button class="action-button ghost" :disabled="detailLoadingId === trip.id" @tap="openDetailPanel(trip)">
              <AppIcon name="receipt_long" />
              <text>{{ detailLoadingId === trip.id ? "加载中" : "费用明细" }}</text>
            </button>
            <button
              v-for="action in availableActions(trip)"
              :key="action.key"
              :class="['action-button', action.tone]"
              :disabled="actingTripId === trip.id"
              @tap="handleTripAction(trip, action.key)"
            >
              <AppIcon :name="action.icon" />
              <text>{{ actingTripId === trip.id ? "处理中" : action.label }}</text>
            </button>
          </view>
        </article>
        <view v-if="trips.length > 0" class="load-more-state">
          {{ loadingMore ? "加载中..." : hasMore ? "上拉加载更多" : "没有更多趟次了" }}
        </view>
      </section>
    </view>

    <view v-if="detailPanelOpen" class="sheet-mask" @tap="closeDetailPanel">
      <view class="edit-sheet detail-sheet" @tap.stop>
        <view class="sheet-head">
          <view>
            <text class="sheet-title">费用明细</text>
            <text class="sheet-subtitle">{{ detailTrip?.tripNo }} · {{ detailTrip?.customerName }}</text>
          </view>
          <button class="driver-icon-button" @tap="closeDetailPanel">
            <AppIcon name="close" />
          </button>
        </view>

        <view v-if="detailExpenses.length === 0" class="empty-card compact">暂无费用记录</view>
        <view v-for="expense in detailExpenses" v-else :key="expense.id" class="expense-card">
          <view class="expense-head">
            <view>
              <text>{{ expense.type }}</text>
              <text>{{ expense.occurredAt }}</text>
            </view>
            <text>{{ expense.amount }}</text>
          </view>
          <text class="expense-note">{{ expense.note }}</text>
          <view class="receipt-chip" :class="{ missing: expense.requiresReceipt && expense.receiptCount === 0 }">
            <AppIcon :name="expense.receiptCount > 0 ? 'task_alt' : 'error'" />
            <text>{{ receiptText(expense) }}</text>
          </view>
          <view v-if="expense.receiptImages.length > 0" class="receipt-preview-row">
            <view
              v-for="(receipt, index) in expense.receiptImages"
              :key="receipt.id"
              class="receipt-preview"
              @tap="previewExpenseReceipts(expense, index)"
            >
              <image class="receipt-preview-image" mode="aspectFill" :src="receiptDisplayUrl(receipt)" />
              <text>查看</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view v-if="createPanelOpen" class="sheet-mask" @tap="closeCreatePanel">
      <view class="edit-sheet" @tap.stop>
        <view class="sheet-head">
          <view>
            <text class="sheet-title">{{ tripPanelTitle }}</text>
            <text class="sheet-subtitle">{{ tripPanelSubtitle }}</text>
          </view>
          <button class="driver-icon-button" @tap="closeCreatePanel">
            <AppIcon name="close" />
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
            <text>司机</text>
            <picker :range="driverLabels" :value="selectedDriverIndex" @change="selectDriver">
              <view class="picker-field">{{ selectedDriverName }}</view>
            </picker>
          </label>
          <label class="wide-field">
            <text>客户名称</text>
            <input v-model="createForm.customerName" placeholder="请输入客户名称" />
          </label>
          <label class="location-label" :class="{ 'has-location-results': locationResults.load.length > 0 }">
            <text>装货地</text>
            <view class="location-picker">
              <view class="location-field">
                <input v-model="createForm.loadLocation" placeholder="例如：上海嘉定" @input="clearPreciseLocation('load')" />
                <button @tap="searchLocation('load')"><AppIcon name="search" /></button>
              </view>
              <view v-if="locationResults.load.length > 0" class="location-results">
                <button v-for="place in locationResults.load" :key="place.id || place.name" @tap="selectLocation('load', place)">
                  <text>{{ place.name }}</text>
                  <text>{{ place.city }} · {{ place.district }} · {{ place.address }}</text>
                </button>
              </view>
            </view>
            <text class="location-hint">{{ locationStatusText("load") }}</text>
          </label>
          <label class="location-label" :class="{ 'has-location-results': locationResults.unload.length > 0 }">
            <text>卸货地</text>
            <view class="location-picker">
              <view class="location-field">
                <input v-model="createForm.unloadLocation" placeholder="例如：杭州萧山" @input="clearPreciseLocation('unload')" />
                <button @tap="searchLocation('unload')"><AppIcon name="search" /></button>
              </view>
              <view v-if="locationResults.unload.length > 0" class="location-results">
                <button v-for="place in locationResults.unload" :key="place.id || place.name" @tap="selectLocation('unload', place)">
                  <text>{{ place.name }}</text>
                  <text>{{ place.city }} · {{ place.district }} · {{ place.address }}</text>
                </button>
              </view>
            </view>
            <text class="location-hint">{{ locationStatusText("unload") }}</text>
          </label>
          <label>
            <text>预估运费</text>
            <input v-model="createForm.estimatedFreight" inputmode="decimal" placeholder="可选" />
          </label>
          <label class="wide-field">
            <text>调度备注</text>
            <textarea v-model="createForm.driverNote" placeholder="给司机看的备注，可选" />
          </label>
        </view>

        <button class="driver-primary-button" :disabled="createDisabled" @tap="submitCreateTrip">
          {{ creating ? "保存中..." : editingTrip ? "保存修改" : "创建趟次" }}
        </button>
      </view>
    </view>

    <view v-if="manualBillingPanelOpen" class="sheet-mask" @tap="closeManualBillingPanel">
      <view class="edit-sheet manual-billing-sheet" @tap.stop>
        <view class="sheet-head">
          <view>
            <text class="sheet-title">补录账单</text>
            <text class="sheet-subtitle">录入已完成趟次，保存后计入利润</text>
          </view>
          <button class="driver-icon-button" @tap="closeManualBillingPanel">
            <AppIcon name="close" />
          </button>
        </view>

        <view class="form-grid">
          <label>
            <text>车辆</text>
            <picker :range="manualBillingVehicleLabels" :value="manualBillingVehicleIndex" @change="selectManualBillingVehicle">
              <view class="picker-field">{{ manualBillingVehicleName }}</view>
            </picker>
          </label>
          <label>
            <text>司机</text>
            <picker :range="manualBillingDriverLabels" :value="manualBillingDriverIndex" @change="selectManualBillingDriver">
              <view class="picker-field">{{ manualBillingDriverName }}</view>
            </picker>
          </label>
          <label class="wide-field">
            <text>客户名称</text>
            <input v-model="manualBillingForm.customerName" placeholder="请输入客户名称" />
          </label>
          <label>
            <text>实际运费</text>
            <input v-model="manualBillingForm.actualFreight" inputmode="decimal" placeholder="0.00" />
          </label>
          <label>
            <text>结算日期</text>
            <picker mode="date" :value="manualBillingForm.settledAt" @change="setManualBillingSettledAt">
              <view class="picker-field">{{ manualBillingForm.settledAt || "请选择日期" }}</view>
            </picker>
          </label>
          <label>
            <text>装货地</text>
            <input v-model="manualBillingForm.loadLocation" placeholder="例如：上海嘉定" />
          </label>
          <label>
            <text>卸货地</text>
            <input v-model="manualBillingForm.unloadLocation" placeholder="例如：杭州萧山" />
          </label>
          <label class="wide-field">
            <text>会计备注</text>
            <textarea v-model="manualBillingForm.accountingNote" placeholder="可选" />
          </label>
        </view>

        <view class="manual-mode-tabs">
          <button :class="{ active: manualBillingForm.expenseMode === 'details' }" @tap="setManualBillingMode('details')">
            明细费用
          </button>
          <button :class="{ active: manualBillingForm.expenseMode === 'total' }" @tap="setManualBillingMode('total')">
            总费用
          </button>
        </view>

        <view v-if="manualBillingForm.expenseMode === 'details'" class="manual-expense-stack">
          <view v-for="(expense, index) in manualBillingForm.expenses" :key="index" class="manual-expense-row">
            <view class="manual-expense-head">
              <text>费用 {{ index + 1 }}</text>
              <button class="compact-danger-button" @tap="removeManualBillingExpense(index)">
                删除
              </button>
            </view>
            <view class="manual-expense-grid">
              <label>
                <text>费用类型</text>
                <picker
                  :disabled="expenseTypes.length === 0"
                  :range="expenseTypeLabels"
                  :value="manualBillingExpenseTypeIndex(expense.expenseTypeId)"
                  @change="selectManualBillingExpenseType(index, $event)"
                >
                  <view class="picker-field">{{ manualBillingExpenseTypeLabel(expense.expenseTypeId) }}</view>
                </picker>
              </label>
              <label>
                <text>金额</text>
                <input v-model="expense.amount" inputmode="decimal" placeholder="0.00" />
              </label>
              <label>
                <text>发生日期</text>
                <picker mode="date" :value="expense.occurredAt" @change="setManualBillingExpenseDate(index, $event)">
                  <view class="picker-field">{{ expense.occurredAt || "请选择日期" }}</view>
                </picker>
              </label>
              <label>
                <text>备注</text>
                <input v-model="expense.note" placeholder="可选" />
              </label>
            </view>
          </view>
          <button class="manual-add-expense" @tap="addManualBillingExpense">
            <AppIcon name="add" />
            <text>添加费用</text>
          </button>
        </view>

        <view v-else class="form-grid">
          <label class="wide-field">
            <text>总费用</text>
            <input v-model="manualBillingForm.totalExpense" inputmode="decimal" placeholder="0.00" />
          </label>
        </view>

        <view class="manual-preview-grid">
          <view><text>实际运费</text><text>{{ manualBillingPreview.actualFreight }}</text></view>
          <view><text>费用合计</text><text>{{ manualBillingPreview.expenseTotal }}</text></view>
          <view><text>利润</text><text>{{ manualBillingPreview.profit }}</text></view>
          <view><text>利润率</text><text>{{ formatPreviewRate(manualBillingPreview.profitRate) }}</text></view>
        </view>

        <button class="driver-primary-button" :disabled="manualBillingDisabled" @tap="submitManualBilling">
          {{ manualBillingSubmitting ? "保存中..." : "保存补录账单" }}
        </button>
      </view>
    </view>

    <view v-if="settlePanelOpen" class="sheet-mask" @tap="closeSettlePanel">
      <view class="edit-sheet" @tap.stop>
        <view class="sheet-head">
          <view>
            <text class="sheet-title">结算趟次</text>
            <text class="sheet-subtitle">{{ selectedTrip?.tripNo }} · 录入实际运费后完成小票</text>
          </view>
          <button class="driver-icon-button" @tap="closeSettlePanel">
            <AppIcon name="close" />
          </button>
        </view>
        <label>
          <text>实际运费</text>
          <input v-model="actualFreight" inputmode="decimal" placeholder="0.00" />
        </label>
        <button class="driver-primary-button" :disabled="settleDisabled" @tap="submitSettle">
          {{ actingTripId ? "结算中..." : "确认结算" }}
        </button>
      </view>
    </view>

    <AdminMobileNav active="trips" />
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { onPullDownRefresh, onReachBottom } from "@dcloudio/uni-app";
import AdminAccountMenu from "@/components/AdminAccountMenu.vue";
import AdminMobileNav from "@/components/AdminMobileNav.vue";
import {
  createAdminManualCompletedTrip,
  createAdminTrip,
  fetchAdminExpenseTypes,
  fetchAdminDrivers,
  fetchAdminTripDetail,
  fetchAdminTripsPage,
  fetchAdminVehicleOptions,
  getApiErrorMessage,
  getDriverSession,
  requireAdminSession,
  resolveStorageUrl,
  returnAdminTrip,
  searchMapPlaces,
  settleAdminTrip,
  startAdminTripReview,
  updateAdminTrip,
  type AdminDriver,
  type AdminExpenseType,
  type AdminTrip,
  type AdminTripExpense,
  type AdminVehicleOption,
  type MapPlace,
} from "@/api/client";
import {
  buildManualBillingPayload,
  calculateManualBillingPreview,
  getDriversBoundToVehicle,
  validateManualBillingForm,
  type ManualBillingForm,
} from "@/features/admin/manual-billing-model";
import { finishPullRefresh } from "@/utils/pull-refresh";

type TripActionKey = "edit" | "review" | "return" | "settle";

const loading = ref(true);
const loadingMore = ref(false);
const creating = ref(false);
const actingTripId = ref("");
const detailLoadingId = ref("");
const trips = ref<AdminTrip[]>([]);
const page = ref(1);
const hasMore = ref(false);
const pageSize = 20;
const vehicles = ref<AdminVehicleOption[]>([]);
const drivers = ref<AdminDriver[]>([]);
const expenseTypes = ref<AdminExpenseType[]>([]);
const statusFilter = ref<string | undefined>(undefined);
const searchKeyword = ref("");
const createPanelOpen = ref(false);
const detailPanelOpen = ref(false);
const manualBillingPanelOpen = ref(false);
const manualBillingSubmitting = ref(false);
const settlePanelOpen = ref(false);
const selectedTrip = ref<AdminTrip | null>(null);
const editingTrip = ref<AdminTrip | null>(null);
const detailTrip = ref<AdminTrip | null>(null);
const detailExpenses = ref<AdminTripExpense[]>([]);
const receiptLocalUrls = ref<Record<string, string>>({});
const selectedVehicleIndex = ref(0);
const selectedDriverIndex = ref(0);
const manualBillingVehicleIndex = ref(0);
const manualBillingDriverIndex = ref(0);
const actualFreight = ref("");
const manualBillingForm = ref<ManualBillingForm>(emptyManualBillingForm(todayInput()));
const createForm = ref({
  customerName: "",
  loadLocation: "",
  loadAddress: "",
  loadLatitude: undefined as number | undefined,
  loadLongitude: undefined as number | undefined,
  loadPoiId: "",
  unloadLocation: "",
  unloadAddress: "",
  unloadLatitude: undefined as number | undefined,
  unloadLongitude: undefined as number | undefined,
  unloadPoiId: "",
  locationProvider: "",
  estimatedFreight: "",
  driverNote: "",
});
const locationResults = ref<{ load: MapPlace[]; unload: MapPlace[] }>({ load: [], unload: [] });

const sessionName = computed(() => getDriverSession()?.teamName ?? getDriverSession()?.name ?? "管理员");
const settleDisabled = computed(
  () => !!actingTripId.value || !selectedTrip.value || !/^\d+(\.\d{1,2})?$/.test(actualFreight.value.trim()),
);
const vehicleLabels = computed(() =>
  vehicles.value.map((vehicle) => vehicle.plateNumber),
);
const selectedVehicle = computed(() => vehicles.value[selectedVehicleIndex.value] ?? null);
const eligibleDrivers = computed(() => {
  const vehicle = selectedVehicle.value;
  if (!vehicle) return [];
  return drivers.value.filter((driver) =>
    driver.boundVehicles.some((boundVehicle) => boundVehicle.id === vehicle.id),
  );
});
const driverLabels = computed(() =>
  eligibleDrivers.value.map((driver) => driver.name),
);
const selectedVehicleName = computed(() => vehicleLabels.value[selectedVehicleIndex.value] ?? "请选择车辆");
const selectedDriverName = computed(() => driverLabels.value[selectedDriverIndex.value] ?? "请选择司机");
const manualBillingVehicleLabels = computed(() =>
  vehicles.value.map((vehicle) => vehicle.plateNumber),
);
const manualBillingVehicle = computed(() => vehicles.value[manualBillingVehicleIndex.value] ?? null);
const manualBillingEligibleDrivers = computed(() =>
  getDriversBoundToVehicle(drivers.value, manualBillingForm.value.vehicleId),
);
const manualBillingDriverLabels = computed(() =>
  manualBillingEligibleDrivers.value.map((driver) => driver.name),
);
const manualBillingVehicleName = computed(() => manualBillingVehicleLabels.value[manualBillingVehicleIndex.value] ?? "请选择车辆");
const manualBillingDriverName = computed(() => manualBillingDriverLabels.value[manualBillingDriverIndex.value] ?? "请选择司机");
const expenseTypeLabels = computed(() => expenseTypes.value.map((type) => type.name));
const manualBillingPreview = computed(() => calculateManualBillingPreview(manualBillingForm.value));
const manualBillingErrors = computed(() => validateManualBillingForm(manualBillingForm.value));
const manualBillingDisabled = computed(() => manualBillingSubmitting.value);
const createDisabled = computed(
  () =>
    creating.value ||
    !selectedVehicle.value ||
    !eligibleDrivers.value[selectedDriverIndex.value] ||
    !createForm.value.customerName.trim() ||
    !createForm.value.loadLocation.trim() ||
    !createForm.value.unloadLocation.trim() ||
    (!!createForm.value.estimatedFreight.trim() &&
      !/^\d+(\.\d{1,2})?$/.test(createForm.value.estimatedFreight.trim())),
);
const tripPanelTitle = computed(() => (editingTrip.value ? "编辑趟次" : "新增趟次"));
const tripPanelSubtitle = computed(() =>
  editingTrip.value ? `${editingTrip.value.tripNo} · 修改未完成小票信息` : "选择车辆和已绑定司机后创建小票",
);

const tabs = [
  { label: "全部", value: undefined },
  { label: "待出车", value: "assigned" },
  { label: "进行中", value: "in_progress" },
  { label: "已提交", value: "submitted" },
  { label: "审核中", value: "under_review" },
  { label: "已完成", value: "completed" },
  { label: "已撤销", value: "cancelled" },
];

const pendingCount = computed(
  () => trips.value.filter((trip) => ["assigned", "in_progress", "submitted", "under_review"].includes(trip.status)).length,
);
const completedCount = computed(() => trips.value.filter((trip) => trip.status === "completed").length);

onMounted(() => {
  if (!requireAdminSession()) return;
  loadPageData();
});

onReachBottom(() => {
  void loadMoreTrips();
});

onPullDownRefresh(() => {
  void finishPullRefresh(loadPageData);
});

async function loadPageData() {
  loading.value = true;
  try {
    const [tripPage, vehicleRows, driverRows] = await Promise.all([
      fetchAdminTripsPage({ status: statusFilter.value, q: searchKeyword.value.trim() || undefined, page: 1, pageSize }),
      fetchAdminVehicleOptions(),
      fetchAdminDrivers(),
    ]);
    trips.value = tripPage.items;
    page.value = tripPage.page;
    hasMore.value = tripPage.hasMore;
    vehicles.value = vehicleRows.filter((vehicle) => vehicle.status === "available");
    drivers.value = driverRows.filter((driver) => driver.status === "active");
    normalizeDriverIndex();
    normalizeManualBillingDriverIndex();
    void loadManualBillingExpenseTypes();
  } finally {
    loading.value = false;
  }
}

async function loadManualBillingExpenseTypes() {
  try {
    expenseTypes.value = (await fetchAdminExpenseTypes()).filter((type) => type.enabled);
  } catch {
    expenseTypes.value = [];
  }
}

async function loadTrips() {
  loading.value = true;
  try {
    const result = await fetchAdminTripsPage({
      status: statusFilter.value,
      q: searchKeyword.value.trim() || undefined,
      page: 1,
      pageSize,
    });
    trips.value = result.items;
    page.value = result.page;
    hasMore.value = result.hasMore;
  } finally {
    loading.value = false;
  }
}

async function loadMoreTrips() {
  if (loading.value || loadingMore.value || !hasMore.value) return;
  loadingMore.value = true;
  try {
    const result = await fetchAdminTripsPage({
      status: statusFilter.value,
      q: searchKeyword.value.trim() || undefined,
      page: page.value + 1,
      pageSize,
    });
    trips.value = [...trips.value, ...result.items];
    page.value = result.page;
    hasMore.value = result.hasMore;
  } finally {
    loadingMore.value = false;
  }
}

function setStatus(status: string | undefined) {
  statusFilter.value = status;
  void loadTrips();
}

function clearSearch() {
  searchKeyword.value = "";
  void loadTrips();
}

async function openDetailPanel(trip: AdminTrip) {
  detailLoadingId.value = trip.id;
  try {
    const detail = await fetchAdminTripDetail(trip.id);
    detailTrip.value = detail.trip;
    detailExpenses.value = detail.expenses;
    cacheReceiptImages(detail.expenses);
    detailPanelOpen.value = true;
  } catch (error) {
    uni.showToast({ title: getApiErrorMessage(error, "费用明细加载失败"), icon: "none" });
  } finally {
    detailLoadingId.value = "";
  }
}

function closeDetailPanel() {
  detailPanelOpen.value = false;
}

function receiptText(expense: AdminTripExpense) {
  if (expense.receiptCount > 0) return `已上传 ${expense.receiptCount} 张票据`;
  return expense.requiresReceipt ? "缺少必传票据" : "未上传票据";
}

function receiptDisplayUrl(receipt: AdminTripExpense["receiptImages"][number]) {
  return receiptLocalUrls.value[receipt.id] ?? resolveStorageUrl(receipt.storageKey);
}

function downloadReceiptImage(receipt: AdminTripExpense["receiptImages"][number]) {
  return new Promise<void>((resolve) => {
    const url = resolveStorageUrl(receipt.storageKey);
    if (/^(file:|wxfile:|blob:|data:image)/.test(url)) {
      receiptLocalUrls.value = { ...receiptLocalUrls.value, [receipt.id]: url };
      resolve();
      return;
    }
    uni.downloadFile({
      url,
      success: (response) => {
        if (response.statusCode >= 200 && response.statusCode < 300 && response.tempFilePath) {
          receiptLocalUrls.value = { ...receiptLocalUrls.value, [receipt.id]: response.tempFilePath };
        }
        resolve();
      },
      fail: () => resolve(),
    });
  });
}

function cacheReceiptImages(items: AdminTripExpense[]) {
  const receipts = items.flatMap((expense) => expense.receiptImages);
  void Promise.all(receipts.map((receipt) => downloadReceiptImage(receipt)));
}

function previewExpenseReceipts(expense: AdminTripExpense, index: number) {
  const urls = expense.receiptImages.map((receipt) => receiptDisplayUrl(receipt));
  uni.previewImage({
    urls,
    current: urls[index],
  });
}

function todayInput() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function emptyManualBillingForm(date: string): ManualBillingForm {
  return {
    vehicleId: "",
    driverId: "",
    customerName: "",
    loadLocation: "",
    unloadLocation: "",
    actualFreight: "",
    settledAt: date,
    accountingNote: "",
    expenseMode: "details",
    expenses: [{ expenseTypeId: "", amount: "", occurredAt: date, note: "" }],
    totalExpense: "",
  };
}

function openTripActionMenu() {
  uni.showActionSheet({
    itemList: ["新增趟次", "补录账单"],
    success: (result) => {
      if (result.tapIndex === 0) {
        openCreatePanel();
        return;
      }
      if (result.tapIndex === 1) {
        openManualBillingPanel();
      }
    },
  });
}

function openCreatePanel() {
  editingTrip.value = null;
  createPanelOpen.value = true;
  selectedVehicleIndex.value = 0;
  selectedDriverIndex.value = 0;
  createForm.value = {
    customerName: "",
    loadLocation: "",
    loadAddress: "",
    loadLatitude: undefined,
    loadLongitude: undefined,
    loadPoiId: "",
    unloadLocation: "",
    unloadAddress: "",
    unloadLatitude: undefined,
    unloadLongitude: undefined,
    unloadPoiId: "",
    locationProvider: "",
    estimatedFreight: "",
    driverNote: "",
  };
  locationResults.value = { load: [], unload: [] };
  normalizeDriverIndex();
}

function openEditPanel(trip: AdminTrip) {
  editingTrip.value = trip;
  const vehicleIndex = vehicles.value.findIndex((vehicle) => vehicle.id === trip.vehicleId);
  selectedVehicleIndex.value = Math.max(0, vehicleIndex);
  const driverIndex = eligibleDrivers.value.findIndex((driver) => driver.id === trip.driverId);
  selectedDriverIndex.value = Math.max(0, driverIndex);
  createForm.value = {
    customerName: trip.customerName,
    loadLocation: trip.loadLocation,
    loadAddress: trip.loadAddress ?? "",
    loadLatitude: trip.loadLatitude ?? undefined,
    loadLongitude: trip.loadLongitude ?? undefined,
    loadPoiId: trip.loadPoiId ?? "",
    unloadLocation: trip.unloadLocation,
    unloadAddress: trip.unloadAddress ?? "",
    unloadLatitude: trip.unloadLatitude ?? undefined,
    unloadLongitude: trip.unloadLongitude ?? undefined,
    unloadPoiId: trip.unloadPoiId ?? "",
    locationProvider: trip.locationProvider ?? "",
    estimatedFreight: trip.estimatedFreight,
    driverNote: trip.driverNote,
  };
  locationResults.value = { load: [], unload: [] };
  normalizeDriverIndex();
  createPanelOpen.value = true;
}

function closeCreatePanel() {
  if (!creating.value) {
    createPanelOpen.value = false;
    editingTrip.value = null;
  }
}

function selectVehicle(event: { detail: { value: number } }) {
  selectedVehicleIndex.value = Number(event.detail.value);
  selectedDriverIndex.value = 0;
  normalizeDriverIndex();
}

function selectDriver(event: { detail: { value: number } }) {
  selectedDriverIndex.value = Number(event.detail.value);
}

function normalizeDriverIndex() {
  if (selectedDriverIndex.value >= eligibleDrivers.value.length) {
    selectedDriverIndex.value = 0;
  }
}

function openManualBillingPanel() {
  const date = todayInput();
  manualBillingVehicleIndex.value = 0;
  manualBillingDriverIndex.value = 0;
  manualBillingForm.value = emptyManualBillingForm(date);
  const vehicle = vehicles.value[manualBillingVehicleIndex.value];
  if (vehicle) {
    manualBillingForm.value.vehicleId = vehicle.id;
  }
  normalizeManualBillingDriverIndex();
  manualBillingPanelOpen.value = true;
}

function closeManualBillingPanel() {
  if (!manualBillingSubmitting.value) {
    manualBillingPanelOpen.value = false;
  }
}

function selectManualBillingVehicle(event: { detail: { value: number } }) {
  manualBillingVehicleIndex.value = Number(event.detail.value);
  manualBillingForm.value.vehicleId = manualBillingVehicle.value?.id ?? "";
  manualBillingDriverIndex.value = 0;
  normalizeManualBillingDriverIndex();
}

function selectManualBillingDriver(event: { detail: { value: number } }) {
  manualBillingDriverIndex.value = Number(event.detail.value);
  manualBillingForm.value.driverId = manualBillingEligibleDrivers.value[manualBillingDriverIndex.value]?.id ?? "";
}

function normalizeManualBillingDriverIndex() {
  if (manualBillingDriverIndex.value >= manualBillingEligibleDrivers.value.length) {
    manualBillingDriverIndex.value = 0;
  }
  manualBillingForm.value.driverId = manualBillingEligibleDrivers.value[manualBillingDriverIndex.value]?.id ?? "";
}

function setManualBillingSettledAt(event: { detail: { value: string } }) {
  manualBillingForm.value.settledAt = event.detail.value;
}

function setManualBillingMode(mode: ManualBillingForm["expenseMode"]) {
  manualBillingForm.value.expenseMode = mode;
}

function addManualBillingExpense() {
  manualBillingForm.value.expenses.push({ expenseTypeId: "", amount: "", occurredAt: todayInput(), note: "" });
}

function removeManualBillingExpense(index: number) {
  manualBillingForm.value.expenses.splice(index, 1);
}

function manualBillingExpenseTypeIndex(expenseTypeId: string) {
  return Math.max(0, expenseTypes.value.findIndex((type) => type.id === expenseTypeId));
}

function manualBillingExpenseTypeLabel(expenseTypeId: string) {
  return expenseTypes.value.find((type) => type.id === expenseTypeId)?.name ?? "费用类型";
}

function selectManualBillingExpenseType(index: number, event: { detail: { value: number } }) {
  const type = expenseTypes.value[Number(event.detail.value)];
  if (type && manualBillingForm.value.expenses[index]) {
    manualBillingForm.value.expenses[index].expenseTypeId = type.id;
  }
}

function setManualBillingExpenseDate(index: number, event: { detail: { value: string } }) {
  if (manualBillingForm.value.expenses[index]) {
    manualBillingForm.value.expenses[index].occurredAt = event.detail.value;
  }
}

function formatPreviewRate(rate: string | null) {
  if (rate === null) return "不可计算";
  const value = Number(rate);
  return Number.isFinite(value) ? `${(value * 100).toFixed(2)}%` : "不可计算";
}

async function submitManualBilling() {
  if (manualBillingSubmitting.value) return;

  const firstError = manualBillingErrors.value[0];
  if (firstError) {
    uni.showToast({ title: firstError, icon: "none" });
    return;
  }

  let payload: ReturnType<typeof buildManualBillingPayload>;
  try {
    payload = buildManualBillingPayload(manualBillingForm.value);
  } catch {
    uni.showToast({ title: "补录账单数据有误", icon: "none" });
    return;
  }

  manualBillingSubmitting.value = true;
  try {
    const trip = await createAdminManualCompletedTrip(payload);
    manualBillingPanelOpen.value = false;
    if (!statusFilter.value || statusFilter.value === trip.status) {
      trips.value = [trip, ...trips.value];
    }
    uni.showToast({ title: "已补录账单", icon: "success" });
  } catch (error) {
    uni.showToast({ title: getApiErrorMessage(error, "补录账单失败，请稍后重试"), icon: "none" });
  } finally {
    manualBillingSubmitting.value = false;
  }
}

function locationStatusText(type: "load" | "unload") {
  const latitude = type === "load" ? createForm.value.loadLatitude : createForm.value.unloadLatitude;
  const longitude = type === "load" ? createForm.value.loadLongitude : createForm.value.unloadLongitude;
  return latitude != null && longitude != null ? "已选择精准坐标" : "可手动填写或搜索选点";
}

function clearPreciseLocation(type: "load" | "unload") {
  if (type === "load") {
    createForm.value.loadAddress = "";
    createForm.value.loadLatitude = undefined;
    createForm.value.loadLongitude = undefined;
    createForm.value.loadPoiId = "";
    locationResults.value.load = [];
    return;
  }
  createForm.value.unloadAddress = "";
  createForm.value.unloadLatitude = undefined;
  createForm.value.unloadLongitude = undefined;
  createForm.value.unloadPoiId = "";
  locationResults.value.unload = [];
}

async function searchLocation(type: "load" | "unload") {
  const keyword = (type === "load" ? createForm.value.loadLocation : createForm.value.unloadLocation).trim();
  if (!keyword) {
    uni.showToast({ title: "请先输入地点关键词", icon: "none" });
    return;
  }
  try {
    const places = await searchMapPlaces(keyword);
    locationResults.value = { ...locationResults.value, [type]: places };
    if (places.length === 0) {
      uni.showToast({ title: "未找到地点，可继续手动填写", icon: "none" });
    }
  } catch (error) {
    uni.showToast({ title: getApiErrorMessage(error, "地图搜索失败"), icon: "none" });
  }
}

function selectLocation(type: "load" | "unload", place: MapPlace) {
  if (type === "load") {
    createForm.value.loadLocation = place.name;
    createForm.value.loadAddress = place.address;
    createForm.value.loadLatitude = place.latitude;
    createForm.value.loadLongitude = place.longitude;
    createForm.value.loadPoiId = place.id;
    locationResults.value.load = [];
  } else {
    createForm.value.unloadLocation = place.name;
    createForm.value.unloadAddress = place.address;
    createForm.value.unloadLatitude = place.latitude;
    createForm.value.unloadLongitude = place.longitude;
    createForm.value.unloadPoiId = place.id;
    locationResults.value.unload = [];
  }
  createForm.value.locationProvider = place.provider;
}

async function submitCreateTrip() {
  if (createDisabled.value || !selectedVehicle.value) return;
  const driver = eligibleDrivers.value[selectedDriverIndex.value];
  if (!driver) return;

  creating.value = true;
  try {
    const payload = {
      vehicleId: selectedVehicle.value.id,
      driverId: driver.id,
      customerName: createForm.value.customerName.trim(),
      loadLocation: createForm.value.loadLocation.trim(),
      loadAddress: createForm.value.loadAddress.trim() || undefined,
      loadLatitude: createForm.value.loadLatitude,
      loadLongitude: createForm.value.loadLongitude,
      loadPoiId: createForm.value.loadPoiId.trim() || undefined,
      unloadLocation: createForm.value.unloadLocation.trim(),
      unloadAddress: createForm.value.unloadAddress.trim() || undefined,
      unloadLatitude: createForm.value.unloadLatitude,
      unloadLongitude: createForm.value.unloadLongitude,
      unloadPoiId: createForm.value.unloadPoiId.trim() || undefined,
      locationProvider: createForm.value.locationProvider || undefined,
      estimatedFreight: createForm.value.estimatedFreight.trim() || undefined,
      driverNote: createForm.value.driverNote.trim() || undefined,
      accountingNote: editingTrip.value?.accountingNote || undefined,
    };
    const trip = editingTrip.value
      ? await updateAdminTrip(editingTrip.value.id, payload)
      : await createAdminTrip(payload);
    createPanelOpen.value = false;
    if (editingTrip.value) {
      replaceTrip(trip);
    } else if (!statusFilter.value || statusFilter.value === trip.status) {
      trips.value = [trip, ...trips.value];
    }
    editingTrip.value = null;
    uni.showToast({ title: "已保存", icon: "success" });
  } catch (error) {
    uni.showToast({ title: getApiErrorMessage(error, "保存失败，请确认司机已绑定车辆"), icon: "none" });
  } finally {
    creating.value = false;
  }
}

function availableActions(trip: AdminTrip) {
  if (["assigned", "returned"].includes(trip.status)) {
    return [{ key: "edit" as const, label: "编辑", icon: "edit", tone: "secondary" }];
  }
  if (trip.status === "submitted") {
    return [{ key: "review" as const, label: "开始审核", icon: "fact_check", tone: "primary" }];
  }
  if (trip.status === "under_review") {
    return [
      { key: "return" as const, label: "退回", icon: "keyboard_return", tone: "warning" },
      { key: "settle" as const, label: "结算", icon: "price_check", tone: "primary" },
    ];
  }
  return [];
}

function handleTripAction(trip: AdminTrip, action: TripActionKey) {
  if (action === "edit") {
    openEditPanel(trip);
    return;
  }
  if (action === "review") {
    void reviewTrip(trip);
    return;
  }
  if (action === "return") {
    confirmReturn(trip);
    return;
  }
  openSettlePanel(trip);
}

async function reviewTrip(trip: AdminTrip) {
  actingTripId.value = trip.id;
  try {
    replaceTrip(await startAdminTripReview(trip.id));
    uni.showToast({ title: "已进入审核", icon: "success" });
  } catch (error) {
    uni.showToast({ title: getApiErrorMessage(error), icon: "none" });
  } finally {
    actingTripId.value = "";
  }
}

function confirmReturn(trip: AdminTrip) {
  uni.showModal({
    title: "退回小票",
    editable: true,
    placeholderText: "请输入退回原因",
    confirmColor: "#d64f4f",
    success: (result) => {
      if (result.confirm) {
        const reason = (result.content || "").trim();
        if (!reason) {
          uni.showToast({ title: "请填写退回原因", icon: "none" });
          return;
        }
        void returnTrip(trip, reason);
      }
    },
  });
}

async function returnTrip(trip: AdminTrip, reason: string) {
  actingTripId.value = trip.id;
  try {
    replaceTrip(await returnAdminTrip(trip.id, reason));
    uni.showToast({ title: "已退回", icon: "success" });
  } catch (error) {
    uni.showToast({ title: getApiErrorMessage(error, "退回失败，请稍后重试"), icon: "none" });
  } finally {
    actingTripId.value = "";
  }
}

function openSettlePanel(trip: AdminTrip) {
  selectedTrip.value = trip;
  actualFreight.value = "";
  settlePanelOpen.value = true;
}

function closeSettlePanel() {
  if (!actingTripId.value) {
    settlePanelOpen.value = false;
  }
}

async function submitSettle() {
  if (settleDisabled.value || !selectedTrip.value) return;
  const trip = selectedTrip.value;
  actingTripId.value = trip.id;
  try {
    replaceTrip(await settleAdminTrip(trip.id, actualFreight.value.trim()));
    settlePanelOpen.value = false;
    uni.showToast({ title: "已结算", icon: "success" });
  } catch (error) {
    uni.showToast({ title: getApiErrorMessage(error, "结算失败，请稍后重试"), icon: "none" });
  } finally {
    actingTripId.value = "";
  }
}

function replaceTrip(updated: AdminTrip) {
  trips.value = trips.value.map((trip) => (trip.id === updated.id ? updated : trip));
  if (statusFilter.value && updated.status !== statusFilter.value) {
    trips.value = trips.value.filter((trip) => trip.id !== updated.id);
  }
}
</script>

<style scoped>
.admin-page { padding-bottom: 96px; }
.driver-topbar { align-items: center; gap: 10px; }
.driver-topbar > view:first-child { display: grid; flex: 1; min-width: 0; gap: 2px; }
.admin-subbrand { color: var(--driver-muted); font-size: 12px; }
.admin-content { display: grid; gap: 16px; }
.admin-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  overflow: hidden;
  padding: 18px;
  border-radius: 26px;
  background: linear-gradient(135deg, #0b2f5b, #1262b8);
  color: #ffffff;
  box-shadow: var(--driver-shadow);
}
.hero-label, .hero-copy { color: rgba(255, 255, 255, 0.75); font-size: 13px; }
.hero-title {
  display: block;
  margin: 6px 0;
  font-family: "Hanken Grotesk", Inter, sans-serif;
  font-size: 38px;
  font-weight: 800;
  line-height: 42px;
}
.hero-icon {
  display: grid;
  place-items: center;
  width: 72px;
  height: 72px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.16);
}
.hero-icon .material-symbols-outlined { font-size: 38px; }
.status-tabs {
  display: flex;
  flex-wrap: nowrap;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: none;
}
.status-tabs::-webkit-scrollbar {
  display: none;
}
.status-tabs button {
  flex: 0 0 auto;
  min-width: 58px;
  height: 34px;
  margin: 0;
  padding: 0 12px;
  border: 1px solid var(--driver-border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.86);
  color: var(--driver-muted);
  font-size: 13px;
  font-weight: 700;
}
.status-tabs button.active {
  border-color: transparent;
  background: var(--driver-primary);
  color: #ffffff;
}
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
.metric-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.metric-card {
  display: grid;
  gap: 6px;
  padding: 14px;
  border: 1px solid var(--driver-border);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.88);
}
.metric-card text:first-child,
.card-subtitle,
.card-footer,
.info-grid text:first-child {
  color: var(--driver-muted);
  font-size: 12px;
}
.metric-card text:last-child {
  color: var(--driver-primary);
  font-size: 26px;
  font-weight: 800;
}
.list-stack { display: grid; gap: 14px; }
.load-more-state {
  padding: 10px 0 4px;
  color: var(--driver-muted);
  font-size: 12px;
  text-align: center;
}
.empty-card {
  padding: 28px 16px;
  border: 1px dashed var(--driver-border);
  border-radius: 22px;
  color: var(--driver-muted);
  text-align: center;
}
.trip-card {
  display: grid;
  gap: 14px;
  padding: 16px;
}
.card-head, .card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.card-title {
  display: block;
  color: var(--driver-primary);
  font-size: 18px;
  font-weight: 800;
}
.status-pill {
  flex: 0 0 auto;
  padding: 5px 9px;
  border-radius: 999px;
  background: rgba(18, 98, 184, 0.1);
  color: var(--driver-primary-2);
  font-size: 12px;
  font-weight: 800;
}
.route-line {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  color: var(--driver-ink);
  font-size: 15px;
  font-weight: 700;
}
.route-line text { overflow-wrap: anywhere; }
.route-line .material-symbols-outlined { color: var(--driver-muted); font-size: 18px; }
.info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.info-grid view {
  display: grid;
  gap: 4px;
  padding: 10px;
  border-radius: 16px;
  background: #f4f7fc;
}
.info-grid text:last-child {
  color: var(--driver-primary);
  font-size: 14px;
  font-weight: 800;
  overflow-wrap: anywhere;
}
.action-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.action-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 40px;
  margin: 0;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 900;
}
.action-button.primary {
  background: var(--driver-primary);
  color: #ffffff;
}
.action-button.ghost {
  background: rgba(18, 98, 184, 0.08);
  color: var(--driver-primary);
}
.action-button.secondary {
  background: rgba(18, 98, 184, 0.1);
  color: var(--driver-primary);
}
.action-button.warning {
  background: rgba(214, 79, 79, 0.1);
  color: var(--driver-red);
}
.action-button .material-symbols-outlined { font-size: 18px; }
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
.detail-sheet {
  gap: 12px;
}
.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.sheet-head > view, label { display: grid; gap: 7px; }
.sheet-title { color: var(--driver-primary); font-size: 20px; font-weight: 900; }
.sheet-subtitle, label text { color: var(--driver-muted); font-size: 12px; }
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
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
.location-field {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 44px;
  gap: 8px;
}
.location-label,
.location-picker {
  position: relative;
}
.location-label.has-location-results {
  z-index: 20;
}
.location-field button {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 46px;
  margin: 0;
  border-radius: 16px;
  background: rgba(18, 98, 184, 0.1);
  color: var(--driver-primary);
}
.location-hint {
  color: var(--driver-muted);
  font-size: 11px;
}
.location-results {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  left: 0;
  z-index: 120;
  display: grid;
  gap: 6px;
  max-height: 220px;
  overflow-y: auto;
  padding: 6px;
  border: 1px solid rgba(209, 219, 234, 0.96);
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 16px 34px rgba(16, 39, 74, 0.18);
}
.location-results button {
  display: grid;
  gap: 3px;
  margin: 0;
  padding: 9px 10px;
  border: 0;
  border-radius: 12px;
  background: rgba(247, 250, 255, 0.95);
  text-align: left;
}
.location-results text:first-child {
  color: var(--driver-primary);
  font-size: 13px;
  font-weight: 900;
}
.location-results text:last-child {
  color: var(--driver-muted);
  font-size: 11px;
  line-height: 16px;
}
.manual-billing-sheet {
  gap: 14px;
}
.manual-mode-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding: 4px;
  border: 1px solid var(--driver-border);
  border-radius: 18px;
  background: #f7faff;
}
.manual-mode-tabs button {
  height: 38px;
  margin: 0;
  border-radius: 14px;
  background: transparent;
  color: var(--driver-muted);
  font-size: 13px;
  font-weight: 900;
}
.manual-mode-tabs button.active {
  background: var(--driver-primary);
  color: #ffffff;
}
.manual-expense-stack {
  display: grid;
  gap: 10px;
}
.manual-expense-row {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--driver-border);
  border-radius: 18px;
  background: #f7faff;
}
.manual-expense-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.manual-expense-head text {
  color: var(--driver-primary);
  font-size: 14px;
  font-weight: 900;
}
.manual-expense-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.compact-danger-button {
  height: 28px;
  margin: 0;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(214, 79, 79, 0.1);
  color: var(--driver-red);
  font-size: 12px;
  font-weight: 900;
  line-height: 28px;
}
.manual-add-expense {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 40px;
  margin: 0;
  border-radius: 999px;
  background: rgba(18, 98, 184, 0.1);
  color: var(--driver-primary);
  font-size: 13px;
  font-weight: 900;
}
.manual-add-expense .material-symbols-outlined {
  font-size: 18px;
}
.manual-preview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.manual-preview-grid view {
  display: grid;
  gap: 4px;
  padding: 12px;
  border-radius: 16px;
  background: #f4f7fc;
}
.manual-preview-grid text:first-child {
  color: var(--driver-muted);
  font-size: 12px;
}
.manual-preview-grid text:last-child {
  color: var(--driver-primary);
  font-size: 16px;
  font-weight: 900;
  overflow-wrap: anywhere;
}
.expense-card {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--driver-border);
  border-radius: 18px;
  background: #f7faff;
}
.detail-sheet {
  width: calc(100vw - 20px);
  max-height: 86vh;
  padding-left: 14px;
  padding-right: 14px;
}
.expense-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}
.expense-head view {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 3px;
}
.expense-head view text:first-child {
  color: var(--driver-primary);
  font-size: 15px;
  font-weight: 900;
}
.expense-head view text:last-child,
.expense-note {
  color: var(--driver-muted);
  font-size: 12px;
  line-height: 18px;
}
.expense-head > text {
  color: var(--driver-primary);
  font-size: 15px;
  font-weight: 900;
  white-space: nowrap;
}
.receipt-chip {
  display: inline-flex;
  justify-self: start;
  align-items: center;
  gap: 4px;
  padding: 5px 9px;
  border-radius: 999px;
  background: rgba(20, 133, 94, 0.1);
  color: var(--driver-green);
  font-size: 12px;
  font-weight: 800;
}
.receipt-chip.missing {
  background: rgba(214, 79, 79, 0.1);
  color: var(--driver-red);
}
.receipt-chip .material-symbols-outlined {
  font-size: 15px;
}
.receipt-preview-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}
.receipt-preview {
  position: relative;
  width: 76px;
  height: 76px;
  overflow: hidden;
  border: 1px solid rgba(209, 219, 234, 0.9);
  border-radius: 16px;
  background: #f4f8ff;
  box-shadow: 0 8px 18px rgba(16, 39, 74, 0.1);
}
.receipt-preview-image {
  display: block;
  width: 76px;
  height: 76px;
  background: #eef4ff;
}
.receipt-preview text {
  position: absolute;
  right: 4px;
  bottom: 4px;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(11, 47, 91, 0.72);
  color: #ffffff;
  font-size: 10px;
  font-weight: 800;
  line-height: 14px;
}
.empty-card.compact {
  padding: 18px 10px;
  font-size: 12px;
}
@media (max-width: 360px) {
  .status-tabs { gap: 4px; }
  .status-tabs button { font-size: 10px; }
  .action-row, .form-grid, .manual-expense-grid { grid-template-columns: 1fr; }
}
</style>
