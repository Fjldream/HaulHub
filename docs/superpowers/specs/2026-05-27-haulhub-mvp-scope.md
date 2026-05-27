# HaulHub MVP 落地范围规格

## 目标

第一版先跑通运输账单闭环：会计创建趟次，司机记录费用和票据，司机提交账单，会计审核、退回或完成结算，系统按趟次、车辆、司机和时间统计利润。

第一版不追求完整运输 ERP，只做“小型运输公司能每天使用”的账单系统。

## 产品形态

- 会计后台：桌面 Web。
- 司机端：uni-app，第一版优先微信小程序，同时保留 H5 和 App 编译路径。
- 管理入口：同一系统按角色进入不同界面。

## 第一版角色

### 司机

司机只能访问分配给自己的趟次，记录费用、上传票据、提交账单、查看自己的趟次状态和个人信息。

司机端绝不展示预计运费、实际运费、利润、利润率、经营报表和其他司机数据。

### 会计

会计拥有第一版后台全部权限：车辆、司机、费用类别、趟次、账单审核、结算、利润统计。

第一版不拆分管理员、调度、出纳等更多角色，但数据模型为未来角色扩展保留空间。

## MVP 页面清单

### 司机端

- 登录
- 我的趟次
- 趟次详情
- 新增/编辑费用
- 票据预览
- 提交账单确认
- 个人中心

### 会计后台

- 登录
- 工作台
- 趟次管理
- 创建/编辑趟次
- 趟次账单详情/审核
- 车辆管理
- 车辆详情
- 司机管理
- 司机详情
- 费用类别配置
- 利润统计
- 系统设置

### 第一版暂缓

- 客户档案深度管理
- 多后台角色权限
- Excel 导出和打印模板
- 司机工资计算
- 维修保养管理
- 应收应付
- 消息推送中心
- 单条费用独立审核流

## 趟次状态机

```text
待出车 -> 进行中 -> 已提交 -> 审核中 -> 已完成
                         |
                         -> 已退回 -> 已提交
```

内部状态码：

- `assigned`：待出车
- `in_progress`：进行中
- `submitted`：已提交
- `under_review`：审核中
- `completed`：已完成
- `returned`：已退回

状态规则：

- 待出车：会计已创建并分配趟次，司机尚未开始。
- 进行中：司机已开始出车，可新增、编辑、删除费用。
- 已提交：司机已提交账单；会计开始审核前，司机仍可修改费用并重新提交。
- 审核中：会计已开始审核，司机不能再修改费用。
- 已退回：会计退回账单，司机可修改后重新提交。
- 已完成：会计确认实际运费并完成结算，账单归档。

## 核心数据对象

### User

- `id`
- `name`
- `phone`
- `passwordHash`
- `role`: `driver` 或 `accountant`
- `status`: `active` 或 `disabled`
- `isFirstLogin`
- `createdAt`
- `updatedAt`

### Vehicle

- `id`
- `plateNumber`
- `status`: `available`、`maintenance`、`disabled`
- `vehicleType`
- `note`
- `createdAt`
- `updatedAt`

### DriverVehicleBinding

- `id`
- `vehicleId`
- `driverId`
- `createdAt`

### ExpenseType

- `id`
- `name`
- `requiresReceipt`
- `enabled`
- `sortOrder`
- `createdAt`
- `updatedAt`

### Trip

- `id`
- `tripNo`
- `vehicleId`
- `driverId`
- `customerName`
- `loadLocation`
- `unloadLocation`
- `estimatedFreight`
- `actualFreight`
- `status`
- `driverNote`
- `accountingNote`
- `returnReason`
- `createdBy`
- `startedAt`
- `submittedAt`
- `reviewStartedAt`
- `completedAt`
- `createdAt`
- `updatedAt`

### Expense

- `id`
- `tripId`
- `expenseTypeId`
- `expenseTypeNameSnapshot`
- `amount`
- `occurredAt`
- `note`
- `createdBy`
- `createdAt`
- `updatedAt`

### ReceiptImage

- `id`
- `expenseId`
- `storageKey`
- `mimeType`
- `sizeBytes`
- `createdAt`

### SettlementSnapshot

- `id`
- `tripId`
- `actualFreight`
- `expenseTotal`
- `profit`
- `profitRate`
- `settledBy`
- `settledAt`

### AuditLog

- `id`
- `actorId`
- `targetType`
- `targetId`
- `action`
- `before`
- `after`
- `createdAt`

## 财务规则

金额存储必须使用 decimal，不使用浮点数。

```text
费用合计 = 所有费用金额之和
利润 = 实际运费 - 费用合计
利润率 = 利润 / 实际运费
```

实际运费为空或 0 时，利润率显示为不可计算。

已完成账单默认不允许直接修改。后续如开放修订，必须生成修订记录和审计日志。

## 权限规则

司机可以：

- 查看自己的趟次
- 开始自己的趟次
- 在允许状态下新增、编辑、删除费用
- 上传和查看自己的费用票据
- 提交或重新提交账单
- 修改自己的密码

司机不可以：

- 查看运费、利润、利润率或经营报表
- 查看其他司机的趟次
- 管理车辆、司机、费用类别
- 审核或完成账单

会计可以：

- 管理车辆、司机、费用类别
- 创建和编辑趟次
- 审核趟次账单
- 审核期间编辑费用记录
- 退回账单
- 确认实际运费
- 完成结算
- 查看利润统计

## API 边界

第一版 API 按资源划分：

- `/auth`：登录、退出、当前用户、修改密码
- `/driver/trips`：司机端趟次列表、详情、开始、提交
- `/driver/expenses`：司机端费用新增、编辑、删除、票据上传
- `/admin/trips`：后台趟次管理、审核、退回、结算
- `/admin/vehicles`：车辆管理
- `/admin/drivers`：司机管理
- `/admin/expense-types`：费用类别配置
- `/admin/reports`：利润统计
- `/files`：带鉴权的票据访问

司机端 API 不能返回隐私字段，即使前端不展示也不应返回。

## 技术建议

- 后台前端：Next.js App Router + TypeScript + Tailwind CSS。
- 司机端：uni-app + Vue 3 + TypeScript，优先微信小程序，兼容 H5/App。
- 后端：第一版使用独立 Node.js API 服务，避免后台 Web 和小程序 API 绑定过深。
- 数据库：SQLite，适合第一版本地部署和小团队使用；数据访问层保留未来迁移 PostgreSQL 的空间。
- ORM：Prisma + SQLite。
- 文件存储：本地开发和单机部署先使用本地目录，生产可迁移到 S3/OSS/COS 兼容对象存储。
- 鉴权：HTTP-only session cookie 或 JWT cookie。第一版优先 session cookie。

## 验收标准

- 司机能从登录到提交账单完整跑通。
- 会计能从创建趟次到完成结算完整跑通。
- 会计能按时间、车辆、司机查看基础利润统计。
- 司机端不会出现运费、利润、利润率和报表字段。
- 必传票据缺失时无法提交账单，并给出明确提示。
- 关键审核、退回、删除、改金额、结算操作写入审计日志。
