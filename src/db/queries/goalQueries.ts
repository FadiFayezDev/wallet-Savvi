import { runQuery } from '../client';
import { Goal } from '@/src/types/domain';

export const goalQueries = {
  insert: (g: Partial<Goal>) => {
    const sql = `
      INSERT INTO goals (
        name, target_amount, saved_amount, monthly_contribution, 
        icon, deadline, note, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;
    return runQuery(sql, [
      g.name, g.targetAmount, g.savedAmount || 0, g.monthlyContribution,
      g.icon, g.deadline, g.note, g.status || 'active', g.createdAt, g.updatedAt
    ]);
  },

  update: (id: number, g: Partial<Goal>) => {
    const sql = `
      UPDATE goals SET 
        name = COALESCE(?, name),
        target_amount = COALESCE(?, target_amount),
        monthly_contribution = COALESCE(?, monthly_contribution),
        icon = COALESCE(?, icon),
        deadline = COALESCE(?, deadline),
        note = COALESCE(?, note),
        updated_at = ?
      WHERE id = ?;
    `;
    return runQuery(sql, [g.name, g.targetAmount, g.monthlyContribution, g.icon, g.deadline, g.note, new Date().toISOString(), id]);
  }
};