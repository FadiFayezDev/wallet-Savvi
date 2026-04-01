import { runQuery, getFirst } from '../client';
import { Transaction } from '@/src/types/domain';

export const transactionQueries = {
  insert: (t: Partial<Transaction>) => {
    const sql = `
      INSERT INTO transactions (
        kind, signed_amount, amount_abs, category_id, account_id, note, 
        occurred_at, source, is_deleted, cancel_reason, 
        cancelled_at, balance_after, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;
    return runQuery(sql, [
      t.kind, t.signedAmount, t.amountAbs, t.categoryId, t.accountId ?? null, t.note,
      t.occurredAt, t.source || 'manual', t.isDeleted ? 1 : 0, t.cancelReason,
      t.cancelledAt, t.balanceAfter, t.createdAt, t.updatedAt
    ]);
  },

  getById: (id: number) => {
    return getFirst<any>(`SELECT * FROM transactions WHERE id = ?`, [id]);
  },

  updateCancelled: (id: number, reason: string, cancelledAt: string) => {
    return runQuery(
      `UPDATE transactions SET cancel_reason = ?, cancelled_at = ?, updated_at = ? WHERE id = ?`,
      [reason, cancelledAt, new Date().toISOString(), id]
    );
  }
};
