/**
 * AI 服务识别账单时需要的车辆上下文。
 */
export type VehicleContext = {
  id: string;
  plateNumber: string;
  status: string;
};

/**
 * AI 服务识别账单时需要的司机上下文。
 *
 * `boundVehicleIds` 用于在司机重名时优先匹配已绑定到候选车辆的司机。
 */
export type DriverContext = {
  id: string;
  name: string;
  phone?: string;
  status: string;
  boundVehicleIds?: string[];
};

/**
 * AI 服务识别费用时需要的费用类型上下文。
 */
export type ExpenseTypeContext = {
  id: string;
  name: string;
  enabled: boolean;
};

/**
 * 单个团队的账单识别上下文。
 *
 * 这个上下文由主业务后端提供，AI 服务只读使用。
 */
export type TeamBillingContext = {
  vehicles: VehicleContext[];
  drivers: DriverContext[];
  expenseTypes: ExpenseTypeContext[];
};
