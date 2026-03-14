import { runQuery, getFirst } from '../client';

export const dailySummaryQueries = {
  upsert: (date: string, amount: number, isOver: boolean, remaining: number) => {
    const sql = `
      INSERT INTO daily_spending_summary (summary_date, total_spent, is_over_limit, remaining_from_limit)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(summary_date) DO UPDATE SET
        total_spent = excluded.total_spent,
        is_over_limit = excluded.is_over_limit,
        remaining_from_limit = excluded.remaining_from_limit;
    `;
    return runQuery(sql, [date, amount, isOver ? 1 : 0, remaining]);
  },

  getByDate: (date: string) => {
    return getFirst<any>(`SELECT * FROM daily_spending_summary WHERE summary_date = ?`, [date]);
  }
};