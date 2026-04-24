export interface HcmBalanceResponse {
  success: boolean;
  balance: number;
}

export interface HcmBatchItem {
  employeeId: number;
  locationId: number;
  leaveTypeId: number;
  balance: number;
}

export interface HcmBatchResponse {
  success: boolean;
  balances: HcmBatchItem[];
}
