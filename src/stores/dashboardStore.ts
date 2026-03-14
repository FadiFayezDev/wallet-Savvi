import { create } from 'zustand';

import { reportService } from '@/src/services/reportService';
import { transactionService } from '@/src/services/transactionService';
import { settingsService } from '@/src/services/settingsService';
import { dailySummaryService } from '@/src/services/dailySummaryService';
import { nowIso } from '@/src/utils/date';
import type { DashboardSummary, DayComparisonPoint, SavingsComparison, Transaction } from '@/src/types/domain';

interface DashboardState {
  summary: DashboardSummary | null;
  dayComparison: DayComparisonPoint[];
  savingsComparison: SavingsComparison | null;
  recentTransactions: Transaction[];
  isLoading: boolean;
  error: string | null;
  refresh: (filters?: {
    search?: string;
    kind?: 'income' | 'expense' | 'bill_payment' | 'work_expense';
  }) => Promise<void>;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  summary: null,
  dayComparison: [],
  savingsComparison: null,
  recentTransactions: [],
  isLoading: false,
  error: null,

  refresh: async (filters) => {
    set({ isLoading: true, error: null });
    try {
      const today = nowIso();

      const [rawSummary, dayComparison, savingsComparison, recentTransactions, balance, dailyStatus] =
        await Promise.all([
          reportService.getDashboardSummary(),      // Omit<DashboardSummary, 'balance'>
          reportService.getFourteenDayComparison(), // DayComparisonPoint[]
          reportService.getSavingsComparison(),     // SavingsComparison
          transactionService.listTransactions({
            search: filters?.search,
            kind: filters?.kind as any,
            limit: 20,
          }),
          settingsService.getBalance(),
          dailySummaryService.getDailySummary(today),
        ]);

      // ✅ الـ types كلها صح من المصدر — بس نضيف balance و نـ override بـ dailyStatus لو موجود
      const summary: DashboardSummary = {
        ...rawSummary,
        balance,
        todaySpent:     dailyStatus?.total_spent          ?? rawSummary.todaySpent,
        isOverLimit:    Boolean(dailyStatus?.is_over_limit ?? rawSummary.isOverLimit),
        remainingLimit: dailyStatus?.remaining_from_limit ?? rawSummary.remainingLimit,
      };

      set({
        summary,
        dayComparison,
        savingsComparison,
        recentTransactions,
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load dashboard',
      });
    }
  },
})); 