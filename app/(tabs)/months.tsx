import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from 'react-native-paper';

import { EmptyState } from '@/src/components/common/EmptyState';
import { categoryService } from '@/src/services/categoryService';
import { reportService } from '@/src/services/reportService';
import { useSettingsStore } from '@/src/stores/settingsStore';
import type { Category, MonthlyReport } from '@/src/types/domain';
import { formatMoney } from '@/src/utils/money';
import { toMonthKey } from '@/src/utils/date';

export default function MonthsTab() {
  const { t } = useTranslation();
  const theme = useTheme();
  const params = useLocalSearchParams<{ month?: string }>();
  const settings = useSettingsStore((state) => state.settings);
  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [breakdownRows, setBreakdownRows] = useState<any[]>([]);

  const locale = settings?.locale ?? 'ar';
  const currency = settings?.currencyCode ?? 'EGP';

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const selected = reports.find((item) => item.monthKey === selectedMonth) ?? null;

  const loadData = useCallback(async () => {
    await reportService.archiveClosedMonths();
    const [monthlyReports, categoryRows] = await Promise.all([
      reportService.listMonthlyReports(),
      categoryService.listCategories(),
    ]);
    const currentKey = toMonthKey(new Date());
    const filteredReports = monthlyReports.filter((r) => r.monthKey !== currentKey);
    setReports(filteredReports);
    setCategories(categoryRows);
    if (filteredReports.length) {
      const requested = typeof params.month === 'string' ? params.month : null;
      const preferred = requested ?? selectedMonth;
      const matched = preferred && filteredReports.find((r) => r.monthKey === preferred);
      setSelectedMonth(matched ? matched.monthKey : filteredReports[0].monthKey);
    }
  }, [selectedMonth, params.month]);

  useFocusEffect(
    useCallback(() => {
      loadData().catch(() => {
        setReports([]);
      });
    }, [loadData]),
  );

  useFocusEffect(
    useCallback(() => {
      if (!selectedMonth) return;
      reportService
        .getReport(selectedMonth)
        .then((value) => setBreakdownRows(value?.breakdown ?? []))
        .catch(() => setBreakdownRows([]));
    }, [selectedMonth]),
  );

  const topExpense = selected?.topExpenseCategoryId
    ? categoryMap.get(selected.topExpenseCategoryId)
    : undefined;
  const topIncome = selected?.topIncomeCategoryId ? categoryMap.get(selected.topIncomeCategoryId) : undefined;

  const categoryName = (category: Category | undefined) => {
    if (!category) return '-';
    return locale === 'ar' ? category.nameAr : category.nameEn;
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: 16, paddingTop: 16 }}
    >
      {/* Month Picker */}
      <View style={{ borderRadius: 16, backgroundColor: theme.colors.surface, padding: 16 }}>
        <Text style={{ fontSize: 15, fontWeight: 'bold', color: theme.colors.onSurface }}>{t('months.title')}</Text>
        <View style={{ marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {reports.map((report) => (
            <Pressable
              key={report.monthKey}
              onPress={() => setSelectedMonth(report.monthKey)}
              style={{
                borderRadius: 100,
                paddingHorizontal: 12,
                paddingVertical: 8,
                backgroundColor: selectedMonth === report.monthKey ? theme.colors.primary : theme.colors.surfaceVariant,
              }}>
              <Text style={{ color: selectedMonth === report.monthKey ? theme.colors.onPrimary : theme.colors.onSurfaceVariant }}>
                {report.monthKey}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Monthly Report */}
      <View style={{ marginBottom: 48, marginTop: 16 }}>
        {!selected ? (
          <EmptyState title={t('common.noData')} />
        ) : (
          <View style={{ borderRadius: 16, backgroundColor: theme.colors.surface, padding: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.colors.onSurface }}>{selected.monthKey}</Text>
            <Text style={{ marginTop: 12, color: theme.colors.onSurfaceVariant }}>
              {t('months.incomeTotal')}: {formatMoney(selected.totalIncome, locale, currency)}
            </Text>
            <Text style={{ color: theme.colors.onSurfaceVariant }}>
              {t('months.expenseTotal')}: {formatMoney(selected.totalExpense, locale, currency)}
            </Text>
            {/* Net result: primary = positive, error = negative */}
            <Text style={{ color: selected.netResult >= 0 ? theme.colors.primary : theme.colors.error, fontWeight: '700' }}>
              {t('months.net')}: {formatMoney(selected.netResult, locale, currency, true)}
            </Text>
            <Text style={{ marginTop: 8, color: theme.colors.onSurfaceVariant }}>
              {t('months.topExpenseCategory')}: {categoryName(topExpense)}
            </Text>
            <Text style={{ color: theme.colors.onSurfaceVariant }}>
              {t('months.topIncomeCategory')}: {categoryName(topIncome)}
            </Text>
            <Text style={{ color: theme.colors.onSurfaceVariant }}>
              {t('months.highestSpendDay')}: {selected.highestSpendDay ?? '-'}
            </Text>
            <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: theme.colors.outlineVariant, paddingTop: 12 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: theme.colors.onSurface }}>
                {locale === 'ar' ? 'تفصيل المصروفات حسب الفئة' : 'Expense Breakdown by Category'}
              </Text>
              {breakdownRows.length === 0 ? (
                <Text style={{ marginTop: 6, color: theme.colors.onSurfaceVariant }}>
                  {locale === 'ar' ? 'لا يوجد تفصيل للفئات' : 'No breakdown data'}
                </Text>
              ) : (
                <View style={{ marginTop: 8, gap: 6 }}>
                  {breakdownRows.map((row) => (
                    <View
                      key={row.id}
                      style={{
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: theme.colors.outlineVariant,
                        paddingVertical: 8,
                        paddingHorizontal: 10,
                      }}>
                      <Text style={{ color: theme.colors.onSurface }}>
                        {locale === 'ar' ? row.name_ar : row.name_en}
                      </Text>
                      <Text style={{ color: theme.colors.onSurfaceVariant }}>
                        {formatMoney(row.total_amount ?? 0, locale, currency)} • {Number(row.percentage ?? 0).toFixed(1)}%
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
