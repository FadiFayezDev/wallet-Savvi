import type { CategoryType, TransactionKind, BillStatus } from "@/src/types/domain";

export interface CreateTransactionInput {
  kind: TransactionKind;
  amount: number;
  categoryId?: number | null;
  accountId?: number | null;
  note?: string | null;
  occurredAt: string;
}

export interface UpdateTransactionInput {
  id: number;
  amount?: number;
  categoryId?: number | null;
  accountId?: number | null;
  note?: string | null;
  occurredAt?: string;
}

export interface CreateCategory {
  nameAr: string;
  nameEn: string;
  type: CategoryType;
  icon?: string | null;
  color?: string | null;
}

export interface CreateGoalInput {
  name: string;
  targetAmount: number;
  savedAmount?: number;              // ضيف ده
  monthlyContribution?: number | null; // ضيف ده
  icon?: string | null;                // ضيف ده
  deadline?: string | null;
  note?: string | null;
}

export interface UpdateGoalInput {
  id: number;
  name?: string;
  targetAmount?: number;
  monthlyContribution?: number | null;
  icon?: string | null;
  deadline?: string | null;
  note?: string | null;
  status?: 'active' | 'completed' | 'cancelled';
}

export interface TransferToGoalInput {
  goalId: number;
  amount: number;
  occurredAt: string;
  note?: string | null;
}

// --- New DTOs for Added Tables ---

export interface InsertRecurringBillDto {
  name: string;
  amount: number;
  categoryId?: number | null;
  dueDay: number;
  isActive?: boolean;
}

export interface UpdateRecurringBillDto {
  id: number;
  name?: string;
  amount?: number;
  categoryId?: number | null;
  dueDay?: number;
  isActive?: boolean;
}

export interface InsertWorkExpenseDto {
  name: string;
  defaultAmount: number;
  isActive?: boolean;
}

export interface InsertWorkDayLogDto {
  workDate: string;
  shiftStart?: string | null;
  shiftEnd?: string | null;
  totalWorkExpenses?: number;
  note?: string | null;
}

// --- Backup & Metadata ---

export interface BackupPayloadV1 {
  meta: {
    version: 1;
    exportedAt: string;
    appVersion: string;
    currency: string;
  };
  data: {
    categories: Record<string, unknown>[];
    transactions: Record<string, unknown>[];
    goals: Record<string, unknown>[];
    goal_transactions: Record<string, unknown>[];
    monthly_reports: Record<string, unknown>[];
    settings: Record<string, unknown>[];
    accounts?: Record<string, unknown>[];
    report_category_breakdown?: Record<string, unknown>[];
    recurring_bills?: Record<string, unknown>[];
    bill_instances?: Record<string, unknown>[];
    work_schedule?: Record<string, unknown>[];
    daily_work_expenses?: Record<string, unknown>[];
    work_days_log?: Record<string, unknown>[];
    daily_spending_summary?: Record<string, unknown>[];
    custom_themes?: Record<string, unknown>[];
    palette_themes?: Record<string, unknown>[];
  };
}
