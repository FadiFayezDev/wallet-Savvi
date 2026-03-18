import { getFirst, getAll, runQuery, runInTransaction } from '@/src/db/client';
import { transactionService } from './transactionService';
import { nowIso } from '@/src/utils/date';
import type { WorkDayLog, WorkSchedule, DailyWorkExpense } from '@/src/types/domain';

export const WORK_SKIP_NOTE = '__WORK_SKIP__';

export const workService = {
  async ensureScheduleSeeded() {
    const countRow = await getFirst<{ count: number }>('SELECT COUNT(*) as count FROM work_schedule;');
    if ((countRow?.count ?? 0) > 0) return;
    const now = nowIso();
    for (let day = 0; day <= 6; day += 1) {
      await runQuery(
        `INSERT INTO work_schedule (day_of_week, is_work_day, start_time, end_time, updated_at)
         VALUES (?, 0, NULL, NULL, ?);`,
        [day, now]
      );
    }
  },

  async listSchedule(): Promise<WorkSchedule[]> {
    await this.ensureScheduleSeeded();
    const rows = await getAll<any>('SELECT * FROM work_schedule ORDER BY day_of_week ASC;');
    return rows.map((row) => ({
      id: row.id,
      dayOfWeek: row.day_of_week,
      isWorkDay: Boolean(row.is_work_day),
      startTime: row.start_time ?? null,
      endTime: row.end_time ?? null,
      updatedAt: row.updated_at,
    }));
  },

  /**
   * تسجيل يوم عمل بالقيم الافتراضية
   * بيسحب المصاريف النشطة حالياً وبيخصمها من الرصيد ويسجلها في الـ log
   */
  async logStandardWorkDay(dateIso: string) {
    return await runInTransaction(async (db) => {
      const dateKey = dateIso.split('T')[0];

      const existing = await getFirst<{ id: number }>(
        'SELECT id FROM work_days_log WHERE work_date = ? LIMIT 1;',
        [dateKey],
        db
      );
      if (existing) return { success: false, status: 'already_logged', totalExpenseAmount: 0 };

      // 1. حساب إجمالي مصاريف العمل الافتراضية النشطة
      const activeExpenses = await getAll<{ id: number; name: string; defaultAmount: number }>(
        'SELECT id, name, default_amount as defaultAmount FROM daily_work_expenses WHERE is_active = 1;',
        [],
        db
      );

      const totalExpenseAmount = activeExpenses.reduce((sum, exp) => sum + (exp.defaultAmount || 0), 0);

      // 2. إذا وجد مصاريف، يتم إنشاء معاملة مالية (Transaction)
      if (totalExpenseAmount > 0) {
        await transactionService.createSystemTransaction({
          kind: 'work_expense',
          amount: totalExpenseAmount,
          note: `مصاريف عمل يومية (${activeExpenses.map(e => e.name).join(', ')})`,
          occurredAt: dateIso,
        }, db);
      }

      // 3. جلب مواعيد الشغل المفترضة لهذا اليوم من الـ Schedule
      const dayOfWeek = new Date(dateIso).getDay();
      const schedule = await getFirst<any>(
        'SELECT start_time, end_time FROM work_schedule WHERE day_of_week = ?;',
        [dayOfWeek],
        db
      );

      // 4. تسجيل اليوم في الـ Log
      await runQuery(
        `INSERT INTO work_days_log (work_date, shift_start, shift_end, total_work_expenses, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?);`,
        [
          dateKey,
          schedule?.start_time || null,
          schedule?.end_time || null,
          totalExpenseAmount,
          'Standard work day',
          nowIso()
        ],
        db
      );

      return { success: true, status: 'logged', totalExpenseAmount };
    });
  },

  /**
   * تسجيل يوم عمل يدوي (Custom) بمصاريف ومواعيد محددة
   */
  async logCustomWorkDay(input: {
    date: string;
    shiftStart?: string;
    shiftEnd?: string;
    expenseAmount: number;
    note?: string;
  }) {
    return await runInTransaction(async (db) => {
      const existing = await getFirst<{ id: number }>(
        'SELECT id FROM work_days_log WHERE work_date = ? LIMIT 1;',
        [input.date],
        db
      );
      if (existing) {
        throw new Error('Work day already logged');
      }

      if (input.expenseAmount > 0) {
        await transactionService.createSystemTransaction({
          kind: 'work_expense',
          amount: input.expenseAmount,
          note: input.note || 'مصاريف عمل يدوية',
          occurredAt: input.date,
        }, db);
      }

      await runQuery(
        `INSERT INTO work_days_log (work_date, shift_start, shift_end, total_work_expenses, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?);`,
        [input.date, input.shiftStart || null, input.shiftEnd || null, input.expenseAmount, input.note || null, nowIso()],
        db
      );
    });
  },

  async skipWorkDay(dateIso: string) {
    return await runInTransaction(async (db) => {
      const dateKey = dateIso.split('T')[0];
      const existing = await getFirst<{ id: number }>(
        'SELECT id FROM work_days_log WHERE work_date = ? LIMIT 1;',
        [dateKey],
        db
      );
      if (existing) return { success: false, status: 'already_logged' };

      await runQuery(
        `INSERT INTO work_days_log (work_date, shift_start, shift_end, total_work_expenses, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?);`,
        [dateKey, null, null, 0, WORK_SKIP_NOTE, nowIso()],
        db
      );

      return { success: true, status: 'skipped' };
    });
  },

  async removeWorkLog(id: number) {
    const log = await getFirst<any>(
      'SELECT * FROM work_days_log WHERE id = ? LIMIT 1;',
      [id]
    );
    if (!log) return { success: false, status: 'not_found' };

    const tx = await getFirst<{ id: number }>(
      `SELECT id FROM transactions
       WHERE is_deleted = 0
         AND kind = 'work_expense'
         AND date(occurred_at) = date(?)
         AND amount_abs = ?
         AND source = 'system'
       ORDER BY id DESC
       LIMIT 1;`,
      [log.work_date, log.total_work_expenses ?? 0]
    );

    if (tx?.id) {
      await transactionService.cancelTransaction(tx.id, 'Work log removed');
    }

    await runQuery('DELETE FROM work_days_log WHERE id = ?;', [id]);
    return { success: true, removedTransaction: Boolean(tx?.id) };
  },

  /**
   * إدارة جدول المواعيد (Schedule)
   */
  async updateSchedule(dayOfWeek: number, isWorkDay: boolean, start?: string, end?: string) {
    await this.ensureScheduleSeeded();
    const existing = await getFirst<{ id: number }>(
      'SELECT id FROM work_schedule WHERE day_of_week = ?;',
      [dayOfWeek]
    );
    if (!existing) {
      await runQuery(
        `INSERT INTO work_schedule (day_of_week, is_work_day, start_time, end_time, updated_at)
         VALUES (?, ?, ?, ?, ?);`,
        [dayOfWeek, isWorkDay ? 1 : 0, start || null, end || null, nowIso()]
      );
      return;
    }
    return await runQuery(
      `UPDATE work_schedule 
       SET is_work_day = ?, start_time = ?, end_time = ?, updated_at = ? 
       WHERE day_of_week = ?;`,
      [isWorkDay ? 1 : 0, start || null, end || null, nowIso(), dayOfWeek]
    );
  },

  /**
   * إدارة المصاريف الثابتة (Daily Expenses)
   */
  async addDefaultExpense(name: string, amount: number) {
    return await runQuery(
      'INSERT INTO daily_work_expenses (name, default_amount, is_active) VALUES (?, ?, 1);',
      [name, amount]
    );
  },

  async listDailyExpenses(): Promise<DailyWorkExpense[]> {
    const rows = await getAll<any>('SELECT * FROM daily_work_expenses ORDER BY id DESC;');
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      defaultAmount: row.default_amount,
      isActive: Boolean(row.is_active),
    }));
  },

  async toggleExpenseActive(id: number, isActive: boolean) {
    return await runQuery(
      'UPDATE daily_work_expenses SET is_active = ? WHERE id = ?;',
      [isActive ? 1 : 0, id]
    );
  },

  async listWorkLogs(limit = 20): Promise<WorkDayLog[]> {
    const rows = await getAll<any>(
      `SELECT * FROM work_days_log ORDER BY work_date DESC, id DESC LIMIT ?;`,
      [limit]
    );
    return rows.map((row) => ({
      id: row.id,
      workDate: row.work_date,
      shiftStart: row.shift_start ?? null,
      shiftEnd: row.shift_end ?? null,
      totalWorkExpenses: row.total_work_expenses ?? 0,
      note: row.note ?? null,
      createdAt: row.created_at,
    }));
  },

  async getWorkLogByDate(dateIso: string): Promise<WorkDayLog | null> {
    const dateKey = dateIso.split('T')[0];
    const row = await getFirst<any>(
      'SELECT * FROM work_days_log WHERE work_date = ? LIMIT 1;',
      [dateKey]
    );
    if (!row) return null;
    return {
      id: row.id,
      workDate: row.work_date,
      shiftStart: row.shift_start ?? null,
      shiftEnd: row.shift_end ?? null,
      totalWorkExpenses: row.total_work_expenses ?? 0,
      note: row.note ?? null,
      createdAt: row.created_at,
    };
  },
};
