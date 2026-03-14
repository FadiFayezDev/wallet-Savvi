import { runQuery, getAll } from '../client';

export const recurringBillQueries = {
  insert: (name: string, amount: number, day: number, catId?: number) => {
    return runQuery(
      `INSERT INTO recurring_bills (name, amount, due_day, category_id, created_at) VALUES (?, ?, ?, ?, ?)`,
      [name, amount, day, catId, new Date().toISOString()]
    );
  },

  getBillsNotAppliedInMonth: (monthKey: string) => {
    // يحضر الفواتير التي ليس لها سجل (instance) في هذا الشهر
    const sql = `
      SELECT * FROM recurring_bills 
      WHERE is_active = 1 
      AND id NOT IN (
        SELECT bill_id FROM bill_instances WHERE strftime('%Y-%m', due_date) = ?
      );
    `;
    return getAll<any>(sql, [monthKey]);
  }
  // يمكن إضافة بقية الـ CRUD (update, delete) بنفس النمط
};