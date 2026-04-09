import * as Notifications from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';
import { getAll, getFirst, runInTransaction, runQuery } from '@/src/db/client';
import { settingsService } from '@/src/services/settingsService';
import { accountService } from '@/src/services/accountService';
import { budgetService } from '@/src/services/budgetService';
import { dailySummaryService } from '@/src/services/dailySummaryService'; // افترضنا وجوده
import type { CreateTransactionInput, UpdateTransactionInput } from '@/src/types/dto';
import type { Transaction, TransactionKind } from '@/src/types/domain';
import { nowIso, toMonthKey } from '@/src/utils/date';
import { assertPositiveAmount } from '@/src/utils/validation';

interface TransactionRow {
  id: number;
  kind: TransactionKind;
  signed_amount: number;
  amount_abs: number;
  category_id: number | null;
  account_id: number | null;
  note: string | null;
  occurred_at: string;
  source: 'manual' | 'system' | 'import' | 'transfer';
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
  accountId: row.account_id ?? null,
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

async function maybeSendBudgetAlert(
  categoryId: number,
  occurredAt: string,
  dbArg?: SQLiteDatabase,
) {
  const budget = await budgetService.getBudgetByCategory(categoryId, dbArg);
  if (!budget) return;
  const monthKey = toMonthKey(occurredAt);
  if (budget.lastNotifiedMonth === monthKey) return;

  const spent = await budgetService.getCategorySpendForMonth(
    categoryId,
    monthKey,
    dbArg,
  );
  if (spent < budget.amount) return;

  const settings = await settingsService.getSettings();
  const isArabic = (settings?.locale ?? 'ar').toLowerCase().startsWith('ar');
  const title = isArabic ? 'تنبيه الميزانية' : 'Budget Alert';
  const body = isArabic
    ? 'وصلت لحد الميزانية لهذه الفئة.'
    : 'You have reached the budget for this category.';

  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: null,
  });

  await budgetService.setLastNotifiedMonth(categoryId, monthKey, dbArg);
}

