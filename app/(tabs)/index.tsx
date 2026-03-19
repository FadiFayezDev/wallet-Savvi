"use client";

import { useIsFocused } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  Text,
  View,
  StyleSheet,
} from "react-native";
import { FAB, IconButton, Portal, Surface, useTheme } from "react-native-paper";

import InfiniteDayPicker from "@/src/components/FlatList/InfiniteDayPicker";
import { AnimatedBalanceText } from "@/src/components/common/AnimatedBalanceText";
import { recurringBillService } from "@/src/services/recurringBillService";
import { transactionService } from "@/src/services/transactionService";
import { workService } from "@/src/services/workService";
import { useDashboardStore } from "@/src/stores/dashboardStore";
import { useSettingsStore } from "@/src/stores/settingsStore";
import type { Transaction, WorkDayLog } from "@/src/types/domain";
import { toMonthKey } from "@/src/utils/date";
import { formatMoney } from "@/src/utils/money";
import dayjs from "dayjs";

// ── أيقونة + لون لكل نوع معاملة ──────────────────────────────
const TRANSACTION_KIND_META = {
  income:        { icon: "arrow-down-circle",    color: "#4ADE80", bg: "rgba(74,222,128,0.12)" },
  expense:       { icon: "arrow-up-circle",      color: "#F87171", bg: "rgba(248,113,113,0.12)" },
  bill_payment:  { icon: "receipt-text-outline", color: "#FB923C", bg: "rgba(251,146,60,0.12)" },
  work_expense:  { icon: "briefcase-outline",    color: "#60A5FA", bg: "rgba(96,165,250,0.12)" },
  goal_transfer: { icon: "flag-outline",         color: "#A78BFA", bg: "rgba(167,139,250,0.12)" },
  goal_refund:   { icon: "flag-remove-outline",  color: "#34D399", bg: "rgba(52,211,153,0.12)" },
} as const satisfies Record<string, { icon: string; color: string; bg: string }>;

// ── هوك لـ staggered animation ─────────────────────────────────
function useStaggeredAnim(count: number, trigger: unknown) {
  const anims = useRef(Array.from({ length: count }, () => new Animated.Value(0))).current;
  useEffect(() => {
    anims.forEach((a) => a.setValue(0));
    const animations = anims.map((a, i) =>
      Animated.timing(a, {
        toValue: 1,
        duration: 380,
        delay: i * 70,
        useNativeDriver: true,
      })
    );
    Animated.stagger(60, animations).start();
  }, [trigger]);
  return anims;
}

