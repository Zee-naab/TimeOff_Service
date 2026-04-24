export interface BalanceSummary {
  employee_id: number;
  employee_name?: string;
  location_id: number;
  location_name?: string;
  leave_type_id: number;
  leave_type_name?: string;
  balance: number;
  last_synced_at: Date | null;
}
