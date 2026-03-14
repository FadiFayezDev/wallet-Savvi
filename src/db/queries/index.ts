import { transactionQueries } from './transactionQueries';
import { goalQueries } from './goalQueries';
import { reportQueries } from './reportQueries';
import { settingsQueries } from './settingsQueries';
import { recurringBillQueries } from './recurringBillQueries';
import { workQueries } from './workQueries';
import { dailySummaryQueries } from './dailySummaryQueries';

/**
 * مجمع الاستعلامات (Queries Provider)
 * يتم استخدامه داخل الـ Services للوصول المباشر لقاعدة البيانات
 */
export const queries = {
  transactions: transactionQueries,
  goals: goalQueries,
  reports: reportQueries,
  settings: settingsQueries,
  recurringBills: recurringBillQueries,
  work: workQueries,
  dailySummary: dailySummaryQueries,
};

// تصدير الأنواع إذا لزم الأمر مستقبلاً
export * from './transactionQueries';
export * from './goalQueries';
export * from './reportQueries';
export * from './settingsQueries';
export * from './recurringBillQueries';
export * from './workQueries';
export * from './dailySummaryQueries';