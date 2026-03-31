import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { getAll, runInTransaction, runQuery } from '@/src/db/client';
import { settingsService } from '@/src/services/settingsService';
import type { BackupPayloadV1 } from '@/src/types/dto';

const BACKUP_VERSION = 1 as const;

const TABLES = [
  'palette_themes',
  'custom_themes',
  'bill_instances',
  'report_category_breakdown',
  'goal_transactions',
  'work_days_log',
  'daily_spending_summary',
  'daily_work_expenses',
  'work_schedule',
  'recurring_bills',
  'monthly_reports',
  'transactions',
  'goals',
  'categories',
  'app_settings',
] as const;

const validateBackupPayload = (value: unknown): value is BackupPayloadV1 => {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Partial<BackupPayloadV1>;
  if (payload.meta?.version !== BACKUP_VERSION) return false;
  if (!payload.data) return false;
  return (
    Array.isArray(payload.data.categories) &&
    Array.isArray(payload.data.transactions) &&
    Array.isArray(payload.data.goals) &&
    Array.isArray(payload.data.goal_transactions) &&
    Array.isArray(payload.data.monthly_reports) &&
    Array.isArray(payload.data.settings)
  );
};

export const backupService = {
  async exportBackup(): Promise<string> {
    const settings = await settingsService.getSettings();

    const categories = await getAll<Record<string, unknown>>('SELECT * FROM categories;');
    const transactions = await getAll<Record<string, unknown>>('SELECT * FROM transactions;');
    const goals = await getAll<Record<string, unknown>>('SELECT * FROM goals;');
    const goalTransactions = await getAll<Record<string, unknown>>('SELECT * FROM goal_transactions;');
    const monthlyReports = await getAll<Record<string, unknown>>('SELECT * FROM monthly_reports;');
    const reportBreakdown = await getAll<Record<string, unknown>>('SELECT * FROM report_category_breakdown;');
    const customThemes = await getAll<Record<string, unknown>>('SELECT * FROM custom_themes;');
    const paletteThemes = await getAll<Record<string, unknown>>('SELECT * FROM palette_themes;');
    const recurringBills = await getAll<Record<string, unknown>>('SELECT * FROM recurring_bills;');
    const billInstances = await getAll<Record<string, unknown>>('SELECT * FROM bill_instances;');
    const workSchedule = await getAll<Record<string, unknown>>('SELECT * FROM work_schedule;');
    const dailyWorkExpenses = await getAll<Record<string, unknown>>('SELECT * FROM daily_work_expenses;');
    const workDaysLog = await getAll<Record<string, unknown>>('SELECT * FROM work_days_log;');
    const dailySummary = await getAll<Record<string, unknown>>('SELECT * FROM daily_spending_summary;');
    const appSettings = await getAll<Record<string, unknown>>('SELECT * FROM app_settings;');

    const payload: BackupPayloadV1 = {
      meta: {
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        appVersion: Constants.expoConfig?.version ?? '1.0.0',
        currency: settings.currencyCode,
      },
      data: {
        categories,
        transactions,
        goals,
        goal_transactions: goalTransactions,
        monthly_reports: monthlyReports,
        report_category_breakdown: reportBreakdown,
        custom_themes: customThemes,
        palette_themes: paletteThemes,
        recurring_bills: recurringBills,
        bill_instances: billInstances,
        work_schedule: workSchedule,
        daily_work_expenses: dailyWorkExpenses,
        work_days_log: workDaysLog,
        daily_spending_summary: dailySummary,
        settings: appSettings,
      },
    };

    const dir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
    if (!dir) throw new Error('No writable directory found on this device');
    const fileUri = `${dir}Wallet-backup-${Date.now()}.json`;
    await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(payload), {
      encoding: FileSystem.EncodingType.UTF8,
    });
    await Sharing.shareAsync(fileUri);
    return fileUri;
  },

  async importBackupReplaceAll() {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled || result.assets.length === 0) return false;

    const raw = await FileSystem.readAsStringAsync(result.assets[0].uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    const parsed = JSON.parse(raw) as unknown;
    if (!validateBackupPayload(parsed)) {
      throw new Error('Invalid backup payload');
    }

    await runInTransaction(async (db) => {
      for (const table of TABLES) {
        await runQuery(`DELETE FROM ${table};`, [], db);
      }

      for (const row of parsed.data.categories) {
        await runQuery(
          `INSERT INTO categories
           (id, name_ar, name_en, type, icon, color, is_default, is_deleted, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            row.id,
            row.name_ar,
            row.name_en,
            row.type,
            row.icon ?? null,
            row.color ?? null,
            row.is_default ?? 0,
            row.is_deleted ?? 0,
            row.created_at,
            row.updated_at,
          ],
          db,
        );
      }

      for (const row of parsed.data.transactions) {
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

      for (const row of parsed.data.goals) {
        await runQuery(
          `INSERT INTO goals
           (id, name, target_amount, saved_amount, monthly_contribution, icon, deadline, note, status, created_at, updated_at, cancelled_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            row.id,
            row.name,
            row.target_amount,
            row.saved_amount,
            row.monthly_contribution ?? null,
            row.icon ?? null,
            row.deadline ?? null,
            row.note ?? null,
            row.status,
            row.created_at,
            row.updated_at,
            row.cancelled_at ?? null,
          ],
          db,
        );
      }

      for (const row of parsed.data.goal_transactions) {
        await runQuery(
          `INSERT INTO goal_transactions
           (id, goal_id, transaction_id, action, amount, created_at)
           VALUES (?, ?, ?, ?, ?, ?);`,
          [row.id, row.goal_id, row.transaction_id, row.action, row.amount, row.created_at],
          db,
        );
      }

      for (const row of parsed.data.monthly_reports) {
        await runQuery(
          `INSERT INTO monthly_reports
           (id, month_key, total_income, total_expense, net_result, top_expense_category_id, top_income_category_id, highest_spend_day, total_goal_saving, opening_balance, closing_balance, work_days_count, days_over_daily_limit, generated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            row.id,
            row.month_key,
            row.total_income,
            row.total_expense,
            row.net_result,
            row.top_expense_category_id ?? null,
            row.top_income_category_id ?? null,
            row.highest_spend_day ?? null,
            row.total_goal_saving,
            row.opening_balance ?? null,
            row.closing_balance ?? null,
            row.work_days_count ?? 0,
            row.days_over_daily_limit ?? 0,
            row.generated_at,
          ],
          db,
        );
      }

      if (parsed.data.report_category_breakdown) {
        for (const row of parsed.data.report_category_breakdown) {
          await runQuery(
            `INSERT INTO report_category_breakdown
             (id, report_id, category_id, total_amount, percentage)
             VALUES (?, ?, ?, ?, ?);`,
            [
              row.id,
              row.report_id,
              row.category_id,
              row.total_amount,
              row.percentage,
            ],
            db,
          );
        }
      }

      if (parsed.data.custom_themes) {
        for (const row of parsed.data.custom_themes) {
          await runQuery(
            `INSERT INTO custom_themes
             (id, name, primary_color, secondary_color, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?);`,
            [
              row.id,
              row.name,
              row.primary_color,
              row.secondary_color,
              row.created_at,
              row.updated_at,
            ],
            db,
          );
        }
      }

      if (parsed.data.palette_themes) {
        for (const row of parsed.data.palette_themes) {
          await runQuery(
            `INSERT INTO palette_themes
             (id, name,
              light_primary, light_on_primary, light_primary_container, light_on_primary_container,
              light_secondary, light_on_secondary, light_secondary_container, light_on_secondary_container,
              light_tertiary, light_on_tertiary, light_tertiary_container, light_on_tertiary_container,
              light_background, light_on_background, light_surface, light_on_surface,
              light_surface_variant, light_on_surface_variant, light_outline, light_outline_variant,
              light_error, light_on_error, light_error_container, light_on_error_container,
              light_success, light_on_success, light_success_container, light_on_success_container,
              light_warning, light_on_warning, light_warning_container, light_on_warning_container,
              light_info, light_on_info, light_info_container, light_on_info_container,
              light_header_gradient_start, light_header_gradient_mid, light_header_gradient_end,
              light_header_text, light_header_icon,
              light_icon_primary, light_icon_secondary, light_icon_muted,
              dark_primary, dark_on_primary, dark_primary_container, dark_on_primary_container,
              dark_secondary, dark_on_secondary, dark_secondary_container, dark_on_secondary_container,
              dark_tertiary, dark_on_tertiary, dark_tertiary_container, dark_on_tertiary_container,
              dark_background, dark_on_background, dark_surface, dark_on_surface,
              dark_surface_variant, dark_on_surface_variant, dark_outline, dark_outline_variant,
              dark_error, dark_on_error, dark_error_container, dark_on_error_container,
              dark_success, dark_on_success, dark_success_container, dark_on_success_container,
              dark_warning, dark_on_warning, dark_warning_container, dark_on_warning_container,
              dark_info, dark_on_info, dark_info_container, dark_on_info_container,
              dark_header_gradient_start, dark_header_gradient_mid, dark_header_gradient_end,
              dark_header_text, dark_header_icon,
              dark_icon_primary, dark_icon_secondary, dark_icon_muted,
              created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            [
              row.id, row.name,
              row.light_primary, row.light_on_primary, row.light_primary_container, row.light_on_primary_container,
              row.light_secondary, row.light_on_secondary, row.light_secondary_container, row.light_on_secondary_container,
              row.light_tertiary, row.light_on_tertiary, row.light_tertiary_container, row.light_on_tertiary_container,
              row.light_background, row.light_on_background, row.light_surface, row.light_on_surface,
              row.light_surface_variant, row.light_on_surface_variant, row.light_outline, row.light_outline_variant,
              row.light_error, row.light_on_error, row.light_error_container, row.light_on_error_container,
              row.light_success, row.light_on_success, row.light_success_container, row.light_on_success_container,
              row.light_warning, row.light_on_warning, row.light_warning_container, row.light_on_warning_container,
              row.light_info, row.light_on_info, row.light_info_container, row.light_on_info_container,
              row.light_header_gradient_start, row.light_header_gradient_mid, row.light_header_gradient_end,
              row.light_header_text, row.light_header_icon,
              row.light_icon_primary, row.light_icon_secondary, row.light_icon_muted,
              row.dark_primary, row.dark_on_primary, row.dark_primary_container, row.dark_on_primary_container,
              row.dark_secondary, row.dark_on_secondary, row.dark_secondary_container, row.dark_on_secondary_container,
              row.dark_tertiary, row.dark_on_tertiary, row.dark_tertiary_container, row.dark_on_tertiary_container,
              row.dark_background, row.dark_on_background, row.dark_surface, row.dark_on_surface,
              row.dark_surface_variant, row.dark_on_surface_variant, row.dark_outline, row.dark_outline_variant,
              row.dark_error, row.dark_on_error, row.dark_error_container, row.dark_on_error_container,
              row.dark_success, row.dark_on_success, row.dark_success_container, row.dark_on_success_container,
              row.dark_warning, row.dark_on_warning, row.dark_warning_container, row.dark_on_warning_container,
              row.dark_info, row.dark_on_info, row.dark_info_container, row.dark_on_info_container,
              row.dark_header_gradient_start, row.dark_header_gradient_mid, row.dark_header_gradient_end,
              row.dark_header_text, row.dark_header_icon,
              row.dark_icon_primary, row.dark_icon_secondary, row.dark_icon_muted,
              row.created_at, row.updated_at,
            ],
            db,
          );
        }
      }

      if (parsed.data.recurring_bills) {
        for (const row of parsed.data.recurring_bills) {
          await runQuery(
            `INSERT INTO recurring_bills
             (id, name, amount, category_id, due_day, is_active, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?);`,
            [
              row.id,
              row.name,
              row.amount,
              row.category_id ?? null,
              row.due_day,
              row.is_active ?? 1,
              row.created_at,
            ],
            db,
          );
        }
      }

      if (parsed.data.bill_instances) {
        for (const row of parsed.data.bill_instances) {
          await runQuery(
            `INSERT INTO bill_instances
             (id, bill_id, transaction_id, due_date, status, paid_at)
             VALUES (?, ?, ?, ?, ?, ?);`,
            [
              row.id,
              row.bill_id,
              row.transaction_id ?? null,
              row.due_date,
              row.status,
              row.paid_at ?? null,
            ],
            db,
          );
        }
      }

      if (parsed.data.work_schedule) {
        for (const row of parsed.data.work_schedule) {
          await runQuery(
            `INSERT INTO work_schedule
             (id, day_of_week, is_work_day, start_time, end_time, updated_at)
             VALUES (?, ?, ?, ?, ?, ?);`,
            [
              row.id,
              row.day_of_week,
              row.is_work_day ?? 0,
              row.start_time ?? null,
              row.end_time ?? null,
              row.updated_at,
            ],
            db,
          );
        }
      }

      if (parsed.data.daily_work_expenses) {
        for (const row of parsed.data.daily_work_expenses) {
          await runQuery(
            `INSERT INTO daily_work_expenses
             (id, name, default_amount, is_active)
             VALUES (?, ?, ?, ?);`,
            [row.id, row.name, row.default_amount ?? 0, row.is_active ?? 1],
            db,
          );
        }
      }

      if (parsed.data.work_days_log) {
        for (const row of parsed.data.work_days_log) {
          await runQuery(
            `INSERT INTO work_days_log
             (id, work_date, shift_start, shift_end, total_work_expenses, note, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?);`,
            [
              row.id,
              row.work_date,
              row.shift_start ?? null,
              row.shift_end ?? null,
              row.total_work_expenses ?? 0,
              row.note ?? null,
              row.created_at,
            ],
            db,
          );
        }
      }

      if (parsed.data.daily_spending_summary) {
        for (const row of parsed.data.daily_spending_summary) {
          await runQuery(
            `INSERT INTO daily_spending_summary
             (id, summary_date, total_spent, is_over_limit, remaining_from_limit)
             VALUES (?, ?, ?, ?, ?);`,
            [
              row.id,
              row.summary_date,
              row.total_spent ?? 0,
              row.is_over_limit ?? 0,
              row.remaining_from_limit ?? null,
            ],
            db,
          );
        }
      }

      for (const row of parsed.data.settings) {
        await runQuery(
          `INSERT INTO app_settings
           (id, currency_code, locale, lock_method, auto_lock_seconds, spending_alert_enabled, spending_alert_threshold_pct, notify_bills_enabled, notify_work_enabled, theme_mode, theme_source, active_theme_id, active_palette_theme_id, time_format, name, balance, daily_limit, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            row.id,
            row.currency_code,
            row.locale,
            row.lock_method,
            row.auto_lock_seconds,
            row.spending_alert_enabled,
            row.spending_alert_threshold_pct,
            row.notify_bills_enabled ?? 1,
            row.notify_work_enabled ?? 1,
            row.theme_mode,
            row.theme_source ?? 'material',
            row.active_theme_id ?? null,
            row.active_palette_theme_id ?? null,
            row.time_format ?? '24h',
            row.name ?? 'المستخدم',
            row.balance ?? 0,
            row.daily_limit ?? null,
            row.updated_at,
          ],
          db,
        );
      }
    });

    return true;
  },
};
