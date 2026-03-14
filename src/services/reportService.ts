import { getAll, getFirst, runInTransaction, runQuery } from '@/src/db/client';
import { monthEndIso, monthStartIso, nowIso } from '@/src/utils/date';
import type { DashboardSummary, DayComparisonPoint, MonthlyReport, SavingsComparison } from '@/src/types/domain';

export const reportService = {

  async generateMonthlyReport(monthKey: string) {
    return await runInTransaction(async (db) => {
      const stats = await getFirst<{ income: number; expense: number; goals: number }>(
        `SELECT 
          SUM(CASE WHEN kind = 'income' THEN amount_abs ELSE 0 END) as income,
          SUM(CASE WHEN kind IN ('expense', 'bill_payment', 'work_expense') THEN amount_abs ELSE 0 END) as expense,
          SUM(CASE WHEN kind = 'goal_transfer' THEN amount_abs ELSE 0 END) as goals
         FROM transactions 
         WHERE strftime('%Y-%m', occurred_at) = ? AND is_deleted = 0`,
        [monthKey], db
      );

      const topExpense = await getFirst<{ category_id: number }>(
        `SELECT category_id FROM transactions 
         WHERE strftime('%Y-%m', occurred_at) = ? AND kind IN ('expense', 'bill_payment', 'work_expense') AND is_deleted = 0
         GROUP BY category_id ORDER BY SUM(amount_abs) DESC LIMIT 1`,
        [monthKey], db
      );

      const topIncome = await getFirst<{ category_id: number }>(
        `SELECT category_id FROM transactions 
         WHERE strftime('%Y-%m', occurred_at) = ? AND kind = 'income' AND is_deleted = 0
         GROUP BY category_id ORDER BY SUM(amount_abs) DESC LIMIT 1`,
        [monthKey], db
      );

      const highestSpendDay = await getFirst<{ day_key: string }>(
        `SELECT date(occurred_at) as day_key
         FROM transactions
         WHERE strftime('%Y-%m', occurred_at) = ? AND kind IN ('expense', 'bill_payment', 'work_expense') AND is_deleted = 0
         GROUP BY date(occurred_at)
         ORDER BY SUM(amount_abs) DESC LIMIT 1`,
        [monthKey], db
      );

      const workDays = await getFirst<{ count: number }>(
        `SELECT COUNT(*) as count FROM work_days_log WHERE strftime('%Y-%m', work_date) = ?`,
        [monthKey], db
      );

      const limitBreaches = await getFirst<{ count: number }>(
        `SELECT COUNT(*) as count FROM daily_spending_summary 
         WHERE strftime('%Y-%m', summary_date) = ? AND is_over_limit = 1`,
        [monthKey], db
      );

      const openingRow = await getFirst<{ balance_after: number }>(
        `SELECT balance_after FROM transactions 
         WHERE strftime('%Y-%m', occurred_at) = ? AND is_deleted = 0 
         ORDER BY occurred_at ASC, id ASC LIMIT 1`,
        [monthKey], db
      );

      const closingRow = await getFirst<{ balance_after: number }>(
        `SELECT balance_after FROM transactions 
         WHERE strftime('%Y-%m', occurred_at) = ? AND is_deleted = 0 
         ORDER BY occurred_at DESC, id DESC LIMIT 1`,
        [monthKey], db
      );

      const reportResult = await runQuery(
        `INSERT OR REPLACE INTO monthly_reports (
          month_key, total_income, total_expense, net_result, 
          top_expense_category_id, top_income_category_id, highest_spend_day, total_goal_saving, 
          opening_balance, closing_balance, work_days_count, 
          days_over_daily_limit, generated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          monthKey,
          stats?.income || 0,
          stats?.expense || 0,
          (stats?.income || 0) - (stats?.expense || 0),
          topExpense?.category_id || null,
          topIncome?.category_id || null,
          highestSpendDay?.day_key || null,
          stats?.goals || 0,
          openingRow?.balance_after || 0,
          closingRow?.balance_after || 0,
          workDays?.count || 0,
          limitBreaches?.count || 0,
          nowIso(),
        ],
        db
      );

      const reportId = (reportResult as any).lastInsertRowId;

      await runQuery(`DELETE FROM report_category_breakdown WHERE report_id = ?`, [reportId], db);

      const totalExp = stats?.expense || 1;
      await runQuery(
        `INSERT INTO report_category_breakdown (report_id, category_id, total_amount, percentage)
         SELECT ?, category_id, SUM(amount_abs), (SUM(amount_abs) * 100.0 / ?)
         FROM transactions 
         WHERE strftime('%Y-%m', occurred_at) = ? 
         AND kind IN ('expense', 'bill_payment', 'work_expense') 
         AND is_deleted = 0
         GROUP BY category_id`,
        [reportId, totalExp, monthKey], db
      );

      return { reportId, monthKey };
    });
  },

  async getReport(monthKey: string) {
    const report = await getFirst<any>(`SELECT * FROM monthly_reports WHERE month_key = ?`, [monthKey]);
    if (!report) return null;

    const breakdown = await getAll<any>(
      `SELECT b.*, c.name_ar, c.name_en, c.icon, c.color 
       FROM report_category_breakdown b
       JOIN categories c ON b.category_id = c.id
       WHERE b.report_id = ?`,
      [report.id]
    );

    return { ...report, breakdown };
  },

  async getCurrentMonthReportLive(monthKey?: string) {
    const key = monthKey ?? new Date().toISOString().substring(0, 7);
    const monthStart = monthStartIso(key);
    const monthEnd = monthEndIso(key);

    const stats = await getFirst<{ income: number; expense: number; goals: number }>(
      `SELECT 
        SUM(CASE WHEN kind = 'income' THEN amount_abs ELSE 0 END) as income,
        SUM(CASE WHEN kind IN ('expense', 'bill_payment', 'work_expense') THEN amount_abs ELSE 0 END) as expense,
        SUM(CASE WHEN kind = 'goal_transfer' THEN amount_abs ELSE 0 END) as goals
       FROM transactions 
       WHERE date(occurred_at) BETWEEN date(?) AND date(?) AND is_deleted = 0`,
      [monthStart, monthEnd]
    );

    const topExpense = await getFirst<{ category_id: number }>(
      `SELECT category_id FROM transactions 
       WHERE date(occurred_at) BETWEEN date(?) AND date(?) 
       AND kind IN ('expense', 'bill_payment', 'work_expense') AND is_deleted = 0
       GROUP BY category_id ORDER BY SUM(amount_abs) DESC LIMIT 1`,
      [monthStart, monthEnd]
    );

    const topIncome = await getFirst<{ category_id: number }>(
      `SELECT category_id FROM transactions 
       WHERE date(occurred_at) BETWEEN date(?) AND date(?) 
       AND kind = 'income' AND is_deleted = 0
       GROUP BY category_id ORDER BY SUM(amount_abs) DESC LIMIT 1`,
      [monthStart, monthEnd]
    );

    const highestSpendDay = await getFirst<{ day_key: string }>(
      `SELECT date(occurred_at) as day_key
       FROM transactions
       WHERE date(occurred_at) BETWEEN date(?) AND date(?) 
       AND kind IN ('expense', 'bill_payment', 'work_expense') AND is_deleted = 0
       GROUP BY date(occurred_at)
       ORDER BY SUM(amount_abs) DESC LIMIT 1`,
      [monthStart, monthEnd]
    );

    const workDays = await getFirst<{ count: number }>(
      `SELECT COUNT(*) as count FROM work_days_log 
       WHERE date(work_date) BETWEEN date(?) AND date(?)`,
      [monthStart, monthEnd]
    );

    const limitBreaches = await getFirst<{ count: number }>(
      `SELECT COUNT(*) as count FROM daily_spending_summary 
       WHERE date(summary_date) BETWEEN date(?) AND date(?) AND is_over_limit = 1`,
      [monthStart, monthEnd]
    );

    const openingRow = await getFirst<{ balance_after: number }>(
      `SELECT balance_after FROM transactions 
       WHERE date(occurred_at) BETWEEN date(?) AND date(?) AND is_deleted = 0 
       ORDER BY occurred_at ASC, id ASC LIMIT 1`,
      [monthStart, monthEnd]
    );

    const closingRow = await getFirst<{ balance_after: number }>(
      `SELECT balance_after FROM transactions 
       WHERE date(occurred_at) BETWEEN date(?) AND date(?) AND is_deleted = 0 
       ORDER BY occurred_at DESC, id DESC LIMIT 1`,
      [monthStart, monthEnd]
    );

    const income = stats?.income || 0;
    const expense = stats?.expense || 0;

    return {
      monthKey: key,
      totalIncome: income,
      totalExpense: expense,
      netResult: income - expense,
      topExpenseCategoryId: topExpense?.category_id ?? null,
      topIncomeCategoryId: topIncome?.category_id ?? null,
      highestSpendDay: highestSpendDay?.day_key ?? null,
      totalGoalSaving: stats?.goals || 0,
      openingBalance: openingRow?.balance_after ?? 0,
      closingBalance: closingRow?.balance_after ?? 0,
      workDaysCount: workDays?.count || 0,
      daysOverDailyLimit: limitBreaches?.count || 0,
    };
  },

  // ✅ أرشفة الشهور السابقة التي لا تمتلك تقارير
  async archiveClosedMonths(): Promise<number> {
    const currentMonth = new Date().toISOString().substring(0, 7);
    const monthsToArchive = await getAll<{ month: string }>(
      `SELECT DISTINCT strftime('%Y-%m', occurred_at) as month 
       FROM transactions 
       WHERE strftime('%Y-%m', occurred_at) < ? 
       AND strftime('%Y-%m', occurred_at) NOT IN (SELECT month_key FROM monthly_reports)
       AND is_deleted = 0`,
      [currentMonth]
    );

    for (const item of monthsToArchive) {
      await this.generateMonthlyReport(item.month);
    }
    return monthsToArchive.length;
  },

  // ✅ جلب كل التقارير مرتبة بالأحدث مع camelCase mapping
  async listMonthlyReports(): Promise<MonthlyReport[]> {
    const rows = await getAll<any>(
      `SELECT * FROM monthly_reports ORDER BY month_key DESC`
    );
    return rows.map((r) => ({
      id:                   r.id,
      monthKey:             r.month_key,
      totalIncome:          r.total_income,
      totalExpense:         r.total_expense,
      netResult:            r.net_result,
      topExpenseCategoryId: r.top_expense_category_id ?? null,
      topIncomeCategoryId:  r.top_income_category_id  ?? null,
      highestSpendDay:      r.highest_spend_day        ?? null,
      totalGoalSaving:      r.total_goal_saving,
      openingBalance:       r.opening_balance          ?? null,
      closingBalance:       r.closing_balance          ?? null,
      workDaysCount:        r.work_days_count          ?? 0,
      daysOverDailyLimit:   r.days_over_daily_limit    ?? 0,
      generatedAt:          r.generated_at,
    }));
  },

  async getDashboardSummary(): Promise<Omit<DashboardSummary, 'balance'>> {
    const monthKey = new Date().toISOString().substring(0, 7);
    const today    = new Date().toISOString().substring(0, 10);

    const monthRow = await getFirst<{ income: number; expense: number }>(
      `SELECT 
        SUM(CASE WHEN kind = 'income' THEN amount_abs ELSE 0 END) as income,
        SUM(CASE WHEN kind IN ('expense', 'bill_payment', 'work_expense') THEN amount_abs ELSE 0 END) as expense
       FROM transactions 
       WHERE strftime('%Y-%m', occurred_at) = ? AND is_deleted = 0`,
      [monthKey]
    );

    const todayRow = await getFirst<{ spent: number }>(
      `SELECT SUM(amount_abs) as spent FROM transactions 
       WHERE date(occurred_at) = ? AND kind IN ('expense', 'bill_payment', 'work_expense') AND is_deleted = 0`,
      [today]
    );

    const limitRow = await getFirst<{ is_over_limit: number; remaining_from_limit: number }>(
      `SELECT is_over_limit, remaining_from_limit FROM daily_spending_summary WHERE summary_date = ?`,
      [today]
    );

    return {
      monthlyIncome:  monthRow?.income  || 0,
      monthlyExpense: monthRow?.expense || 0,
      todaySpent:     todayRow?.spent   || 0,
      isOverLimit:    Boolean(limitRow?.is_over_limit),
      remainingLimit: limitRow?.remaining_from_limit || 0,
    };
  },

  async getFourteenDayComparison(): Promise<DayComparisonPoint[]> {
    const rows = await getAll<{ date: string; income: number; expense: number }>(
      `SELECT 
        date(occurred_at) as date,
        SUM(CASE WHEN kind = 'income' THEN amount_abs ELSE 0 END) as income,
        SUM(CASE WHEN kind IN ('expense', 'bill_payment', 'work_expense') THEN amount_abs ELSE 0 END) as expense
       FROM transactions 
       WHERE occurred_at >= date('now', '-14 days') AND is_deleted = 0
       GROUP BY date(occurred_at)
       ORDER BY date ASC`
    );

    return rows.map((r) => ({
      dayKey:   r.date,
      dayLabel: r.date.substring(5),
      income:   r.income,
      expense:  r.expense,
    }));
  },

  async getSavingsComparison(): Promise<SavingsComparison> {
    const currentMonth  = new Date().toISOString().substring(0, 7);
    const lastMonthDate = new Date();
    lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
    const lastMonth = lastMonthDate.toISOString().substring(0, 7);

    const rows = await getAll<{ month: string; saved: number }>(
      `SELECT 
        strftime('%Y-%m', occurred_at) as month,
        SUM(amount_abs) as saved
       FROM transactions 
       WHERE kind = 'goal_transfer' AND is_deleted = 0 
       AND (strftime('%Y-%m', occurred_at) = ? OR strftime('%Y-%m', occurred_at) = ?)
       GROUP BY month`,
      [currentMonth, lastMonth]
    );

    const totalRow = await getFirst<{ total: number }>(
      `SELECT SUM(saved_amount) as total FROM goals`
    );

    const current  = rows.find((r) => r.month === currentMonth)?.saved || 0;
    const previous = rows.find((r) => r.month === lastMonth)?.saved    || 0;

    return {
      currentMonthSaving:  current,
      previousMonthSaving: previous,
      percentChange:       previous > 0 ? ((current - previous) / previous) * 100 : 0,
      totalSaving:         totalRow?.total || 0,
      nearestGoal:         'Active Goals',
    };
  },
};
