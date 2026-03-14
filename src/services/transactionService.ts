import * as Notifications from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';
import { getAll, getFirst, runInTransaction, runQuery } from '@/src/db/client';
import { settingsService } from '@/src/services/settingsService';
import { dailySummaryService } from '@/src/services/dailySummaryService'; // افترضنا وجوده
import type { CreateTransactionInput, UpdateTransactionInput } from '@/src/types/dto';
import type { Transaction, TransactionKind } from '@/src/types/domain';
import { nowIso } from '@/src/utils/date';
import { assertPositiveAmount } from '@/src/utils/validation';

interface TransactionRow {
  id: number;
  kind: TransactionKind;
  signed_amount: number;
  amount_abs: number;
  category_id: number | null;
  note: string | null;
  occurred_at: string;
  source: 'manual' | 'system' | 'import';
  is_deleted: number;
  cancel_reason: string | null;
  cancelled_at: string | null;
  balance_after: number | null;
  created_at: string;
  updated_at: string;
}

export interface ListTransactionFilters {
  search?: string;
  kind?: TransactionKind;
  categoryId?: number;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

const mapTransaction = (row: TransactionRow): Transaction => ({
  id: row.id,
  kind: row.kind,
  signedAmount: row.signed_amount,
  amountAbs: row.amount_abs,
  categoryId: row.category_id,
  note: row.note,
  occurredAt: row.occurred_at,
  source: row.source,
  isDeleted: Boolean(row.is_deleted),
  cancelReason: row.cancel_reason,
  cancelledAt: row.cancelled_at,
  balanceAfter: row.balance_after,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const signedFromKind = (kind: TransactionKind, amount: number) => {
  if (kind === 'income' || kind === 'goal_refund') return amount;
  return -amount;
};

async function maybeSendSpendingAlert(amount: number) {
  const settings = await settingsService.getSettings();
  if (!settings.spendingAlertEnabled) return;

  const averageRow = await getFirst<{ avg_expense: number }>(
    `SELECT COALESCE(AVG(day_expense), 0) AS avg_expense
     FROM (
       SELECT date(occurred_at) AS day_key, SUM(amount_abs) AS day_expense
       FROM transactions
       WHERE is_deleted = 0 AND kind = 'expense' AND occurred_at >= datetime('now', '-14 days')
       GROUP BY date(occurred_at)
     );`,
  );

  const average = averageRow?.avg_expense ?? 0;
  if (average <= 0) return;

  const thresholdValue = average * (1 + settings.spendingAlertThresholdPct / 100);
  if (amount <= thresholdValue) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Spending Alert',
      body: `This expense is above your usual average by more than ${settings.spendingAlertThresholdPct}%.`,
    },
    trigger: null,
  });
}

