export const trips = [
  {
    id: "trip-1",
    tripNo: "HH202605270001",
    plateNumber: "沪A·12345",
    driver: "司机老李",
    customer: "恒通物流",
    route: "上海嘉定 -> 杭州萧山",
    status: "审核中",
    createdAt: "2026-05-27 09:20",
    submittedAt: "2026-05-27 15:42",
    actualFreight: "¥1,800.00",
    expenseTotal: "¥620.00",
    profit: "¥1,180.00",
  },
  {
    id: "trip-2",
    tripNo: "HH202605270002",
    plateNumber: "苏B·67890",
    driver: "司机小王",
    customer: "江南仓储",
    route: "苏州昆山 -> 宁波北仑",
    status: "已提交",
    createdAt: "2026-05-27 10:05",
    submittedAt: "2026-05-27 16:10",
    actualFreight: "未确认",
    expenseTotal: "¥840.50",
    profit: "待确认",
  },
  {
    id: "trip-3",
    tripNo: "HH202605260008",
    plateNumber: "沪A·12345",
    driver: "司机老李",
    customer: "华东建材",
    route: "上海宝山 -> 无锡惠山",
    status: "已完成",
    createdAt: "2026-05-26 08:30",
    submittedAt: "2026-05-26 13:18",
    actualFreight: "¥1,350.00",
    expenseTotal: "¥410.00",
    profit: "¥940.00",
  },
];

export const expenses = [
  {
    id: "expense-1",
    type: "油费",
    amount: "¥300.00",
    occurredAt: "2026-05-27 11:08",
    note: "高速服务区加油",
    receipt: "已上传",
  },
  {
    id: "expense-2",
    type: "过路费",
    amount: "¥220.00",
    occurredAt: "2026-05-27 12:34",
    note: "沪杭高速",
    receipt: "已上传",
  },
  {
    id: "expense-3",
    type: "停车费",
    amount: "¥100.00",
    occurredAt: "2026-05-27 14:20",
    note: "卸货等待",
    receipt: "非必传",
  },
];

export const vehicles = [
  { plateNumber: "沪A·12345", status: "可用", type: "9.6米厢式货车", drivers: "司机老李" },
  { plateNumber: "苏B·67890", status: "可用", type: "13米半挂", drivers: "司机小王" },
  { plateNumber: "浙C·24680", status: "维修中", type: "冷链车", drivers: "未绑定" },
];

export const drivers = [
  { name: "司机老李", phone: "13900000001", status: "在职", vehicles: "沪A·12345" },
  { name: "司机小王", phone: "13900000002", status: "在职", vehicles: "苏B·67890" },
  { name: "司机赵师傅", phone: "13900000003", status: "停用", vehicles: "未绑定" },
];

export const expenseTypes = [
  { name: "油费", requiresReceipt: "必传", enabled: "启用", sortOrder: 1 },
  { name: "过路费", requiresReceipt: "必传", enabled: "启用", sortOrder: 2 },
  { name: "停车费", requiresReceipt: "非必传", enabled: "启用", sortOrder: 3 },
  { name: "维修费", requiresReceipt: "必传", enabled: "启用", sortOrder: 4 },
];
