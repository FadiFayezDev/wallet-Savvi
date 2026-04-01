import { getAll, getFirst, runQuery, runInTransaction } from "@/src/db/client";
import type { Account, AccountGroupKey } from "@/src/types/domain";
import { DEFAULT_ACCOUNTS } from "@/src/constants/accountGroups";
import { settingsService } from "@/src/services/settingsService";
import { nowIso } from "@/src/utils/date";

interface AccountRow {
  id: number;
  name: string;
  group_key: AccountGroupKey;
  balance: number;
  description: string | null;
  is_default: number;
  is_hidden: number;
  created_at: string;
  updated_at: string;
}

const mapAccount = (row: AccountRow): Account => ({
  id: row.id,
  name: row.name,
  groupKey: row.group_key,
  balance: row.balance,
  description: row.description ?? null,
  isDefault: Boolean(row.is_default),
  isHidden: Boolean(row.is_hidden),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const accountService = {
  async listAccounts(): Promise<Account[]> {
    const rows = await getAll<AccountRow>(
      `SELECT * FROM accounts WHERE is_hidden = 0 ORDER BY created_at ASC;`,
    );
    return rows.map(mapAccount);
  },

  async getAccountById(id: number): Promise<Account | null> {
    const row = await getFirst<AccountRow>(`SELECT * FROM accounts WHERE id = ?;`, [id]);
    return row ? mapAccount(row) : null;
  },

  async getDefaultAccountId(): Promise<number> {
    const row = await getFirst<{ id: number }>(
      `SELECT id FROM accounts WHERE is_default = 1 LIMIT 1;`,
    );
    if (!row?.id) {
      const created = await this.seedDefaultsIfEmpty();
      if (created) {
        const fresh = await getFirst<{ id: number }>(
          `SELECT id FROM accounts WHERE is_default = 1 LIMIT 1;`,
        );
        if (fresh?.id) return fresh.id;
      }
      throw new Error("Default account not found");
    }
    return row.id;
  },

  async seedDefaultsIfEmpty() {
    const exists = await getFirst<{ id: number }>(`SELECT id FROM accounts LIMIT 1;`);
    if (exists?.id) return false;
    const now = nowIso();
    await runInTransaction(async (db) => {
      for (const account of DEFAULT_ACCOUNTS) {
        await runQuery(
          `INSERT INTO accounts (name, group_key, balance, description, is_default, is_hidden, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            account.name,
            account.groupKey,
            0,
            null,
            account.isDefault ? 1 : 0,
            0,
            now,
            now,
          ],
          db,
        );
      }
    });
    return true;
  },

  async createAccount(input: {
    name: string;
    groupKey: AccountGroupKey;
    balance?: number;
    description?: string | null;
  }) {
    const now = nowIso();
    return runQuery(
      `INSERT INTO accounts (name, group_key, balance, description, is_default, is_hidden, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, 0, ?, ?);`,
      [
        input.name,
        input.groupKey,
        input.balance ?? 0,
        input.description ?? null,
        now,
        now,
      ],
    );
  },

  async updateAccount(
    id: number,
    patch: Partial<{ name: string; groupKey: AccountGroupKey; balance: number; description: string | null; isHidden: boolean }>,
  ) {
    const current = await getFirst<AccountRow>(`SELECT * FROM accounts WHERE id = ?;`, [id]);
    if (!current) throw new Error("Account not found");
    const now = nowIso();
    return runQuery(
      `UPDATE accounts
       SET name = ?,
           group_key = ?,
           balance = ?,
           description = ?,
           is_hidden = ?,
           updated_at = ?
       WHERE id = ?;`,
      [
        patch.name ?? current.name,
        patch.groupKey ?? current.group_key,
        typeof patch.balance === "number" ? patch.balance : current.balance,
        patch.description ?? current.description,
        typeof patch.isHidden === "boolean" ? (patch.isHidden ? 1 : 0) : current.is_hidden,
        now,
        id,
      ],
    );
  },

  async updateAccountBalance(id: number, nextBalance: number, dbArg?: any) {
    return runQuery(
      `UPDATE accounts SET balance = ?, updated_at = ? WHERE id = ?;`,
      [nextBalance, nowIso(), id],
      dbArg,
    );
  },

  async syncTotalBalance(dbArg?: any) {
    const row = await getFirst<{ total: number }>(
      `SELECT COALESCE(SUM(balance), 0) AS total FROM accounts;`,
      [],
      dbArg,
    );
    const total = row?.total ?? 0;
    await settingsService.updateBalance(total, dbArg);
    return total;
  },

  async deleteAccount(id: number) {
    const row = await getFirst<{ is_default: number }>(
      `SELECT is_default FROM accounts WHERE id = ?;`,
      [id],
    );
    if (row?.is_default) {
      throw new Error("Default account cannot be deleted");
    }
    const used = await getFirst<{ count: number }>(
      `SELECT COUNT(*) as count FROM transactions WHERE account_id = ? AND is_deleted = 0;`,
      [id],
    );
    if ((used?.count ?? 0) > 0) {
      throw new Error("Account has transactions and cannot be deleted");
    }
    return runQuery(`DELETE FROM accounts WHERE id = ?;`, [id]);
  },

  async listNetChangesByMonth(monthKey: string): Promise<Record<number, number>> {
    const rows = await getAll<{ account_id: number; net: number }>(
      `SELECT account_id, COALESCE(SUM(signed_amount), 0) AS net
       FROM transactions
       WHERE is_deleted = 0
         AND account_id IS NOT NULL
         AND strftime('%Y-%m', occurred_at) = ?
       GROUP BY account_id;`,
      [monthKey],
    );
    return rows.reduce<Record<number, number>>((acc, row) => {
      acc[row.account_id] = row.net ?? 0;
      return acc;
    }, {});
  },
};