export default function DashboardScreen() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [dayTransactions, setDayTransactions] = useState<Transaction[]>([]);
  const [dayBillsDue, setDayBillsDue] = useState<any[]>([]);
  const [dayBillInstances, setDayBillInstances] = useState<any[]>([]);
  const [dayPaidBillTotal, setDayPaidBillTotal] = useState(0);
  const [dayWorkLog, setDayWorkLog] = useState<WorkDayLog | null>(null);
  const [dayLoading, setDayLoading] = useState(false);
  const [focusTick, setFocusTick] = useState(0);

  const isFocused = useIsFocused();
  const router    = useRouter();
  const theme     = useTheme();
  const headerHeight = useRef(new Animated.Value(310)).current;
  const detailsOpacity = useRef(new Animated.Value(1)).current;
  const detailsTranslate = useRef(new Animated.Value(0)).current;
  const isCollapsedRef = useRef(false);

  const settings      = useSettingsStore((s) => s.settings);
  const summary       = useDashboardStore((s) => s.summary);
  const refresh       = useDashboardStore((s) => s.refresh);

  const locale   = settings?.locale      ?? "ar";
  const currency = settings?.currencyCode ?? "EGP";
  const isArabic = locale === "ar";

  // ── Animated values ────────────────────────────────────────
  const headerAnim  = useRef(new Animated.Value(0)).current;
  const balanceAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim    = useRef(new Animated.Value(0)).current;
  const limitBarAnim = useRef(new Animated.Value(0)).current;

  // staggered cards: breakdown, bills, worklog
  const cardAnims = useRef(
    Array.from({ length: 3 }, () => new Animated.Value(0))
  ).current;

  // ── مشتقات الحسابات ────────────────────────────────────────
  const billsLabel = useMemo(() => {
    if (dayPaidBillTotal > 0)
      return isArabic ? "فواتير اليوم (استحقاق)" : "Bills (due today)";
    return isArabic ? "مدفوعات الفواتير اليوم" : "Bill payments today";
  }, [dayPaidBillTotal, isArabic]);

  const dayBreakdown = useMemo(() => {
    let income = 0, expense = 0, billPayments = 0,
        work = 0, goalTransfer = 0, goalRefund = 0;
    for (const item of dayTransactions) {
      switch (item.kind) {
        case "income":        income       += item.amountAbs; break;
        case "expense":       expense      += item.amountAbs; break;
        case "bill_payment":  billPayments += item.amountAbs; break;
        case "work_expense":  work         += item.amountAbs; break;
        case "goal_transfer": goalTransfer += item.amountAbs; break;
        case "goal_refund":   goalRefund   += item.amountAbs; break;
      }
    }
    const bills   = dayPaidBillTotal > 0 ? dayPaidBillTotal : billPayments;
    const outflow = expense + bills + work + goalTransfer;
    const inflow  = income + goalRefund;
    return {
      income, expense, bills, billPayments, work,
      goalTransfer, goalRefund, inflow, outflow,
      net: inflow - outflow,
      spentForLimit: expense + bills + work,
    };
  }, [dayTransactions, dayPaidBillTotal]);

  const limitStatus = useMemo(() => {
    const dailyLimit = settings?.dailyLimit ?? null;
    if (!dailyLimit || dailyLimit <= 0)
      return { hasLimit: false, remaining: null, isOver: false,
               progress: 0, spent: 0, limit: 0, overBy: 0 };
    const spent     = dayBreakdown.spentForLimit;
    const remaining = Math.max(0, dailyLimit - spent);
    const isOver    = spent > dailyLimit;
    return { hasLimit: true, remaining, isOver,
             progress: Math.min(1, spent / dailyLimit),
             spent, limit: dailyLimit,
             overBy: Math.max(0, spent - dailyLimit) };
  }, [settings?.dailyLimit, dayBreakdown.spentForLimit]);

  // ── تحميل البيانات ─────────────────────────────────────────
  useFocusEffect(useCallback(() => { refresh().catch(() => {}); }, [refresh]));

  const loadDayDetails = useCallback(async (date: Date) => {
    setDayLoading(true);
    try {
      const monthKey = toMonthKey(date);
      const dayKey   = dayjs(date).format("YYYY-MM-DD");
      const [transactions, pendingBills, billInstances, paidBillRows, workLog] =
        await Promise.all([
          transactionService.listTransactionsByDay(dayKey, 200),
          recurringBillService.getPendingBills(monthKey),
          recurringBillService.listBillInstancesForDate(dayKey),
          recurringBillService.listPaidBillInstancesWithBillForDate(dayKey),
          workService.getWorkLogByDate(dayKey),
        ]);
      const dueBills = pendingBills.filter(
        (b) => recurringBillService.getDueDateForMonth(monthKey, b.due_day) === dayKey,
      );
      const paidTotal = paidBillRows.reduce(
        (sum: number, row: any) => sum + (row.bill_amount ?? 0), 0,
      );
      setDayTransactions(transactions);
      setDayBillsDue(dueBills);
      setDayBillInstances(billInstances);
      setDayPaidBillTotal(paidTotal);
      setDayWorkLog(workLog);
    } catch {
      setDayTransactions([]); setDayBillsDue([]);
      setDayBillInstances([]); setDayPaidBillTotal(0); setDayWorkLog(null);
    } finally {
      setDayLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isFocused) return;
    loadDayDetails(selectedDate).catch(() => {});
  }, [isFocused, selectedDate, loadDayDetails]);

  useEffect(() => {
    if (isFocused) setFocusTick((v) => v + 1);
  }, [isFocused]);

  // ── أنيميشن ────────────────────────────────────────────────
  // أنيميشن الهيدر عند mount
  useEffect(() => {
    Animated.parallel([
      Animated.spring(headerAnim, { toValue: 1, tension: 60, friction: 10, useNativeDriver: true }),
      Animated.timing(balanceAnim, { toValue: 1, duration: 600, delay: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  // أنيميشن الكروت عند تغيير اليوم
  useEffect(() => {
    fadeAnim.setValue(0);
    cardAnims.forEach((a) => a.setValue(0));
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    Animated.stagger(
      80,
      cardAnims.map((a) =>
        Animated.spring(a, { toValue: 1, tension: 65, friction: 11, useNativeDriver: true })
      )
    ).start();
  }, [selectedDate]);

  // أنيميشن الـ limit bar
  useEffect(() => {
    if (!limitStatus.hasLimit) return;
    limitBarAnim.setValue(0);
    Animated.timing(limitBarAnim, {
      toValue: limitStatus.progress,
      duration: 900,
      delay: 400,
      useNativeDriver: false,  // نحتاج width
    }).start();
  }, [limitStatus.progress, limitStatus.hasLimit]);

  // ── مساعد لـ card anim ─────────────────────────────────────
  const cardStyle = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [{
      translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }),
    }],
  });

  const collapseHeader = useCallback(() => {
    Animated.parallel([
      Animated.spring(headerHeight, { toValue: 140, useNativeDriver: false, tension: 120, friction: 14 }),
      Animated.timing(detailsOpacity, { toValue: 0, duration: 180, useNativeDriver: false }),
      Animated.timing(detailsTranslate, { toValue: -12, duration: 180, useNativeDriver: false }),
    ]).start();
  }, [headerHeight, detailsOpacity, detailsTranslate]);

  const expandHeader = useCallback(() => {
    Animated.parallel([
      Animated.spring(headerHeight, { toValue: 310, useNativeDriver: false, tension: 110, friction: 12 }),
      Animated.timing(detailsOpacity, { toValue: 1, duration: 220, useNativeDriver: false }),
      Animated.timing(detailsTranslate, { toValue: 0, duration: 220, useNativeDriver: false }),
    ]).start();
  }, [headerHeight, detailsOpacity, detailsTranslate]);

  // ── Chips للـ breakdown ────────────────────────────────────
  const breakdownChips = [
    { label: billsLabel,                                     value: dayBreakdown.bills },
    { label: isArabic ? "شغل" : "Work",                     value: dayBreakdown.work },
    { label: isArabic ? "تحويلات أهداف" : "Goal transfers", value: dayBreakdown.goalTransfer },
    { label: isArabic ? "مرتجعات أهداف" : "Goal refunds",   value: dayBreakdown.goalRefund },
  ];

  // ══════════════════════════════════════════════════════════
  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>

      {/* ── HEADER ── */}
      <Animated.View style={{
        opacity: headerAnim,
        transform: [{ translateY: headerAnim.interpolate({ inputRange:[0,1], outputRange:[-30,0] }) }],
      }}>
        <Animated.View style={[styles.headerWrap, { height: headerHeight }]}>
          <LinearGradient
            colors={["#1a0533", "#2d1060", "#1e3a8a"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.header, { paddingTop: 12, flex: 1 }]}
          >
          {/* شريط التحكم */}
          <View style={styles.headerBar}>
            <View style={styles.headerActions}>
              <Pressable style={styles.iconBtn} onPress={() => {}}>
                <IconButton icon="menu" iconColor="rgba(255,255,255,0.8)" size={20} style={styles.noMargin} />
              </Pressable>
              <Pressable style={styles.iconBtn} onPress={() => router.push("/reports/current")}>
                <IconButton icon="chart-box-outline" iconColor="rgba(255,255,255,0.8)" size={20} style={styles.noMargin} />
              </Pressable>
            </View>

            <Text style={styles.balanceLabel}>
              {isArabic ? "إجمالي الرصيد" : "Total Balance"}
            </Text>

            <View style={styles.headerActions}>
              <Pressable style={styles.iconBtn} onPress={() => router.push("/bills")}>
                <IconButton icon="receipt-text-outline" iconColor="rgba(255,255,255,0.8)" size={20} style={styles.noMargin} />
              </Pressable>
              <Pressable style={styles.iconBtn} onPress={() => router.push("/work")}>
                <IconButton icon="briefcase-outline" iconColor="rgba(255,255,255,0.8)" size={20} style={styles.noMargin} />
              </Pressable>
            </View>
          </View>

          {/* الرصيد */}
          <Animated.View style={{
            opacity: balanceAnim,
            transform: [{ scale: balanceAnim.interpolate({ inputRange:[0,1], outputRange:[0.85,1] }) }],
          }}>
            <AnimatedBalanceText
              value={summary?.balance ?? 0}
              locale={locale}
              currency={currency}
              resetKey={focusTick}
              textStyle={styles.balanceValue}
            />
          </Animated.View>

          <Animated.View style={{ opacity: detailsOpacity, transform: [{ translateY: detailsTranslate }] }}>
            {/* Limit Bar */}
            {limitStatus.hasLimit && (
              <View style={styles.limitWrap}>
                <View style={styles.limitRow}>
                  <Text style={styles.limitText}>
                    {limitStatus.isOver
                      ? (isArabic
                          ? `⚠ تجاوزت الحد بـ ${formatMoney(limitStatus.overBy, locale, currency)}`
                          : `⚠ Over limit by ${formatMoney(limitStatus.overBy, locale, currency)}`)
                      : (isArabic
                          ? `متبقي ${formatMoney(limitStatus.remaining ?? 0, locale, currency)}`
                          : `${formatMoney(limitStatus.remaining ?? 0, locale, currency)} left`)}
                  </Text>
                  <Text style={styles.limitSubText}>
                    {formatMoney(limitStatus.spent, locale, currency)} / {formatMoney(limitStatus.limit, locale, currency)}
                  </Text>
                </View>
                <View style={styles.limitTrack}>
                  <Animated.View style={[styles.limitFill, {
                    width: limitBarAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0%", "100%"],
                    }),
                  }]}>
                    <LinearGradient
                      colors={limitStatus.isOver ? ["#F87171","#DC2626"] : ["#34D399","#059669"]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={StyleSheet.absoluteFill}
                    />
                  </Animated.View>
                </View>
              </View>
            )}

            {/* Day Picker */}
            <InfiniteDayPicker
              isArabic={isArabic}
              theme={theme}
              initialDate={selectedDate}
              onDayChange={(date) => {
                const d = new Date(date);
                d.setHours(0, 0, 0, 0);
                setSelectedDate(d);
              }}
            />

            {/* كروت الدخل / المصروفات */}
            <View style={styles.summaryRow}>
              {/* المصروفات */}
              <View style={styles.summaryCard}>
                <LinearGradient
                  colors={["rgba(248,113,113,0.15)", "rgba(248,113,113,0.05)"]}
                  style={StyleSheet.absoluteFill}
                />
                <View style={[styles.summaryIcon, { backgroundColor: "rgba(248,113,113,0.2)" }]}>
                  <IconButton icon="trending-down" iconColor="#F87171" size={18} style={styles.noMargin} />
                </View>
                <View>
                  <Text style={styles.summaryCardLabel}>
                    {isArabic ? "المصروفات" : "Expenses"}
                  </Text>
                  <Text style={[styles.summaryCardValue, { color: "#F87171" }]} numberOfLines={1}>
                    {formatMoney(summary?.monthlyExpense ?? 0, locale, currency)}
                  </Text>
                </View>
              </View>

              {/* الدخل */}
              <View style={styles.summaryCard}>
                <LinearGradient
                  colors={["rgba(74,222,128,0.15)", "rgba(74,222,128,0.05)"]}
                  style={StyleSheet.absoluteFill}
                />
                <View style={[styles.summaryIcon, { backgroundColor: "rgba(74,222,128,0.2)" }]}>
                  <IconButton icon="trending-up" iconColor="#4ADE80" size={18} style={styles.noMargin} />
                </View>
                <View>
                  <Text style={styles.summaryCardLabel}>
                    {isArabic ? "الدخل" : "Income"}
                  </Text>
                  <Text style={[styles.summaryCardValue, { color: "#4ADE80" }]} numberOfLines={1}>
                    {formatMoney(summary?.monthlyIncome ?? 0, locale, currency)}
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>
        </LinearGradient>
        </Animated.View>
      </Animated.View>

      {/* ── SCROLL CONTENT ── */}
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          if (y > 20 && !isCollapsedRef.current) {
            isCollapsedRef.current = true;
            collapseHeader();
          }
          if (y <= 0 && isCollapsedRef.current) {
            isCollapsedRef.current = false;
            expandHeader();
          }
        }}
        scrollEventThrottle={16}
      >

        {/* ── Daily Breakdown Card ── */}
        <Animated.View style={cardStyle(cardAnims[0])}>
          <Surface elevation={0} style={[styles.card, styles.cardBorder,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>

            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
                {isArabic ? "تفاصيل اليوم" : "Daily Breakdown"}
              </Text>
              <Text style={[styles.dateText, { color: theme.colors.onSurfaceVariant }]}>
                {selectedDate.toLocaleDateString(locale)}
              </Text>
            </View>

            {dayLoading ? (
              <Text style={{ color: theme.colors.onSurfaceVariant }}>
                {isArabic ? "جاري التحميل..." : "Loading..."}
              </Text>
            ) : (
              <>
                {/* الأرقام الكبيرة */}
                <View style={styles.breakdownRow}>
                  {[
                    { label: isArabic ? "الدخل" : "Income",   value: dayBreakdown.income,                                          color: theme.colors.primary },
                    { label: isArabic ? "المصروفات" : "Expenses", value: dayBreakdown.expense + dayBreakdown.bills + dayBreakdown.work, color: theme.colors.error },
                    { label: isArabic ? "الصافي" : "Net",      value: dayBreakdown.net,                                             color: dayBreakdown.net >= 0 ? "#4ADE80" : "#F87171", signed: true },
                  ].map((item, idx) => (
                    <View key={idx} style={styles.breakdownItem}>
                      <Text style={[styles.breakdownLabel, { color: theme.colors.onSurfaceVariant }]}>
                        {item.label}
                      </Text>
                      <Text style={[styles.breakdownValue, { color: item.color }]}>
                        {formatMoney(item.value, locale, currency, item.signed)}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Chips */}
                <View style={styles.chipsRow}>
                  {breakdownChips.map((chip, idx) => (
                    <View key={idx} style={[styles.chip, { borderColor: theme.colors.outlineVariant }]}>
                      <Text style={[styles.chipText, { color: theme.colors.onSurfaceVariant }]}>
                        {chip.label}: {formatMoney(chip.value, locale, currency)}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </Surface>
        </Animated.View>

        {/* ── Bills Card ── */}
        <Animated.View style={cardStyle(cardAnims[1])}>
          <Surface elevation={0} style={[styles.card, styles.cardBorder,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>

            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
                {isArabic ? "فواتير اليوم" : "Today Bills"}
              </Text>
              <Pressable onPress={() => router.push("/bills")}>
                <Text style={[styles.linkText, { color: theme.colors.primary }]}>
                  {isArabic ? "عرض الكل" : "View all"}
                </Text>
              </Pressable>
            </View>

            {dayBillsDue.length === 0 && dayBillInstances.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyIcon}>📋</Text>
                <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                  {isArabic ? "لا توجد فواتير لهذا اليوم" : "No bills for this day"}
                </Text>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {[...dayBillsDue.map(b => ({ key: `due-${b.id}`, name: b.name, sub: `${isArabic?"مستحقة":"Pending"} • ${formatMoney(b.amount,locale,currency)}`, isPending: true })),
                  ...dayBillInstances.map(i => ({ key: `inst-${i.id}`, name: i.billName||(isArabic?"فاتورة":"Bill"), sub: `${i.status} • ${i.dueDate}${i.billAmount!=null?` • ${formatMoney(i.billAmount,locale,currency)}`:""}`, isPending: false })),
                ].map((item) => (
                  <View key={item.key} style={[styles.listItem, { borderColor: theme.colors.outlineVariant }]}>
                    <View style={[styles.listItemIcon, {
                      backgroundColor: item.isPending ? "rgba(251,146,60,0.12)" : "rgba(96,165,250,0.12)"
                    }]}>
                      <IconButton
                        icon={item.isPending ? "clock-alert-outline" : "check-circle-outline"}
                        iconColor={item.isPending ? "#FB923C" : "#60A5FA"}
                        size={18} style={styles.noMargin}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.listItemTitle, { color: theme.colors.onSurface }]}>{item.name}</Text>
                      <Text style={[styles.listItemSub, { color: theme.colors.onSurfaceVariant }]}>{item.sub}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Surface>
        </Animated.View>

        {/* ── Work Log Card ── */}
        <Animated.View style={cardStyle(cardAnims[2])}>
          <Surface elevation={0} style={[styles.card, styles.cardBorder,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>

            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
                {isArabic ? "سجل الشغل" : "Work Log"}
              </Text>
              <Pressable onPress={() => router.push("/work")}>
                <Text style={[styles.linkText, { color: theme.colors.primary }]}>
                  {isArabic ? "عرض الكل" : "View all"}
                </Text>
              </Pressable>
            </View>

            {!dayWorkLog ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyIcon}>💼</Text>
                <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                  {isArabic ? "لا يوجد تسجيل لهذا اليوم" : "No work log for this day"}
                </Text>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                <View style={styles.workRow}>
                  <View style={[styles.workChip, { backgroundColor: "rgba(96,165,250,0.1)", borderColor: "rgba(96,165,250,0.2)" }]}>
                    <IconButton icon="clock-outline" iconColor="#60A5FA" size={14} style={styles.noMargin} />
                    <Text style={[styles.workChipText, { color: "#60A5FA" }]}>
                      {dayWorkLog.shiftStart || "-"} – {dayWorkLog.shiftEnd || "-"}
                    </Text>
                  </View>
                  <View style={[styles.workChip, { backgroundColor: "rgba(248,113,113,0.1)", borderColor: "rgba(248,113,113,0.2)" }]}>
                    <IconButton icon="cash-minus" iconColor="#F87171" size={14} style={styles.noMargin} />
                    <Text style={[styles.workChipText, { color: "#F87171" }]}>
                      {formatMoney(dayWorkLog.totalWorkExpenses, locale, currency)}
                    </Text>
                  </View>
                </View>
                {dayWorkLog.note ? (
                  <Text style={[styles.workNote, { color: theme.colors.onSurfaceVariant, borderColor: theme.colors.outlineVariant }]}>
                    {dayWorkLog.note}
                  </Text>
                ) : null}
              </View>
            )}
          </Surface>
        </Animated.View>

        {/* ── Transactions ── */}
        <View>
          <Text style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
            {isArabic ? "عمليات اليوم" : "Today Transactions"}
          </Text>

          {dayTransactions.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>💸</Text>
              <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                {isArabic ? "لا توجد معاملات اليوم" : "No transactions for this day"}
              </Text>
            </View>
          ) : (
            dayTransactions.map((item: Transaction, idx) => {
              const meta = TRANSACTION_KIND_META[item.kind as keyof typeof TRANSACTION_KIND_META] 
              ?? TRANSACTION_KIND_META.expense;

              const txAnim = new Animated.Value(0);
              return (
                <Animated.View key={item.id} style={{ opacity: fadeAnim, transform: [{
                  translateX: fadeAnim.interpolate({ inputRange:[0,1], outputRange: [isArabic ? 20 : -20, 0] }),
                }]}}>
                  <Surface elevation={0} style={[styles.txCard, styles.cardBorder,
                    { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
                    <Pressable
                      onPress={() => router.push({ pathname: "/transactions/[id]", params: { id: String(item.id) } })}
                      style={styles.txPressable}
                      android_ripple={{ color: "rgba(255,255,255,0.05)" }}
                    >
                      {/* أيقونة */}
                      <View style={[styles.txIcon, { backgroundColor: meta.bg }]}>
                        <IconButton icon={meta.icon} iconColor={meta.color} size={20} style={styles.noMargin} />
                      </View>
                      {/* نص */}
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.txTitle, { color: theme.colors.onSurface }]} numberOfLines={1}>
                          {item.note || item.kind}
                        </Text>
                        <Text style={[styles.txDate, { color: theme.colors.onSurfaceVariant }]}>
                          {new Date(item.occurredAt).toLocaleDateString(locale)}
                        </Text>
                      </View>
                      {/* المبلغ */}
                      <Text style={[styles.txAmount, { color: item.signedAmount >= 0 ? "#4ADE80" : "#F87171" }]}>
                        {formatMoney(item.signedAmount, locale, currency, true)}
                      </Text>
                    </Pressable>
                  </Surface>
                </Animated.View>
              );
            })
          )}
        </View>
      </Animated.ScrollView>

      {/* ── FAB ── */}
      {isFocused && (
        <Portal>
          <FAB.Group
            open={isOpen}
            visible={isFocused}
            icon={isOpen ? "close" : "plus"}
            color={theme.colors.onPrimary}
            actions={[
              {
                icon: "plus",
                label: isArabic ? "إضافة دخل" : "Income",
                onPress: () => router.push("/transactions/add-income"),
                color: "#4ADE80",
                labelTextColor: "white",
                style: { backgroundColor: "transparent", elevation: 0 },
                containerStyle: {
                  backgroundColor: "#1E293B", borderRadius: 20,
                  marginBottom: 8, paddingRight: 10,
                  borderWidth: 1, borderColor: "rgba(74,222,128,0.3)",
                },
              },
              {
                icon: "minus",
                label: isArabic ? "إضافة مصروف" : "Expense",
                onPress: () => router.push("/transactions/add-expense"),
                color: "#F87171",
                labelTextColor: "white",
                style: { backgroundColor: "transparent", elevation: 0 },
                containerStyle: {
                  backgroundColor: "#1E293B", borderRadius: 20,
                  marginBottom: 8, paddingRight: 10,
                  borderWidth: 1, borderColor: "rgba(248,113,113,0.3)",
                },
              },
            ]}
            onStateChange={({ open }) => setIsOpen(open)}
            style={{ paddingBottom: 90 }}
            fabStyle={{ backgroundColor: theme.colors.primary, borderRadius: 18, elevation: 6 }}
            backdropColor="rgba(0,0,0,0.8)"
          />
        </Portal>
      )}
    </View>
  );
}

// ── StyleSheet ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },

  // ── Header ──
  headerWrap: {
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    overflow: "hidden",
    backgroundColor: "#1a0533",
  },
  header: {
    paddingTop: 48,
    paddingBottom: 8,
    gap: 14,
    // تأثير shadow تحت الهيدر
    shadowColor: "#1a0533",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  headerActions: { flexDirection: "row", alignItems: "center" },
  iconBtn: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.08)",
    marginHorizontal: 2,
  },
  noMargin: { margin: 0 },

  balanceLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 2,
    textAlign: "center",
    flex: 1,
  },
  balanceValue: {
    color: "#fff",
    fontSize: 36,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.5,
    paddingHorizontal: 16,
    // text shadow خفيف
    textShadowColor: "rgba(99,102,241,0.5)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },

  // ── Limit bar ──
  limitWrap: { paddingHorizontal: 20, gap: 6 },
  limitRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  limitText:    { color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "700" },
  limitSubText: { color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: "600" },
  limitTrack: {
    height: 6, borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  limitFill: { height: "100%", borderRadius: 999, overflow: "hidden" },

  // ── Summary cards ──
  summaryRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  summaryCard: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
  },
  summaryIcon: { borderRadius: 10, overflow: "hidden" },
  summaryCardLabel: { color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "700" },
  summaryCardValue: { fontSize: 15, fontWeight: "900" },

  // ── Scroll ──
  scrollContent: {
    gap: 16, paddingHorizontal: 16, paddingBottom: 160, paddingTop: 20,
  },

  // ── Cards ──
  card: { borderRadius: 28, padding: 20 },
  cardBorder: { borderWidth: 1 },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  cardTitle: { fontSize: 16, fontWeight: "900" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  dateText: { fontSize: 11, fontWeight: "600" },
  linkText: { fontSize: 12, fontWeight: "700" },

  // ── Breakdown ──
  breakdownRow: { flexDirection: "row", gap: 16, marginBottom: 14 },
  breakdownItem: { flex: 1 },
  breakdownLabel: { fontSize: 11, fontWeight: "700", marginBottom: 2 },
  breakdownValue: { fontSize: 15, fontWeight: "900" },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999, borderWidth: 1,
  },
  chipText: { fontSize: 10, fontWeight: "600" },

  // ── List items (bills) ──
  listItem: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 10, borderRadius: 16, borderWidth: 1,
  },
  listItemIcon: { borderRadius: 12, overflow: "hidden" },
  listItemTitle: { fontSize: 13, fontWeight: "700" },
  listItemSub:   { fontSize: 11, fontWeight: "600", marginTop: 1, opacity: 0.7 },

  // ── Work log ──
  workRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  workChip: {
    flexDirection: "row", alignItems: "center", gap: 2,
    paddingRight: 10, borderRadius: 999, borderWidth: 1,
  },
  workChipText: { fontSize: 12, fontWeight: "700" },
  workNote: {
    fontSize: 12, fontWeight: "600",
    padding: 10, borderRadius: 12, borderWidth: 1,
    lineHeight: 18,
  },

  // ── Transactions ──
  sectionTitle: { fontSize: 20, fontWeight: "900", marginBottom: 12, paddingHorizontal: 4 },
  txCard: { borderRadius: 20, marginBottom: 10, overflow: "hidden" },
  txPressable: {
    flexDirection: "row", alignItems: "center",
    gap: 12, padding: 14,
  },
  txIcon: { borderRadius: 14, overflow: "hidden" },
  txTitle: { fontSize: 14, fontWeight: "700" },
  txDate:  { fontSize: 11, fontWeight: "600", marginTop: 2, opacity: 0.6 },
  txAmount:{ fontSize: 15, fontWeight: "900" },

  // ── Empty states ──
  emptyWrap: { alignItems: "center", paddingVertical: 16, gap: 6 },
  emptyIcon: { fontSize: 28 },
  emptyText: { fontSize: 13, fontWeight: "600" },
});
