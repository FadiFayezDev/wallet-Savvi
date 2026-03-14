import { runQuery, getAll } from '../client';

export const workQueries = {
  // Schedule
  updateSchedule: (day: number, isWork: boolean, start?: string, end?: string) => {
    return runQuery(
      `UPDATE work_schedule SET is_work_day = ?, start_time = ?, end_time = ?, updated_at = ? WHERE day_of_week = ?`,
      [isWork ? 1 : 0, start, end, new Date().toISOString(), day]
    );
  },

  // Log
  insertWorkLog: (date: string, expenses: number, note?: string) => {
    return runQuery(
      `INSERT INTO work_days_log (work_date, total_work_expenses, note, created_at) VALUES (?, ?, ?, ?)`,
      [date, expenses, note, new Date().toISOString()]
    );
  },

  getWorkLogsRange: (start: string, end: string) => {
    return getAll<any>(`SELECT * FROM work_days_log WHERE work_date BETWEEN ? AND ?`, [start, end]);
  }
};