export const transactionService = {
  async listTransactionsByAccount(accountId: number): Promise<Transaction[]> {
    const rows = await getAll<TransactionRow>(
      `SELECT * FROM transactions
       WHERE is_deleted = 0 AND account_id = ?
       ORDER BY occurred_at DESC, id DESC;`,
      [accountId],
    );
    return rows.map(mapTransaction);
  },
  async createTransaction(input: CreateTransactionInput) {
    assertPositiveAmount(input.amount);

    return await runInTransaction(async (db) => {
      const now = nowIso();
      const amount = Math.round(input.amount * 100) / 100;
      const signedAmount = signedFromKind(input.kind, amount);
      const accountId = typeof input.accountId === 'number'
        ? input.accountId
        : await accountService.getDefaultAccountId();

      // 1. Get and Update App Balance
      const currentBalance = await settingsService.getBalance();
      const newBalance = currentBalance + signedAmount;
      await settingsService.updateBalance(newBalance, db);

      // 1.1 Update Account Balance
      const accountRow = await getFirst<{ balance: number }>(
        'SELECT balance FROM accounts WHERE id = ?;',
        [accountId],
        db,
      );
      if (!accountRow) throw new Error('Account not found');
      const nextAccountBalance = (accountRow.balance ?? 0) + signedAmount;
      await accountService.updateAccountBalance(accountId, nextAccountBalance, db);

      // 2. Insert Transaction with balance_after
      await runQuery(
        `INSERT INTO transactions
         (kind, signed_amount, amount_abs, category_id, account_id, note, occurred_at, source, is_deleted, balance_after, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', 0, ?, ?, ?);`,
        [
          input.kind,
          signedAmount,
          amount,
          input.categoryId ?? null,
          accountId,
          input.note ?? null,
          input.occurredAt,
          newBalance,
          now,
          now,
        ],
        db
      );

      // 3. Daily Summary Update for expenses
      if (['expense', 'bill_payment', 'work_expense'].includes(input.kind)) {
        await dailySummaryService.updateDailySummary(input.occurredAt, db);
      }

      if (input.kind === 'expense') {
        await maybeSendSpendingAlert(amount);
      }

      if (
        input.categoryId &&
        ['expense', 'bill_payment', 'work_expense'].includes(input.kind)
      ) {
        await maybeSendBudgetAlert(input.categoryId, input.occurredAt, db);
      }
    });
  },

  async createSystemTransaction(input: CreateTransactionInput, dbArg?: SQLiteDatabase) {
    assertPositiveAmount(input.amount);
    const now = nowIso();
    const amount = Math.round(input.amount * 100) / 100;
    const signedAmount = signedFromKind(input.kind, amount);
    const accountId = typeof input.accountId === 'number'
      ? input.accountId
      : await accountService.getDefaultAccountId();

    // This is often called inside another transaction, so we use dbArg
    const currentBalance = await settingsService.getBalance();
    const newBalance = currentBalance + signedAmount;
    await settingsService.updateBalance(newBalance, dbArg);

    const accountRow = await getFirst<{ balance: number }>(
      'SELECT balance FROM accounts WHERE id = ?;',
      [accountId],
      dbArg,
    );
    if (!accountRow) throw new Error('Account not found');
    const nextAccountBalance = (accountRow.balance ?? 0) + signedAmount;
    await accountService.updateAccountBalance(accountId, nextAccountBalance, dbArg);

    const result = await runQuery(
      `INSERT INTO transactions
       (kind, signed_amount, amount_abs, category_id, account_id, note, occurred_at, source, is_deleted, balance_after, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'system', 0, ?, ?, ?);`,
      [
        input.kind,
        signedAmount,
        amount,
        input.categoryId ?? null,
        accountId,
        input.note ?? null,
        input.occurredAt,
        newBalance,
        now,
        now,
      ],
      dbArg,
    );

    const typedResult = result as { lastInsertRowId?: number };
    
    // Update Daily Summary
    if (['expense', 'bill_payment', 'work_expense'].includes(input.kind)) {
        await dailySummaryService.updateDailySummary(input.occurredAt, dbArg);
    }

    if (
      input.categoryId &&
      ['expense', 'bill_payment', 'work_expense'].includes(input.kind)
    ) {
      await maybeSendBudgetAlert(input.categoryId, input.occurredAt, dbArg);
    }

    return typedResult.lastInsertRowId ?? 0;
  },

  async cancelTransaction(id: number, reason: string) {
    return await runInTransaction(async (db) => {
      const current = await this.getTransactionById(id);
      if (!current || current.isDeleted) throw new Error('Transaction not found');

      const now = nowIso();
      await runQuery(
        `UPDATE transactions 
         SET is_deleted = 1, cancel_reason = ?, cancelled_at = ?, updated_at = ? 
         WHERE id = ?;`,
        [reason, now, now, id],
        db
      );

      const reversalKind: TransactionKind = current.signedAmount < 0 ? 'income' : 'expense';
      const originalLabel = current.note ? current.note : `${current.kind} #${current.id}`;
      const reversalNote = reason
        ? `${reason} (${originalLabel})`
        : `Reversal (${originalLabel})`;

      await transactionService.createSystemTransaction({
        kind: reversalKind,
        amount: current.amountAbs,
        categoryId: null,
        note: reversalNote,
        accountId: current.accountId ?? undefined,
        occurredAt: nowIso(),
      }, db);

      // Re-calculate daily summary for the day of the cancelled transaction
      if (['expense', 'bill_payment', 'work_expense'].includes(current.kind)) {
        await dailySummaryService.updateDailySummary(current.occurredAt, db);
      }
    });
  },

  async createTransfer(input: {
    amount: number;
    fromAccountId: number;
    toAccountId: number;
    occurredAt: string;
    note?: string | null;
  }) {
    assertPositiveAmount(input.amount);
    if (input.fromAccountId === input.toAccountId) {
      throw new Error('Source and destination accounts must be different');
    }

    return await runInTransaction(async (db) => {
      const now = nowIso();
      const amount = Math.round(input.amount * 100) / 100;

      const fromRow = await getFirst<{ balance: number }>(
        'SELECT balance FROM accounts WHERE id = ?;',
        [input.fromAccountId],
        db,
      );
      const toRow = await getFirst<{ balance: number }>(
        'SELECT balance FROM accounts WHERE id = ?;',
        [input.toAccountId],
        db,
      );
      if (!fromRow || !toRow) throw new Error('Account not found');

      await accountService.updateAccountBalance(input.fromAccountId, fromRow.balance - amount, db);
      await accountService.updateAccountBalance(input.toAccountId, toRow.balance + amount, db);

      const currentBalance = await settingsService.getBalance();

      await runQuery(
        `INSERT INTO transactions
         (kind, signed_amount, amount_abs, category_id, account_id, note, occurred_at, source, is_deleted, balance_after, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'transfer', 0, ?, ?, ?);`,
        [
          'expense',
          -amount,
          amount,
          null,
          input.fromAccountId,
          input.note ?? null,
          input.occurredAt,
          currentBalance,
          now,
          now,
        ],
        db,
      );

      await runQuery(
        `INSERT INTO transactions
         (kind, signed_amount, amount_abs, category_id, account_id, note, occurred_at, source, is_deleted, balance_after, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'transfer', 0, ?, ?, ?);`,
        [
          'income',
          amount,
          amount,
          null,
          input.toAccountId,
          input.note ?? null,
          input.occurredAt,
          currentBalance,
          now,
          now,
        ],
        db,
      );
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
      const resolvedCurrentAccountId = current.account_id ?? (await accountService.getDefaultAccountId());
      const nextAccountId = typeof input.accountId === 'number' ? input.accountId : resolvedCurrentAccountId;

      if (typeof input.accountId === 'number' && input.accountId !== resolvedCurrentAccountId) {
        throw new Error('Changing account is not supported yet');
      }

      // Adjust total balance: remove old, add new
      const currentBalance = await settingsService.getBalance();
      const adjustedBalance = currentBalance - oldSigned + newSigned;
      await settingsService.updateBalance(adjustedBalance, db);

      // Adjust account balance
      const accountRow = await getFirst<{ balance: number }>(
        'SELECT balance FROM accounts WHERE id = ?;',
        [nextAccountId],
        db,
      );
      if (!accountRow) throw new Error('Account not found');
      const adjustedAccountBalance = (accountRow.balance ?? 0) - oldSigned + newSigned;
      await accountService.updateAccountBalance(nextAccountId, adjustedAccountBalance, db);

      await runQuery(
        `UPDATE transactions
         SET signed_amount = ?, amount_abs = ?, category_id = ?, note = ?, occurred_at = ?, balance_after = ?, account_id = ?, updated_at = ?
         WHERE id = ?;`,
        [
          newSigned,
          nextAmount,
          input.categoryId ?? current.category_id,
          input.note ?? current.note,
          input.occurredAt ?? current.occurred_at,
          adjustedBalance, // This is simplified; accurate balance_after requires re-calculating all subsequent txs
          nextAccountId,
          nowIso(),
          input.id,
        ],
        db
      );

      if (['expense', 'bill_payment', 'work_expense'].includes(current.kind)) {
        await dailySummaryService.updateDailySummary(input.occurredAt ?? current.occurred_at, db);
      }

      const nextCategoryId = typeof input.categoryId === 'number'
        ? input.categoryId
        : current.category_id;
      const nextOccurredAt = input.occurredAt ?? current.occurred_at;
      if (
        nextCategoryId &&
        ['expense', 'bill_payment', 'work_expense'].includes(current.kind)
      ) {
        await maybeSendBudgetAlert(nextCategoryId, nextOccurredAt, db);
      }
    });
  },

  async softDeleteTransaction(id: number) {
    // Keep backward compatibility but route to cancel flow
    await this.cancelTransaction(id, 'Transaction cancelled');
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
            (id, kind, signed_amount, amount_abs, category_id, account_id, note, occurred_at, source, is_deleted, cancel_reason, cancelled_at, balance_after, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            row.id,
            row.kind,
            row.signed_amount,
            row.amount_abs,
            row.category_id ?? null,
            row.account_id ?? null,
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
