import type { SQLiteDatabase } from 'expo-sqlite';
import { getFirst, runQuery } from '@/src/db/client';
import type { AppSettings, LockMethod, ThemeMode } from '@/src/types/domain';
import { nowIso } from '@/src/utils/date';

interface AppSettingsRow {
  name: string;                // New
  balance: number;             // New
  daily_limit: number | null;  // New
  currency_code: string;
  locale: 'ar' | 'en';
  lock_method: LockMethod;
  auto_lock_seconds: number;
  spending_alert_enabled: number;
  spending_alert_threshold_pct: number;
  theme_mode: ThemeMode;
  theme_source: 'material' | 'fixed';
  time_format: '12h' | '24h';
  updated_at: string;
}

const mapSettings = (row: AppSettingsRow): AppSettings => ({
  name: row.name,
  balance: row.balance,
  dailyLimit: row.daily_limit,
  currencyCode: row.currency_code,
  locale: row.locale,
  lockMethod: row.lock_method,
  autoLockSeconds: row.auto_lock_seconds,
  spendingAlertEnabled: Boolean(row.spending_alert_enabled),
  spendingAlertThresholdPct: row.spending_alert_threshold_pct,
  themeMode: row.theme_mode,
  themeSource: row.theme_source ?? 'material',
  timeFormat: row.time_format ?? '24h',
  updatedAt: row.updated_at,
});

export const settingsService = {
  async getSettings(): Promise<AppSettings> {
    const row = await getFirst<AppSettingsRow>('SELECT * FROM app_settings WHERE id = 1;');
    if (!row) {
      const now = nowIso();
      await runQuery(
        `INSERT INTO app_settings
         (id, name, balance, daily_limit, currency_code, locale, lock_method, auto_lock_seconds, spending_alert_enabled, spending_alert_threshold_pct, theme_mode, theme_source, time_format, updated_at)
         VALUES (1, 'المستخدم', 0, NULL, 'EGP', 'ar', 'none', 30, 1, 20, 'dark', 'material', '24h', ?);`,
        [now],
      );
      return {
        name: 'المستخدم',
        balance: 0,
        dailyLimit: null,
        currencyCode: 'EGP',
        locale: 'ar',
        lockMethod: 'none',
        autoLockSeconds: 30,
        spendingAlertEnabled: true,
        spendingAlertThresholdPct: 20,
        themeMode: 'dark',
        themeSource: 'material',
        timeFormat: '24h',
        updatedAt: now,
      };
    }
    return mapSettings(row);
  },

  async updateSettings(patch: Partial<AppSettings>) {
    const current = await settingsService.getSettings();
    const updated: AppSettings = {
      ...current,
      ...patch,
      updatedAt: nowIso(),
    };

    await runQuery(
      `UPDATE app_settings
       SET name = ?,
           balance = ?,
           daily_limit = ?,
           currency_code = ?,
           locale = ?,
           lock_method = ?,
           auto_lock_seconds = ?,
           spending_alert_enabled = ?,
           spending_alert_threshold_pct = ?,
           theme_mode = ?,
           theme_source = ?,
           time_format = ?,
           updated_at = ?
       WHERE id = 1;`,
      [
        updated.name,
        updated.balance,
        updated.dailyLimit,
        updated.currencyCode,
        updated.locale,
        updated.lockMethod,
        updated.autoLockSeconds,
        updated.spendingAlertEnabled ? 1 : 0,
        updated.spendingAlertThresholdPct,
        updated.themeMode,
        updated.themeSource,
        updated.timeFormat,
        updated.updatedAt,
      ],
    );

    return updated;
  },

  // New Helper Functions

  async getBalance(): Promise<number> {
    const row = await getFirst<{ balance: number }>('SELECT balance FROM app_settings WHERE id = 1;');
    return row?.balance ?? 0;
  },

  async updateBalance(newBalance: number, dbArg?: SQLiteDatabase) {
    return await runQuery(
      'UPDATE app_settings SET balance = ?, updated_at = ? WHERE id = 1;',
      [newBalance, nowIso()],
      dbArg
    );
  },

  async updateDailyLimit(limit: number | null) {
    return await runQuery(
      'UPDATE app_settings SET daily_limit = ?, updated_at = ? WHERE id = 1;',
      [limit, nowIso()]
    );
  }
};
