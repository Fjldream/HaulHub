export type VehicleContext = {
  id: string;
  plateNumber: string;
  status: string;
};

export type DriverContext = {
  id: string;
  name: string;
  phone?: string;
  status: string;
  boundVehicleIds?: string[];
};

export type ExpenseTypeContext = {
  id: string;
  name: string;
  enabled: boolean;
};

export type TeamBillingContext = {
  vehicles: VehicleContext[];
  drivers: DriverContext[];
  expenseTypes: ExpenseTypeContext[];
};
