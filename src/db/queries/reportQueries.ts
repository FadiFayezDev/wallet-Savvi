import { runQuery, getAll } from '../client';

export const reportQueries = {
  // Queries for report_category_breakdown
  insertBreakdown: (reportId: number, categoryId: number, amount: number, percentage: number) => {
    return runQuery(
      `INSERT INTO report_category_breakdown (report_id, category_id, total_amount, percentage) VALUES (?, ?, ?, ?)`,
      [reportId, categoryId, amount, percentage]
    );
  },

  getBreakdownByReport: (reportId: number) => {
    return getAll<any>(`SELECT * FROM report_category_breakdown WHERE report_id = ?`, [reportId]);
  }
};