export const transactionService = {
  async createTransaction(input: CreateTransactionInput) {
    assertPositiveAmount(input.amount);

    return await runInTransaction(async (db) => {
      const now = nowIso();
      const amount = Math.round(input.amount * 100) / 100;
      const signedAmount = signedFromKind(input.kind, amount);

      // 1. Get and Update App Balance
      const currentBalance = await settingsService.getBalance();
      const newBalance = currentBalance + signedAmount;
      await settingsService.updateBalance(newBalance, db);

      // 2. Insert Transaction with balance_after
      await runQuery(
        `INSERT INTO transactions
         (kind, signed_amount, amount_abs, category_id, note, occurred_at, source, is_deleted, balance_after, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'manual', 0, ?, ?, ?);`,
        [input.kind, signedAmount, amount, input.categoryId ?? null, input.note ?? null, input.occurredAt, newBalance, now, now],
        db
      );

      // 3. Daily Summary Update for expenses
      if (['expense', 'bill_payment', 'work_expense'].includes(input.kind)) {
        await dailySummaryService.updateDailySummary(input.occurredAt, db);
      }

      if (input.kind === 'expense') {
        await maybeSendSpendingAlert(amount);
      }
    });
  },

  async createSystemTransaction(input: CreateTransactionInput, dbArg?: SQLiteDatabase) {
    assertPositiveAmount(input.amount);
    const now = nowIso();
    const amount = Math.round(input.amount * 100) / 100;
    const signedAmount = signedFromKind(input.kind, amount);

    // This is often called inside another transaction, so we use dbArg
    const currentBalance = await settingsService.getBalance();
    const newBalance = currentBalance + signedAmount;
    await settingsService.updateBalance(newBalance, dbArg);

    const result = await runQuery(
      `INSERT INTO transactions
       (kind, signed_amount, amount_abs, category_id, note, occurred_at, source, is_deleted, balance_after, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'system', 0, ?, ?, ?);`,
      [input.kind, signedAmount, amount, input.categoryId ?? null, input.note ?? null, input.occurredAt, newBalance, now, now],
      dbArg,
    );

    const typedResult = result as { lastInsertRowId?: number };
    
    // Update Daily Summary
    if (['expense', 'bill_payment', 'work_expense'].includes(input.kind)) {
        await dailySummaryService.updateDailySummary(input.occurredAt, dbArg);
    }

    return typedResult.lastInsertRowId ?? 0;
  },

  async cancelTransaction(id: number, reason: string) {
    return await runInTransaction(async (db) => {
      const current = await this.getTransactionById(id);
      if (!current || current.isDeleted) throw new Error('Transaction not found');

      const now = nowIso();
      // Reverse the balance: subtract the signedAmount that was added
      const currentBalance = await settingsService.getBalance();
      const newBalance = currentBalance - current.signedAmount;
      
      await settingsService.updateBalance(newBalance, db);

      await runQuery(
        `UPDATE transactions 
         SET is_deleted = 1, cancel_reason = ?, cancelled_at = ?, updated_at = ? 
         WHERE id = ?;`,
        [reason, now, now, id],
        db
      );

      // Re-calculate daily summary for the day of the cancelled transaction
      if (['expense', 'bill_payment', 'work_expense'].includes(current.kind)) {
        await dailySummaryService.updateDailySummary(current.occurredAt, db);
      }
    });
  },

  async updateTransaction(input: UpdateTransactionInput) {
    // Note: Update logic here might need to adjust balance if amount changes. 
    // Given the complexity, often it's better to cancel and re-create, 
    // but here we follow the request.
    const current = await getFirst<TransactionRow>(
      'SELECT * FROM transactions WHERE id = ? AND is_deleted = 0 LIMIT 1;',
      [input.id],
    );
    if (!current) throw new Error('Transaction not found');
    if (current.kind === 'goal_transfer' || current.kind === 'goal_refund') {
      throw new Error('Goal-linked transaction cannot be edited directly');
    }

    const nextAmount = input.amount ?? current.amount_abs;
    assertPositiveAmount(nextAmount);

    return await runInTransaction(async (db) => {
        const oldSigned = current.signed_amount;
        const newSigned = signedFromKind(current.kind, nextAmount);
        
        // Adjust total balance: remove old, add new
        const currentBalance = await settingsService.getBalance();
        const adjustedBalance = currentBalance - oldSigned + newSigned;
        await settingsService.updateBalance(adjustedBalance, db);

        await runQuery(
          `UPDATE transactions
           SET signed_amount = ?, amount_abs = ?, category_id = ?, note = ?, occurred_at = ?, balance_after = ?, updated_at = ?
           WHERE id = ?;`,
          [
            newSigned,
            nextAmount,
            input.categoryId ?? current.category_id,
            input.note ?? current.note,
            input.occurredAt ?? current.occurred_at,
            adjustedBalance, // This is simplified; accurate balance_after requires re-calculating all subsequent txs
            nowIso(),
            input.id,
          ],
          db
        );

        if (['expense', 'bill_payment', 'work_expense'].includes(current.kind)) {
            await dailySummaryService.updateDailySummary(input.occurredAt ?? current.occurred_at, db);
        }
    });
  },

  async softDeleteTransaction(id: number) {
    // Prefer cancelTransaction to handle balance accurately
    await runQuery('UPDATE transactions SET is_deleted = 1, updated_at = ? WHERE id = ?;', [nowIso(), id]);
  },

  async getBalance() {
    // Now we can get it directly from settings or sum transactions
    const row = await getFirst<{ balance: number }>(
      'SELECT COALESCE(SUM(signed_amount), 0) AS balance FROM transactions WHERE is_deleted = 0;',
    );
    return row?.balance ?? 0;
  },

  async listTransactions(filters: ListTransactionFilters = {}) {
    const clauses = ['is_deleted = 0'];
    const params: unknown[] = [];

    if (filters.search) {
      clauses.push('(note LIKE ?)');
      params.push(`%${filters.search}%`);
    }
    if (filters.kind) {
      clauses.push('kind = ?');
      params.push(filters.kind);
    }
    if (typeof filters.categoryId === 'number') {
      clauses.push('category_id = ?');
      params.push(filters.categoryId);
    }
    if (filters.dateFrom) {
      clauses.push('occurred_at >= ?');
      params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      clauses.push('occurred_at <= ?');
      params.push(filters.dateTo);
    }

    const limit = filters.limit ?? 30;
    const rows = await getAll<TransactionRow>(
      `SELECT * FROM transactions
       WHERE ${clauses.join(' AND ')}
       ORDER BY occurred_at DESC
       LIMIT ?;`,
      [...params, limit],
    );

    return rows.map(mapTransaction);
  },

  async listTransactionsByDay(dateKey: string, limit = 200) {
    const rows = await getAll<TransactionRow>(
      `SELECT * FROM transactions
       WHERE is_deleted = 0 AND date(occurred_at) = date(?)
       ORDER BY occurred_at DESC
       LIMIT ?;`,
      [dateKey, limit],
    );
    return rows.map(mapTransaction);
  },

  async getTransactionById(id: number) {
    const row = await getFirst<TransactionRow>(
      'SELECT * FROM transactions WHERE id = ? AND is_deleted = 0 LIMIT 1;',
      [id],
    );
    return row ? mapTransaction(row) : null;
  },

  async replaceAll(rows: Record<string, unknown>[]) {
    await runInTransaction(async (db) => {
      await runQuery('DELETE FROM transactions;', [], db);
      for (const row of rows) {
        await runQuery(
          `INSERT INTO transactions
            (id, kind, signed_amount, amount_abs, category_id, note, occurred_at, source, is_deleted, cancel_reason, cancelled_at, balance_after, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            row.id,
            row.kind,
            row.signed_amount,
            row.amount_abs,
            row.category_id ?? null,
            row.note ?? null,
            row.occurred_at,
            row.source,
            row.is_deleted ?? 0,
            row.cancel_reason ?? null,
            row.cancelled_at ?? null,
            row.balance_after ?? null,
            row.created_at,
            row.updated_at,
          ],
          db,
        );
      }
    });
  },
};
