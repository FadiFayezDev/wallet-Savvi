import { getFirst, getAll, runQuery, runInTransaction } from '@/src/db/client';
import { transactionService } from './transactionService';
import { nowIso } from '@/src/utils/date';
import type { BillInstance } from '@/src/types/domain';
import type { InsertRecurringBillDto, UpdateRecurringBillDto } from '@/src/types/dto';
import dayjs from 'dayjs';

export const recurringBillService = {
  /**
   * إنشاء فاتورة دورية جديدة
   */
  async createBill(input: InsertRecurringBillDto) {
    const now = nowIso();
    return await runQuery(
      `INSERT INTO recurring_bills (name, amount, category_id, due_day, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [input.name, input.amount, input.categoryId ?? null, input.dueDay, input.isActive === false ? 0 : 1, now]
    );
  },

  async updateBill(input: UpdateRecurringBillDto) {
    const current = await getFirst<any>('SELECT * FROM recurring_bills WHERE id = ?;', [input.id]);
    if (!current) throw new Error('Bill not found');
    return await runQuery(
      `UPDATE recurring_bills
       SET name = ?, amount = ?, category_id = ?, due_day = ?, is_active = ?
       WHERE id = ?;`,
      [
        input.name ?? current.name,
        input.amount ?? current.amount,
        input.categoryId ?? current.category_id,
        input.dueDay ?? current.due_day,
        typeof input.isActive === 'boolean' ? (input.isActive ? 1 : 0) : current.is_active,
        input.id,
      ]
    );
  },

  /**
   * دفع الفاتورة (العملية الأهم)
   * بتعمل Transaction حقيقية وبتسجل Instance للفاتورة وبتخصم من الرصيد
   */
  async applyBill(billId: number, dueDate: string, accountId?: number | null) {
    return await runInTransaction(async (db) => {
      // 1. جلب بيانات الفاتورة
      const bill = await getFirst<any>(
        'SELECT * FROM recurring_bills WHERE id = ?;',
        [billId],
        db
      );
      if (!bill) throw new Error('Bill not found');

      // 2. إنشاء Transaction من خلال الـ transactionService
      // دي لوحدها بتحدث الـ balance والـ dailySummary والـ balance_after
      const transactionId = await transactionService.createSystemTransaction({
        kind: 'bill_payment',
        amount: bill.amount,
        categoryId: bill.category_id,
        note: `دفع فاتورة: ${bill.name}`,
        accountId: typeof accountId === 'number' ? accountId : undefined,
        occurredAt: nowIso(),
      }, db);

      // 3. تسجيل سجل دفع الفاتورة (Bill Instance)
      await runQuery(
        `INSERT INTO bill_instances (bill_id, transaction_id, due_date, status, paid_at)
         VALUES (?, ?, ?, 'paid', ?);`,
        [billId, transactionId, dueDate, nowIso()],
        db
      );

      return { success: true, transactionId };
    });
  },

  /**
   * تخطي دفع فاتورة لهذا الشهر
   */
  async skipBill(billId: number, dueDate: string) {
    return await runQuery(
      `INSERT INTO bill_instances (bill_id, status, due_date)
       VALUES (?, 'skipped', ?);`,
      [billId, dueDate]
    );
  },

  /**
   * جلب الفواتير اللي لسه مدفعتش في شهر معين
   */
  async getPendingBills(monthKey: string) {
    // شهر بصيغة YYYY-MM
    return await getAll<any>(
      `SELECT * FROM recurring_bills 
       WHERE is_active = 1 
       AND id NOT IN (
         SELECT bill_id FROM bill_instances 
         WHERE strftime('%Y-%m', due_date) = ?
       )
       ORDER BY due_day ASC;`,
      [monthKey]
    );
  },

  async getAllBills(includeInactive = false) {
    if (includeInactive) {
      return await getAll<any>('SELECT * FROM recurring_bills ORDER BY due_day ASC;');
    }
    return await getAll<any>('SELECT * FROM recurring_bills WHERE is_active = 1 ORDER BY due_day ASC;');
  },

  async toggleBillStatus(id: number, isActive: boolean) {
    return await runQuery(
      'UPDATE recurring_bills SET is_active = ? WHERE id = ?;',
      [isActive ? 1 : 0, id]
    );
  },

  async listBillInstancesForMonth(monthKey: string): Promise<BillInstance[]> {
    const rows = await getAll<any>(
      `SELECT * FROM bill_instances WHERE strftime('%Y-%m', due_date) = ? ORDER BY due_date ASC;`,
      [monthKey]
    );
    return rows.map((row) => ({
      id: row.id,
      billId: row.bill_id,
      transactionId: row.transaction_id ?? null,
      dueDate: row.due_date,
      status: row.status,
      paidAt: row.paid_at ?? null,
    }));
  },

  async listBillInstancesForDate(dateIso: string): Promise<any[]> {
    const dateKey = dateIso.split('T')[0];
    const rows = await getAll<any>(
      `SELECT bi.*, b.name as bill_name, b.amount as bill_amount
       FROM bill_instances bi
       JOIN recurring_bills b ON b.id = bi.bill_id
       WHERE date(bi.due_date) = date(?)
       ORDER BY bi.due_date ASC;`,
      [dateKey]
    );
    return rows.map((row) => ({
      id: row.id,
      billId: row.bill_id,
      transactionId: row.transaction_id ?? null,
      dueDate: row.due_date,
      status: row.status,
      paidAt: row.paid_at ?? null,
      billName: row.bill_name ?? null,
      billAmount: row.bill_amount ?? null,
    }));
  },

  async listPaidBillInstancesWithBillForDate(dateKey: string) {
    return await getAll<any>(
      `SELECT bi.*, b.amount as bill_amount, b.name as bill_name
       FROM bill_instances bi
       JOIN recurring_bills b ON b.id = bi.bill_id
       WHERE date(bi.due_date) = date(?) AND bi.status = 'paid'`,
      [dateKey]
    );
  },

  getDueDateForMonth(monthKey: string, dueDay: number) {
    const base = dayjs(`${monthKey}-01`);
    const lastDay = base.endOf('month').date();
    const clamped = Math.min(Math.max(dueDay, 1), lastDay);
    return base.date(clamped).format('YYYY-MM-DD');
  },
};
