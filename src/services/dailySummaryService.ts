import type { SQLiteDatabase } from 'expo-sqlite';
import { getAll, getFirst, runQuery } from '@/src/db/client';
import { settingsService } from './settingsService';

export const dailySummaryService = {
  /**
   * تحديث أو إنشاء ملخص الصرف ليوم محدد
   * يتم استدعاؤه تلقائياً عند إضافة/تعديل/حذف أي معاملة (expense)
   */
  async updateDailySummary(dateIso: string, dbArg?: SQLiteDatabase) {
    // 1. استخراج التاريخ فقط بدون الوقت (YYYY-MM-DD)
    const dateKey = dateIso.split('T')[0];

    // 2. حساب إجمالي المصاريف لهذا اليوم من جدول المعاملات
    // بنجمع كل أنواع المصاريف (التي تنقص الرصيد)
    const totalSpentRow = await getFirst<{ total: number }>(
      `SELECT ABS(SUM(signed_amount)) as total 
       FROM transactions 
       WHERE date(occurred_at) = date(?) 
       AND is_deleted = 0 
       AND kind IN ('expense', 'bill_payment', 'work_expense')
       AND source != 'transfer';`,
      [dateKey],
      dbArg
    );

    const totalSpent = totalSpentRow?.total || 0;

    // 3. جلب الحد اليومي من الإعدادات
    const settings = await settingsService.getSettings();
    const limit = settings.dailyLimit || 0;

    // 4. حساب الحالة (هل تخطى الحد؟ وما المتبقي؟)
    const isOverLimit = limit > 0 && totalSpent > limit;
    const remainingFromLimit = limit > 0 ? Math.max(0, limit - totalSpent) : null;

    // 5. تنفيذ الـ UPSERT (إضافة أو تحديث إذا كان موجوداً)
    await runQuery(
      `INSERT INTO daily_spending_summary (
        summary_date, 
        total_spent, 
        is_over_limit, 
        remaining_from_limit
      ) VALUES (?, ?, ?, ?)
      ON CONFLICT(summary_date) DO UPDATE SET
        total_spent = excluded.total_spent,
        is_over_limit = excluded.is_over_limit,
        remaining_from_limit = excluded.remaining_from_limit;`,
      [dateKey, totalSpent, isOverLimit ? 1 : 0, remainingFromLimit],
      dbArg
    );

    return {
      totalSpent,
      isOverLimit,
      remainingFromLimit
    };
  },

  /**
   * الحصول على ملخص يوم محدد
   */
  async getDailySummary(dateIso: string) {
    const dateKey = dateIso.split('T')[0];
    return await getFirst<any>(
      'SELECT * FROM daily_spending_summary WHERE summary_date = ?;',
      [dateKey]
    );
  },

  /**
   * إعادة حساب الملخص لكل الأيام (مفيد عند استيراد بيانات قديمة أو عمل Backup)
   */
  async recomputeAllSummaries(dbArg?: SQLiteDatabase) {
    const rows = await getAll<{ d: string }>(
      'SELECT DISTINCT date(occurred_at) as d FROM transactions WHERE is_deleted = 0;',
      [],
      dbArg
    );

    for (const row of rows) {
      await this.updateDailySummary(row.d, dbArg);
    }
  }
};
