import type { SQLiteDatabase } from "expo-sqlite";

import { getAll, getFirst, runQuery } from "@/src/db/client";
import { monthEndIso, monthStartIso, nowIso, toMonthKey } from "@/src/utils/date";
import { assertPositiveAmount } from "@/src/utils/validation";

export interface Budget {
  id: number;
  categoryId: number;
  amount: number;
  lastNotifiedMonth: string | null;
  createdAt: string;
  updatedAt: string;
}

interface BudgetRow {
  id: number;
  category_id: number;
  amount: number;
  last_notified_month: string | null;
  created_at: string;
  updated_at: string;
}

const mapBudget = (row: BudgetRow): Budget => ({
  id: row.id,
  categoryId: row.category_id,
  amount: row.amount,
  lastNotifiedMonth: row.last_notified_month ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const budgetService = {
  async listBudgets(dbArg?: SQLiteDatabase): Promise<Budget[]> {
    const rows = await getAll<BudgetRow>(
      `SELECT * FROM budgets ORDER BY updated_at DESC;`,
      [],
      dbArg,
    );
    return rows.map(mapBudget);
  },

  async getBudgetByCategory(categoryId: number, dbArg?: SQLiteDatabase): Promise<Budget | null> {
    const row = await getFirst<BudgetRow>(
      `SELECT * FROM budgets WHERE category_id = ? LIMIT 1;`,
      [categoryId],
      dbArg,
    );
    return row ? mapBudget(row) : null;
  },

  async upsertBudget(categoryId: number, amount: number, dbArg?: SQLiteDatabase) {
    assertPositiveAmount(amount, "Budget amount");
    const now = nowIso();
    const existing = await getFirst<{ id: number }>(
      `SELECT id FROM budgets WHERE category_id = ? LIMIT 1;`,
      [categoryId],
      dbArg,
    );
    if (existing?.id) {
      return runQuery(
        `UPDATE budgets SET amount = ?, updated_at = ? WHERE id = ?;`,
        [amount, now, existing.id],
        dbArg,
      );
    }
    return runQuery(
      `INSERT INTO budgets (category_id, amount, last_notified_month, created_at, updated_at)
       VALUES (?, ?, NULL, ?, ?);`,
      [categoryId, amount, now, now],
      dbArg,
    );
  },

  async deleteBudget(categoryId: number, dbArg?: SQLiteDatabase) {
    return runQuery(`DELETE FROM budgets WHERE category_id = ?;`, [categoryId], dbArg);
  },

  async setLastNotifiedMonth(categoryId: number, monthKey: string, dbArg?: SQLiteDatabase) {
    return runQuery(
      `UPDATE budgets SET last_notified_month = ?, updated_at = ? WHERE category_id = ?;`,
      [monthKey, nowIso(), categoryId],
      dbArg,
    );
  },

  async getCategorySpendForMonth(
    categoryId: number,
    monthKeyOrDate: string,
    dbArg?: SQLiteDatabase,
  ): Promise<number> {
    const monthKey = toMonthKey(monthKeyOrDate);
    const row = await getFirst<{ total: number }>(
      `SELECT COALESCE(SUM(amount_abs), 0) AS total
       FROM transactions
       WHERE is_deleted = 0
         AND category_id = ?
         AND kind IN ('expense', 'bill_payment', 'work_expense')
         AND occurred_at BETWEEN ? AND ?;`,
      [categoryId, monthStartIso(monthKey), monthEndIso(monthKey)],
      dbArg,
    );
    return row?.total ?? 0;
  },

  async listCategorySpendForMonth(
    monthKeyOrDate: string,
    dbArg?: SQLiteDatabase,
  ): Promise<Record<number, number>> {
    const monthKey = toMonthKey(monthKeyOrDate);
    const rows = await getAll<{ category_id: number; total: number }>(
      `SELECT category_id, COALESCE(SUM(amount_abs), 0) AS total
       FROM transactions
       WHERE is_deleted = 0
         AND category_id IS NOT NULL
         AND kind IN ('expense', 'bill_payment', 'work_expense')
         AND occurred_at BETWEEN ? AND ?
       GROUP BY category_id;`,
      [monthStartIso(monthKey), monthEndIso(monthKey)],
      dbArg,
    );
    return rows.reduce<Record<number, number>>((acc, row) => {
      acc[row.category_id] = row.total ?? 0;
      return acc;
    }, {});
  },
};
