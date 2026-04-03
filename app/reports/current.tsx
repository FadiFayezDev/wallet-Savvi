import { useCallback, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { useFocusEffect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "react-native-paper";

import { EmptyState } from "@/src/components/common/EmptyState";
import { categoryService } from "@/src/services/categoryService";
import { reportService } from "@/src/services/reportService";
import { transactionService } from "@/src/services/transactionService";
import { useSettingsStore } from "@/src/stores/settingsStore";
import type { Category, Transaction } from "@/src/types/domain";
import { monthEndIso, monthStartIso, toMonthKey } from "@/src/utils/date";
import { withAlpha } from "@/src/utils/colors";
import { formatMoney } from "@/src/utils/money";

const weekRanges = [
  { label: "1-7", start: 1, end: 7 },
  { label: "8-14", start: 8, end: 14 },
  { label: "15-21", start: 15, end: 21 },
  { label: "22+", start: 22, end: 31 },
];

export default function CurrentMonthReport() {
  const router = useRouter();
  const theme = useTheme();
  const settings = useSettingsStore((state) => state.settings);
  const [report, setReport] = useState<any | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);

  const locale = settings?.locale ?? "ar";
  const currency = settings?.currencyCode ?? "EGP";
  const isAr = locale === "ar";
  const localeKey = (locale === "en" ? "en" : "ar") as "ar" | "en";
  const monthKey = toMonthKey(new Date());

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const grouped = useMemo(() => {
    return weekRanges.map((range) => {
      const items = transactions.filter((tx) => {
        const day = new Date(tx.occurredAt).getDate();
        return day >= range.start && day <= range.end;
      });
      const income = items
        .filter((tx) => tx.kind === "income")
        .reduce((sum, tx) => sum + tx.amountAbs, 0);
      const expense = items
        .filter((tx) => ["expense", "bill_payment", "work_expense"].includes(tx.kind))
        .reduce((sum, tx) => sum + tx.amountAbs, 0);
      return {
        label: range.label,
        items,
        income,
        expense,
        net: income - expense,
      };
    });
  }, [transactions]);

  const daysInMonth = useMemo(() => {
    const [y, m] = monthKey.split("-").map(Number);
    return new Date(y, m, 0).getDate();
  }, [monthKey]);

  const dailySeries = useMemo(() => {
    const days = Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      income: 0,
      expense: 0,
    }));
    for (const tx of transactions) {
      const d = new Date(tx.occurredAt);
      const day = d.getDate();
      if (!days[day - 1]) continue;
      if (tx.kind === "income") days[day - 1].income += tx.amountAbs;
      if (["expense", "bill_payment", "work_expense"].includes(tx.kind)) {
        days[day - 1].expense += tx.amountAbs;
      }
    }
    return days.map((d) => ({ ...d, net: d.income - d.expense }));
  }, [transactions, daysInMonth]);

  const expenseBreakdown = useMemo(() => {
    const totals = new Map<number, number>();
    let total = 0;
    for (const tx of transactions) {
      if (!["expense", "bill_payment", "work_expense"].includes(tx.kind)) continue;
      const key = tx.categoryId ?? 0;
      totals.set(key, (totals.get(key) ?? 0) + tx.amountAbs);
      total += tx.amountAbs;
    }
    const rows = Array.from(totals.entries())
      .map(([id, amount]) => {
        const cat = categoryMap.get(id);
        return {
          id,
          amount,
          label: cat ? (locale === "ar" ? cat.nameAr : cat.nameEn) : (isAr ? "بدون فئة" : "Uncategorized"),
          pct: total > 0 ? (amount / total) * 100 : 0,
        };
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
    return { total, rows };
  }, [transactions, categoryMap, locale, isAr]);

  const maxDailyAbs = useMemo(() => {
    return dailySeries.reduce((acc, d) => Math.max(acc, Math.abs(d.net)), 0) || 1;
  }, [dailySeries]);

  const maxWeekValue = useMemo(() => {
    return grouped.reduce((acc, w) => Math.max(acc, w.income, w.expense), 0) || 1;
  }, [grouped]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await reportService.archiveClosedMonths();
      const [rep, txs, cats] = await Promise.all([
        reportService.getCurrentMonthReportLive(monthKey),
        transactionService.listTransactions({
          dateFrom: monthStartIso(monthKey),
          dateTo: monthEndIso(monthKey),
          limit: 1000,
        }),
        categoryService.listCategories(),
      ]);
      setReport(rep);
      setTransactions(txs);
      setCategories(cats);
    } catch {
      setReport(null);
      setTransactions([]);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, [monthKey]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load]),
  );

  const topExpense = report?.topExpenseCategoryId
    ? categoryMap.get(report.topExpenseCategoryId)
    : null;
  const topIncome = report?.topIncomeCategoryId
    ? categoryMap.get(report.topIncomeCategoryId)
    : null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: 16, paddingTop: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <View style={{ gap: 16 }}>
        <LinearGradient
        colors={[
          theme.colors.headerGradientStart,
          theme.colors.headerGradientMid,
          theme.colors.headerGradientEnd,
        ]}
        style={styles.hero}
      >
        <View style={styles.heroRow}>
          <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: withAlpha(theme.colors.headerText, 0.12) }]}>
            <Text style={[styles.backText, { color: theme.colors.headerText }]}>{isAr ? "رجوع" : "Back"}</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.heroTitle, { color: theme.colors.headerText }]}>
              {isAr ? "تحليل الشهر الحالي" : "Current Month Analysis"}
            </Text>
            <Text style={[styles.heroSubtitle, { color: withAlpha(theme.colors.headerText, 0.65) }]}>
              {monthKey} • {isAr ? "تحديث مباشر" : "Live insight"}
            </Text>
          </View>
          <View style={[styles.livePill, { backgroundColor: withAlpha(theme.colors.success, 0.2) }]}>
            <Text style={[styles.liveText, { color: theme.colors.success }]}>{isAr ? "LIVE" : "LIVE"}</Text>
          </View>
        </View>

        <View style={styles.heroStats}>
          <View style={[styles.kpiCard, { backgroundColor: withAlpha(theme.colors.success, 0.18) }]}>
            <Text style={[styles.kpiLabel, { color: withAlpha(theme.colors.headerText, 0.7) }]}>{isAr ? "الدخل" : "Income"}</Text>
            <Text style={[styles.kpiValue, { color: theme.colors.headerText }]}>
              {formatMoney(report?.totalIncome ?? 0, localeKey, currency)}
            </Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: withAlpha(theme.colors.error, 0.18) }]}>
            <Text style={[styles.kpiLabel, { color: withAlpha(theme.colors.headerText, 0.7) }]}>{isAr ? "المصروف" : "Expense"}</Text>
            <Text style={[styles.kpiValue, { color: theme.colors.headerText }]}>
              {formatMoney(report?.totalExpense ?? 0, localeKey, currency)}
            </Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: withAlpha(theme.colors.info, 0.2) }]}>
            <Text style={[styles.kpiLabel, { color: withAlpha(theme.colors.headerText, 0.7) }]}>{isAr ? "الصافي" : "Net"}</Text>
            <Text style={[
              styles.kpiValue,
              { color: (report?.netResult ?? 0) >= 0 ? theme.colors.success : theme.colors.error },
            ]}>
              {formatMoney(report?.netResult ?? 0, localeKey, currency, true)}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
            {isAr ? "نبض الأيام" : "Daily Pulse"}
          </Text>
          <Text style={[styles.cardHint, { color: theme.colors.onSurfaceVariant }]}>
            {isAr ? "صافي اليوم" : "Net per day"}
          </Text>
        </View>
        {loading ? (
          <Text style={{ color: theme.colors.onSurfaceVariant }}>{isAr ? "تحميل..." : "Loading..."}</Text>
        ) : dailySeries.length === 0 ? (
          <EmptyState title={isAr ? "لا يوجد بيانات" : "No data"} />
        ) : (
          <View style={styles.sparkRow}>
            {dailySeries.map((d) => {
              const h = Math.max(3, Math.abs(d.net) / maxDailyAbs * 80);
              const color = d.net >= 0 ? theme.colors.success : theme.colors.error;
              return (
                <View key={d.day} style={styles.sparkItem}>
                  <View style={[styles.sparkBar, { height: h, backgroundColor: color }]} />
                </View>
              );
            })}
          </View>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
            {isAr ? "الأداء الأسبوعي" : "Weekly Performance"}
          </Text>
          <Text style={[styles.cardHint, { color: theme.colors.onSurfaceVariant }]}>
            {isAr ? "دخل مقابل مصروف" : "Income vs Expense"}
          </Text>
        </View>
        <View style={{ gap: 10 }}>
          {grouped.map((week) => (
            <View key={week.label} style={styles.weekRow}>
              <Text style={[styles.weekLabel, { color: theme.colors.onSurface }]}>
                {isAr ? `أسبوع ${week.label}` : `Week ${week.label}`}
              </Text>
              <View style={styles.weekBars}>
                <View style={[styles.weekTrack, { backgroundColor: theme.colors.surfaceVariant }]}>
                  <View style={[
                    styles.weekFill,
                    { width: `${Math.max(5, (week.income / maxWeekValue) * 100)}%`, backgroundColor: theme.colors.success },
                  ]} />
                </View>
                <View style={[styles.weekTrack, { backgroundColor: theme.colors.surfaceVariant }]}>
                  <View style={[
                    styles.weekFill,
                    { width: `${Math.max(5, (week.expense / maxWeekValue) * 100)}%`, backgroundColor: theme.colors.error },
                  ]} />
                </View>
              </View>
              <Text style={{ color: week.net >= 0 ? theme.colors.success : theme.colors.error, fontWeight: "700" }}>
                {formatMoney(week.net, localeKey, currency, true)}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
            {isAr ? "تركيز المصروفات" : "Expense Focus"}
          </Text>
          <Text style={[styles.cardHint, { color: theme.colors.onSurfaceVariant }]}>
            {formatMoney(expenseBreakdown.total, localeKey, currency)}
          </Text>
        </View>
        {expenseBreakdown.rows.length === 0 ? (
          <EmptyState title={isAr ? "لا يوجد مصروفات" : "No expenses"} />
        ) : (
          <View style={{ gap: 8 }}>
            {expenseBreakdown.rows.map((row) => (
              <View key={row.id} style={styles.expenseRow}>
                <Text style={[styles.expenseLabel, { color: theme.colors.onSurface }]} numberOfLines={1}>
                  {row.label}
                </Text>
                <Text style={[styles.expenseValue, { color: theme.colors.onSurfaceVariant }]}>
                  {formatMoney(row.amount, localeKey, currency)}
                </Text>
                <View style={[styles.expenseTrack, { backgroundColor: theme.colors.surfaceVariant }]}>
                  <View
                    style={[
                      styles.expenseFill,
                      { width: `${row.pct.toFixed(1)}%`, backgroundColor: theme.colors.info },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
        <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
          {isAr ? "مؤشرات ذكية" : "Smart Signals"}
        </Text>
        <View style={styles.signalGrid}>
          <View style={[styles.signalCard, { borderColor: theme.colors.outlineVariant }]}>
            <Text style={[styles.signalLabel, { color: theme.colors.onSurfaceVariant }]}>
              {isAr ? "أعلى فئة مصروف" : "Top expense"}
            </Text>
            <Text style={[styles.signalValue, { color: theme.colors.onSurface }]}>
              {topExpense ? (isAr ? topExpense.nameAr : topExpense.nameEn) : "-"}
            </Text>
          </View>
          <View style={[styles.signalCard, { borderColor: theme.colors.outlineVariant }]}>
            <Text style={[styles.signalLabel, { color: theme.colors.onSurfaceVariant }]}>
              {isAr ? "أعلى فئة دخل" : "Top income"}
            </Text>
            <Text style={[styles.signalValue, { color: theme.colors.onSurface }]}>
              {topIncome ? (isAr ? topIncome.nameAr : topIncome.nameEn) : "-"}
            </Text>
          </View>
          <View style={[styles.signalCard, { borderColor: theme.colors.outlineVariant }]}>
            <Text style={[styles.signalLabel, { color: theme.colors.onSurfaceVariant }]}>
              {isAr ? "أعلى يوم مصروف" : "Highest spend day"}
            </Text>
            <Text style={[styles.signalValue, { color: theme.colors.onSurface }]}>
              {report?.highestSpendDay ?? "-"}
            </Text>
          </View>
          <View style={[styles.signalCard, { borderColor: theme.colors.outlineVariant }]}>
            <Text style={[styles.signalLabel, { color: theme.colors.onSurfaceVariant }]}>
              {isAr ? "أيام عمل" : "Work days"}
            </Text>
            <Text style={[styles.signalValue, { color: theme.colors.onSurface }]}>
              {report?.workDaysCount ?? 0}
            </Text>
          </View>
          <View style={[styles.signalCard, { borderColor: theme.colors.outlineVariant }]}>
            <Text style={[styles.signalLabel, { color: theme.colors.onSurfaceVariant }]}>
              {isAr ? "تجاوز حد الصرف" : "Over limit"}
            </Text>
            <Text style={[styles.signalValue, { color: theme.colors.onSurface }]}>
              {report?.daysOverDailyLimit ?? 0}
            </Text>
          </View>
          <View style={[styles.signalCard, { borderColor: theme.colors.outlineVariant }]}>
            <Text style={[styles.signalLabel, { color: theme.colors.onSurfaceVariant }]}>
              {isAr ? "تحويش الأهداف" : "Goal saving"}
            </Text>
            <Text style={[styles.signalValue, { color: theme.colors.onSurface }]}>
              {formatMoney(report?.totalGoalSaving ?? 0, localeKey, currency)}
            </Text>
          </View>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
        <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
          {isAr ? "تفاصيل المعاملات" : "Transactions"}
        </Text>
        <Text style={[styles.cardHint, { color: theme.colors.onSurfaceVariant }]}>
          {isAr ? "مجمعة حسب أسابيع الشهر" : "Grouped by month weeks"}
        </Text>
        <View style={{ marginTop: 8, gap: 10 }}>
          {grouped.map((week) => (
            <View
              key={week.label}
              style={[styles.weekCard, { borderColor: theme.colors.outlineVariant }]}
            >
              <View style={styles.weekHeader}>
                <Text style={[styles.weekTitle, { color: theme.colors.onSurface }]}>
                  {isAr ? `أسبوع ${week.label}` : `Week ${week.label}`}
                </Text>
                <Text style={{ color: week.net >= 0 ? theme.colors.success : theme.colors.error, fontWeight: "800" }}>
                  {formatMoney(week.net, localeKey, currency, true)}
                </Text>
              </View>
              <Text style={{ color: theme.colors.onSurfaceVariant, marginBottom: 8 }}>
                {isAr ? "دخل" : "Income"}: {formatMoney(week.income, localeKey, currency)} •{" "}
                {isAr ? "مصروف" : "Expense"}: {formatMoney(week.expense, localeKey, currency)}
              </Text>
              {week.items.length === 0 ? (
                <Text style={{ color: theme.colors.onSurfaceVariant }}>
                  {isAr ? "لا توجد عمليات" : "No transactions"}
                </Text>
              ) : (
                <View style={{ gap: 8 }}>
                  {week.items.map((tx) => (
                    <View
                      key={`${week.label}-${tx.id}`}
                      style={[styles.txRow, { borderColor: theme.colors.outlineVariant }]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.colors.onSurface }} numberOfLines={1}>
                          {tx.note || tx.kind}
                        </Text>
                        <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 11 }}>
                          {new Date(tx.occurredAt).toLocaleDateString(locale)}
                        </Text>
                      </View>
                      <Text style={{ color: tx.signedAmount >= 0 ? theme.colors.success : theme.colors.error, fontWeight: "700" }}>
                        {formatMoney(tx.signedAmount, localeKey, currency, true)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
      </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 28, padding: 18 },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  heroTitle: { fontSize: 20, fontWeight: "900" },
  heroSubtitle: { fontSize: 12 },
  backBtn: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  backText: { fontWeight: "700", fontSize: 12 },
  livePill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  liveText: { fontWeight: "900", fontSize: 10 },

  heroStats: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  kpiCard: { flex: 1, minWidth: 110, borderRadius: 16, padding: 12, gap: 4 },
  kpiLabel: { fontSize: 11, fontWeight: "700" },
  kpiValue: { fontSize: 14, fontWeight: "900" },

  card: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 10 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { fontSize: 14, fontWeight: "900" },
  cardHint: { fontSize: 11, fontWeight: "600" },

  sparkRow: { flexDirection: "row", alignItems: "flex-end", gap: 2, height: 90, marginTop: 6 },
  sparkItem: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  sparkBar: { width: 4, borderRadius: 4 },

  weekRow: { gap: 6 },
  weekLabel: { fontSize: 12, fontWeight: "800" },
  weekBars: { gap: 6 },
  weekTrack: { height: 8, borderRadius: 999, overflow: "hidden" },
  weekFill: { height: "100%", borderRadius: 999 },

  expenseRow: { gap: 4 },
  expenseLabel: { fontSize: 12, fontWeight: "700" },
  expenseValue: { fontSize: 11, fontWeight: "600" },
  expenseTrack: { height: 6, borderRadius: 999, overflow: "hidden" },
  expenseFill: { height: "100%" },

  signalGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 6 },
  signalCard: { flexBasis: "48%", borderRadius: 12, borderWidth: 1, padding: 10, gap: 4 },
  signalLabel: { fontSize: 11, fontWeight: "700" },
  signalValue: { fontSize: 12, fontWeight: "800" },

  weekCard: { borderRadius: 14, borderWidth: 1, padding: 12 },
  weekHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  weekTitle: { fontSize: 12, fontWeight: "800" },
  txRow: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 10, borderWidth: 1, padding: 8 },
});
