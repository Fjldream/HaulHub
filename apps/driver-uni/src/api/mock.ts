export const currentDriver = {
  name: "司机老李",
  phone: "13900000001",
  vehicle: "沪A·12345",
};

export const trips = [
  {
    id: "trip-1",
    plateNumber: "沪A·12345",
    customerName: "恒通物流",
    loadLocation: "上海嘉定",
    unloadLocation: "杭州萧山",
    status: "进行中",
    plannedAt: "今日 09:20",
    driverNote: "到仓库后联系王经理。",
    expenseTotal: "¥620.00",
    missingItems: ["过路费票据"],
  },
  {
    id: "trip-2",
    plateNumber: "沪A·12345",
    customerName: "华东建材",
    loadLocation: "上海宝山",
    unloadLocation: "无锡惠山",
    status: "已提交",
    plannedAt: "昨日 08:30",
    driverNote: "等待会计审核。",
    expenseTotal: "¥410.00",
    missingItems: [],
  },
];

export const expenses = [
  {
    id: "expense-1",
    type: "油费",
    amount: "¥300.00",
    occurredAt: "11:08",
    note: "高速服务区加油",
    receipt: "已上传",
  },
  {
    id: "expense-2",
    type: "过路费",
    amount: "¥220.00",
    occurredAt: "12:34",
    note: "沪杭高速",
    receipt: "缺少票据",
  },
  {
    id: "expense-3",
    type: "停车费",
    amount: "¥100.00",
    occurredAt: "14:20",
    note: "卸货等待",
    receipt: "非必传",
  },
];

export const expenseTypes = ["油费", "过路费", "停车费", "维修费", "餐费", "其他"];
