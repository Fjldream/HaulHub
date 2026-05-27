<template>
  <view class="page">
    <view class="card">
      <view class="head">
        <view>
          <text class="plate">{{ trip.plateNumber }}</text>
          <text class="customer">{{ trip.customerName }}</text>
        </view>
        <StatusBadge :status="trip.status" />
      </view>
      <view class="route">
        <text>{{ trip.loadLocation }}</text>
        <text class="arrow">-></text>
        <text>{{ trip.unloadLocation }}</text>
      </view>
      <view class="note">{{ trip.driverNote }}</view>
    </view>

    <view class="section-head">
      <text>费用记录</text>
      <button @tap="addExpense">新增费用</button>
    </view>
    <view class="expense-list">
      <view v-for="expense in expenses" :key="expense.id" class="expense-card">
        <view>
          <text class="expense-type">{{ expense.type }}</text>
          <text class="expense-note">{{ expense.note }}</text>
        </view>
        <view class="expense-right">
          <text class="amount">{{ expense.amount }}</text>
          <text :class="expense.receipt === '缺少票据' ? 'missing' : 'receipt'">
            {{ expense.receipt }}
          </text>
        </view>
      </view>
    </view>

    <view class="bottom-bar">
      <view>
        <text class="total-label">费用合计</text>
        <text class="total">{{ trip.expenseTotal }}</text>
      </view>
      <button class="primary" @tap="submitTrip">提交账单</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import StatusBadge from "@/components/StatusBadge.vue";
import { expenses, trips } from "@/api/mock";

const trip = trips[0];

function addExpense() {
  uni.navigateTo({ url: "/pages/expenses/form" });
}

function submitTrip() {
  uni.navigateTo({ url: "/pages/submit/index" });
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 16px 16px 96px;
}

.card,
.expense-card {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #ffffff;
}

.card {
  display: grid;
  gap: 14px;
  padding: 16px;
}

.head,
.route,
.expense-card,
.bottom-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.plate {
  display: block;
  font-size: 20px;
  font-weight: 800;
}

.customer,
.route {
  color: #43474e;
  font-size: 14px;
}

.route {
  justify-content: flex-start;
}

.arrow,
.note,
.expense-note,
.total-label {
  color: #74777f;
  font-size: 13px;
}

.note {
  padding: 10px;
  border-radius: 4px;
  background: #f0f3ff;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 20px 0 10px;
  font-weight: 700;
}

.section-head button {
  height: 36px;
  border-radius: 4px;
  background: #f6ad55;
  color: #001b3c;
  font-size: 14px;
  font-weight: 700;
}

.expense-list {
  display: grid;
  gap: 10px;
}

.expense-card {
  padding: 14px;
}

.expense-type,
.amount,
.total {
  display: block;
  font-weight: 800;
}

.expense-right {
  text-align: right;
}

.receipt {
  color: #2f855a;
  font-size: 12px;
}

.missing {
  color: #ba1a1a;
  font-size: 12px;
}

.bottom-bar {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  padding: 12px 16px 24px;
  border-top: 1px solid #e2e8f0;
  background: #ffffff;
}

.primary {
  min-width: 132px;
  height: 48px;
  border-radius: 4px;
  background: #1a365d;
  color: #ffffff;
  font-weight: 800;
}
</style>
