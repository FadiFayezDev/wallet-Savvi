"use client";

import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useIsFocused } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  View,
} from "react-native";
import {
  Button,
  Chip,
  FAB,
  Icon,
  IconButton,
  List,
  Portal,
  ProgressBar,
  Surface,
  Text,
  useTheme,
} from "react-native-paper";
import type { MD3Theme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import InfiniteDayPicker from "@/src/components/FlatList/InfiniteDayPicker";
import { AnimatedBalanceText } from "@/src/components/common/AnimatedBalanceText";
import { accountService } from "@/src/services/accountService";
import { recurringBillService } from "@/src/services/recurringBillService";
import { transactionService } from "@/src/services/transactionService";
import { workService } from "@/src/services/workService";
import { useDashboardStore } from "@/src/stores/dashboardStore";
import { useSettingsStore } from "@/src/stores/settingsStore";
import type { Account, Transaction, WorkDayLog } from "@/src/types/domain";
import { withAlpha } from "@/src/utils/colors";
import { toMonthKey } from "@/src/utils/date";
import { formatMoney } from "@/src/utils/money";
import dayjs from "dayjs";

// ── هوك لـ staggered animation ─────────────────────────────────
function useStaggeredAnim(count: number, trigger: unknown) {
  const anims = useRef(
    Array.from({ length: count }, () => new Animated.Value(0)),
  ).current;
  useEffect(() => {
    anims.forEach((a) => a.setValue(0));
    const animations = anims.map((a, i) =>
      Animated.timing(a, {
        toValue: 1,
        duration: 380,
        delay: i * 70,
        useNativeDriver: true,
      }),
    );
    Animated.stagger(60, animations).start();
  }, [trigger]);
  return anims;
}

export default function DashboardScreen() {
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
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [dayLoading, setDayLoading] = useState(false);
  const [focusTick, setFocusTick] = useState(0);
  const [fabVisible, setFabVisible] = useState(true);

  const isFocused = useIsFocused();
  const router = useRouter();

  type ExtraColors = {
    success?: string;
    onSuccess?: string;
    successContainer?: string;
    onSuccessContainer?: string;
    warning?: string;
    onWarning?: string;
    warningContainer?: string;
    onWarningContainer?: string;
    info?: string;
    onInfo?: string;
    infoContainer?: string;
    onInfoContainer?: string;
    headerGradientStart?: string;
    headerGradientMid?: string;
    headerGradientEnd?: string;
    headerText?: string;
    headerIcon?: string;
    iconPrimary?: string;
    iconSecondary?: string;
    iconMuted?: string;
  };
  type AppTheme = MD3Theme & { colors: MD3Theme["colors"] & ExtraColors };
  const theme = useTheme<AppTheme>();
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const fabVisibleRef = useRef(true);

  // ── الثوابت ────────────────────────────────────────────────
  const HEADER_EXPANDED_H = 310;
  const HEADER_COLLAPSED_H = 140;
  const SCROLL_GAP_BELOW_HEADER = 20;
  /**
   * Past this offset → trigger collapse animation (state-based, NOT pixel-linked).
   * The animation is edge-triggered (fires once when crossing) not per-frame.
   */
  const HEADER_COLLAPSE_THRESHOLD = 50;
  /**
   * Expand only when scrolled back to the absolute top.
   * Small epsilon tolerates float / sub-pixel rounding.
   */
  const SCROLL_TOP_EPSILON = 1;

  /**
   * 0 = expanded, 1 = collapsed.
   * Driven by a one-shot Animated.timing, NOT tied to scroll pixels.
   * This is the fix: decoupling layout from scroll avoids the
   * "shrink header → contentSize changes → scroll event → expand header → loop" bug.
   */
  const headerCollapse = useRef(new Animated.Value(0)).current;

  /**
   * Ref (not state) so reads/writes inside onScroll are synchronous and
   * never cause a re-render.
   */
  const headerCollapsedRef = useRef(false);
  /**
   * Prevents a new animation from firing while one is already running.
   * Without this, rapid scrolling around the threshold would restart
   * the timing animation on every frame.
   */
  const headerTransitionLockRef = useRef(false);

  const settings = useSettingsStore((s) => s.settings);
  const summary = useDashboardStore((s) => s.summary);
  const refresh = useDashboardStore((s) => s.refresh);

  const locale = settings?.locale ?? "ar";
  const currency = settings?.currencyCode ?? "EGP";
  const isArabic = locale === "ar";

  const headerStart = theme.colors.headerGradientStart ?? theme.colors.primary;
  const headerMid = theme.colors.headerGradientMid ?? theme.colors.primary;
  const headerEnd = theme.colors.headerGradientEnd ?? theme.colors.secondary;
  const headerText = theme.colors.headerText ?? theme.colors.onPrimary;
  const headerIcon = theme.colors.headerIcon ?? theme.colors.onPrimary;
  const headerTextStrong = withAlpha(headerText, 0.8);
  const headerTextMuted = withAlpha(headerText, 0.55);
  const headerGlass = withAlpha(headerText, 0.08);
  const headerBorder = withAlpha(headerText, 0.12);

  const transactionKindMeta = useMemo(() => {
    const success = theme.colors.success ?? theme.colors.secondary;
    const warning = theme.colors.warning ?? theme.colors.tertiary;
    const info = theme.colors.info ?? theme.colors.primary;
    return {
      income: {
        icon: "arrow-down-circle",
        color: success,
        bg: withAlpha(success, 0.12),
      },
      expense: {
        icon: "arrow-up-circle",
        color: theme.colors.error,
        bg: withAlpha(theme.colors.error, 0.12),
      },
      bill_payment: {
        icon: "receipt-text-outline",
        color: warning,
        bg: withAlpha(warning, 0.12),
      },
      work_expense: {
        icon: "briefcase-outline",
        color: info,
        bg: withAlpha(info, 0.12),
      },
      goal_transfer: {
        icon: "flag-outline",
        color: theme.colors.secondary,
        bg: withAlpha(theme.colors.secondary, 0.12),
      },
      goal_refund: {
        icon: "flag-remove-outline",
        color: success,
        bg: withAlpha(success, 0.12),
      },
    } as const satisfies Record<
      string,
      { icon: string; color: string; bg: string }
    >;
  }, [theme.colors]);

  // ── Animated values ────────────────────────────────────────
  const headerAnim = useRef(new Animated.Value(0)).current;
  const balanceAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // staggered cards: breakdown, bills, worklog
  const cardAnims = useRef(
    Array.from({ length: 3 }, () => new Animated.Value(0)),
  ).current;

  // ── مشتقات الحسابات ────────────────────────────────────────
  const billsLabel = useMemo(() => {
    if (dayPaidBillTotal > 0)
      return isArabic ? "فواتير اليوم (استحقاق)" : "Bills (due today)";
    return isArabic ? "مدفوعات الفواتير اليوم" : "Bill payments today";
  }, [dayPaidBillTotal, isArabic]);

  const dayBreakdown = useMemo(() => {
    let income = 0,
      expense = 0,
      billPayments = 0,
      work = 0,
      goalTransfer = 0,
      goalRefund = 0;
    for (const item of dayTransactions) {
      if (item.source === "transfer") continue;
      switch (item.kind) {
        case "income":
          income += item.amountAbs;
          break;
        case "expense":
          expense += item.amountAbs;
          break;
        case "bill_payment":
          billPayments += item.amountAbs;
          break;
        case "work_expense":
          work += item.amountAbs;
          break;
        case "goal_transfer":
          goalTransfer += item.amountAbs;
          break;
        case "goal_refund":
          goalRefund += item.amountAbs;
          break;
      }
    }
    const bills = dayPaidBillTotal > 0 ? dayPaidBillTotal : billPayments;
    const outflow = expense + bills + work + goalTransfer;
    const inflow = income + goalRefund;
    return {
      income,
      expense,
      bills,
      billPayments,
      work,
      goalTransfer,
      goalRefund,
      inflow,
      outflow,
      net: inflow - outflow,
      spentForLimit: expense + bills + work,
    };
  }, [dayTransactions, dayPaidBillTotal]);

  const limitStatus = useMemo(() => {
    const dailyLimit = settings?.dailyLimit ?? null;
    if (!dailyLimit || dailyLimit <= 0)
      return {
        hasLimit: false,
        remaining: null,
        isOver: false,
        progress: 0,
        spent: 0,
        limit: 0,
        overBy: 0,
      };
    const spent = dayBreakdown.spentForLimit;
    const remaining = Math.max(0, dailyLimit - spent);
    const isOver = spent > dailyLimit;
    return {
      hasLimit: true,
      remaining,
      isOver,
      progress: Math.min(1, spent / dailyLimit),
      spent,
      limit: dailyLimit,
      overBy: Math.max(0, spent - dailyLimit),
    };
  }, [settings?.dailyLimit, dayBreakdown.spentForLimit]);

  // ── تحميل البيانات ─────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      refresh().catch(() => {});
    }, [refresh]),
  );

  const loadDayDetails = useCallback(async (date: Date) => {
    setDayLoading(true);
    try {
      const monthKey = toMonthKey(date);
      const dayKey = dayjs(date).format("YYYY-MM-DD");
      const [transactions, pendingBills, billInstances, paidBillRows, workLog] =
        await Promise.all([
          transactionService.listTransactionsByDay(dayKey, 200),
          recurringBillService.getPendingBills(monthKey),
          recurringBillService.listBillInstancesForDate(dayKey),
          recurringBillService.listPaidBillInstancesWithBillForDate(dayKey),
          workService.getWorkLogByDate(dayKey),
        ]);
      const dueBills = pendingBills.filter(
        (b) =>
          recurringBillService.getDueDateForMonth(monthKey, b.due_day) ===
          dayKey,
      );
      const paidTotal = paidBillRows.reduce(
        (sum: number, row: any) => sum + (row.bill_amount ?? 0),
        0,
      );
      setDayTransactions(transactions);
      setDayBillsDue(dueBills);
      setDayBillInstances(billInstances);
      setDayPaidBillTotal(paidTotal);
      setDayWorkLog(workLog);
    } catch {
      setDayTransactions([]);
      setDayBillsDue([]);
      setDayBillInstances([]);
      setDayPaidBillTotal(0);
      setDayWorkLog(null);
    } finally {
      setDayLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isFocused) return;
    loadDayDetails(selectedDate).catch(() => {});
  }, [isFocused, selectedDate, loadDayDetails]);

  useEffect(() => {
    if (!isFocused) return;
    accountService
      .listAccounts()
      .then((rows) => setAccounts(rows))
      .catch(() => setAccounts([]));
  }, [isFocused]);

  useEffect(() => {
    if (isFocused) setFocusTick((v) => v + 1);
  }, [isFocused]);

  // ── أنيميشن الهيدر عند mount ───────────────────────────────
  useEffect(() => {
    Animated.parallel([
      Animated.spring(headerAnim, {
        toValue: 1,
        tension: 60,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.timing(balanceAnim, {
        toValue: 1,
        duration: 600,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // ── أنيميشن الكروت عند تغيير اليوم ───────────────────────
  useEffect(() => {
    fadeAnim.setValue(0);
    cardAnims.forEach((a) => a.setValue(0));
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
    Animated.stagger(
      80,
      cardAnims.map((a) =>
        Animated.spring(a, {
          toValue: 1,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, [selectedDate]);

  // ── مساعد لـ card anim ─────────────────────────────────────
  const cardStyle = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [20, 0],
        }),
      },
    ],
  });

  // ── lastScrollY ref ────────────────────────────────────────
  const lastScrollYRef = useRef(0);

  // ── FAB visibility ─────────────────────────────────────────
  const onScrollFab = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      if (y > 120 && fabVisibleRef.current) {
        fabVisibleRef.current = false;
        setFabVisible(false);
      }
      if (y <= 40 && !fabVisibleRef.current) {
        fabVisibleRef.current = true;
        setFabVisible(true);
      }
    },
    [],
  );

  /**
   * ══════════════════════════════════════════════════════════
   * onScroll — الإصلاح الجوهري
   * ══════════════════════════════════════════════════════════
   *
   * المشكلة القديمة (الـ jitter loop):
   *   paddingTop متحرك مع headerCollapse
   *   → لما الهيدر يتصغر، الـ contentSize بيتغير
   *   → الـ ScrollView بيحسب scroll offset جديد
   *   → onScroll بيتفير بـ y مختلف
   *   → الهيدر بيعكس حالته
   *   → loop لا نهائي ∞
   *
   * الحل:
   *   ١. paddingTop في الـ ScrollView ثابت دايمًا = HEADER_EXPANDED_H + GAP
   *      (الـ ScrollView مش بيحس بأي تغيير في حجم الهيدر)
   *   ٢. الأنيميشن edge-triggered: بتشتغل مرة واحدة عند عبور الـ threshold
   *      مش per-frame
   *   ٣. lastScrollYRef بيتحدث أول حاجة قبل أي فحص
   *   ٤. headerTransitionLockRef يحمي الـ collapse كمان مش بس الـ expand
   *   ٥. return بعد الـ collapse يمنع تقييم الـ expand في نفس الفريم
   */
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const lastY = lastScrollYRef.current;

      // ① دايمًا حدّث الـ ref أولاً قبل أي منطق
      lastScrollYRef.current = y;

      // ② FAB visibility (مستقل عن الهيدر)
      onScrollFab(e);

      // ③ Collapse: edge-triggered عند عبور الـ threshold للأسفل
      //    الشرط: كنا تحت الـ threshold وعدينا فوقه، ومش متحول بالفعل، ومفيش lock
      if (
        y > HEADER_COLLAPSE_THRESHOLD &&
        lastY <= HEADER_COLLAPSE_THRESHOLD &&
        !headerCollapsedRef.current &&
        !headerTransitionLockRef.current
      ) {
        headerCollapsedRef.current = true;
        headerTransitionLockRef.current = true;
        Animated.timing(headerCollapse, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }).start(() => {
          headerTransitionLockRef.current = false;
        });
        return; // ← امنع تقييم الـ expand في نفس الفريم
      }

      // ④ Expand: فقط لما نرجع للأعلى تمامًا (y ≈ 0)
      //    الشرط: وصلنا الـ top، والهيدر متصغر حاليًا، ومفيش lock
      if (
        y <= SCROLL_TOP_EPSILON &&
        headerCollapsedRef.current &&
        !headerTransitionLockRef.current
      ) {
        headerCollapsedRef.current = false;
        headerTransitionLockRef.current = true;
        Animated.timing(headerCollapse, {
          toValue: 0,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }).start(() => {
          headerTransitionLockRef.current = false;
        });
      }
    },
    [headerCollapse, onScrollFab],
  );

  // ── Chips للـ breakdown ────────────────────────────────────
  const breakdownChips = [
    { label: billsLabel, value: dayBreakdown.bills },
    { label: isArabic ? "شغل" : "Work", value: dayBreakdown.work },
    {
      label: isArabic ? "تحويلات أهداف" : "Goal transfers",
      value: dayBreakdown.goalTransfer,
    },
    {
      label: isArabic ? "مرتجعات أهداف" : "Goal refunds",
      value: dayBreakdown.goalRefund,
    },
  ];

  // ── Header animated interpolations ────────────────────────
  const headerHeightAnim = headerCollapse.interpolate({
    inputRange: [0, 1],
    outputRange: [HEADER_EXPANDED_H, HEADER_COLLAPSED_H],
  });

  // ══════════════════════════════════════════════════════════
  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      {/*
       * ── ScrollView ──
       *
       * paddingTop ثابت = HEADER_EXPANDED_H + GAP
       * ده هو قلب الإصلاح: الـ ScrollView مش بيعرفش أن الهيدر اتغير حجمه.
       * لو خلينا الـ paddingTop يتحرك مع headerCollapse، الـ contentSize
       * هيتغير مع كل frame من الأنيميشن وهيعمل scroll event وهيحصل jitter.
       *
       * الهيدر overlay فوق الـ ScrollView بالـ position: absolute،
       * فالـ content بيبدأ من تحته بالـ paddingTop الثابت.
       *)
      */}
      <Animated.ScrollView
        style={styles.scrollFill}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: HEADER_EXPANDED_H + SCROLL_GAP_BELOW_HEADER,
          },
        ]}
        onScroll={onScroll}
        scrollEventThrottle={16}
        bounces
      >
        {/* ── Daily Breakdown Card ── */}
        <Animated.View style={cardStyle(cardAnims[0])}>
          <Surface
            elevation={0}
            style={[
              styles.card,
              styles.cardBorder,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.outlineVariant,
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <Text
                style={[styles.cardTitle, { color: theme.colors.onSurface }]}
              >
                {isArabic ? "تفاصيل اليوم" : "Daily Breakdown"}
              </Text>
              <Text
                style={[
                  styles.dateText,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
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
                    {
                      label: isArabic ? "الدخل" : "Income",
                      value: dayBreakdown.income,
                      color: theme.colors.success ?? theme.colors.secondary,
                    },
                    {
                      label: isArabic ? "المصروفات" : "Expenses",
                      value:
                        dayBreakdown.expense +
                        dayBreakdown.bills +
                        dayBreakdown.work,
                      color: theme.colors.error,
                    },
                    {
                      label: isArabic ? "الصافي" : "Net",
                      value: dayBreakdown.net,
                      color:
                        dayBreakdown.net >= 0
                          ? (theme.colors.success ?? theme.colors.secondary)
                          : theme.colors.error,
                      signed: true,
                    },
                  ].map((item, idx) => (
                    <View key={idx} style={styles.breakdownItem}>
                      <Text
                        style={[
                          styles.breakdownLabel,
                          { color: theme.colors.onSurfaceVariant },
                        ]}
                      >
                        {item.label}
                      </Text>
                      <Text
                        style={[styles.breakdownValue, { color: item.color }]}
                      >
                        {formatMoney(item.value, locale, currency, item.signed)}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Chips */}
                <View style={styles.chipsRow}>
                  {breakdownChips.map((chip, idx) => (
                    <Chip
                      key={idx}
                      mode="outlined"
                      style={[
                        styles.chip,
                        { borderColor: theme.colors.outlineVariant },
                      ]}
                      textStyle={[
                        styles.chipText,
                        { color: theme.colors.onSurfaceVariant },
                      ]}
                    >
                      {chip.label}: {formatMoney(chip.value, locale, currency)}
                    </Chip>
                  ))}
                </View>
              </>
            )}
          </Surface>
        </Animated.View>

        {/* ── Bills Card ── */}
        <Animated.View style={cardStyle(cardAnims[1])}>
          <Surface
            elevation={0}
            style={[
              styles.card,
              styles.cardBorder,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.outlineVariant,
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <Text
                style={[styles.cardTitle, { color: theme.colors.onSurface }]}
              >
                {isArabic ? "فواتير اليوم" : "Today Bills"}
              </Text>
              <Button
                mode="text"
                compact
                onPress={() => router.push("/bills")}
                textColor={theme.colors.primary}
                labelStyle={styles.linkText}
              >
                {isArabic ? "عرض الكل" : "View all"}
              </Button>
            </View>

            {dayBillsDue.length === 0 && dayBillInstances.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Icon
                  source="clipboard-text-outline"
                  size={32}
                  color={theme.colors.onSurfaceVariant}
                />
                <Text
                  variant="bodyMedium"
                  style={[
                    styles.emptyText,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {isArabic
                    ? "لا توجد فواتير لهذا اليوم"
                    : "No bills for this day"}
                </Text>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {[
                  ...dayBillsDue.map((b) => ({
                    key: `due-${b.id}`,
                    name: b.name,
                    sub: `${isArabic ? "مستحقة" : "Pending"} • ${formatMoney(b.amount, locale, currency)}`,
                    isPending: true,
                  })),
                  ...dayBillInstances.map((i) => ({
                    key: `inst-${i.id}`,
                    name: i.billName || (isArabic ? "فاتورة" : "Bill"),
                    sub: `${i.status} • ${i.dueDate}${i.billAmount != null ? ` • ${formatMoney(i.billAmount, locale, currency)}` : ""}`,
                    isPending: false,
                  })),
                ].map((item) => (
                  <List.Item
                    key={item.key}
                    title={item.name}
                    description={item.sub}
                    style={[
                      styles.listItem,
                      { borderColor: theme.colors.outlineVariant },
                    ]}
                    titleStyle={[
                      styles.listItemTitle,
                      { color: theme.colors.onSurface },
                    ]}
                    descriptionStyle={[
                      styles.listItemSub,
                      { color: theme.colors.onSurfaceVariant },
                    ]}
                    left={() => (
                      <View
                        style={[
                          styles.listItemIcon,
                          {
                            backgroundColor: item.isPending
                              ? withAlpha(
                                  theme.colors.warning ?? theme.colors.tertiary,
                                  0.12,
                                )
                              : withAlpha(
                                  theme.colors.info ?? theme.colors.primary,
                                  0.12,
                                ),
                          },
                        ]}
                      >
                        <IconButton
                          icon={
                            item.isPending
                              ? "clock-alert-outline"
                              : "check-circle-outline"
                          }
                          iconColor={
                            item.isPending
                              ? (theme.colors.warning ?? theme.colors.tertiary)
                              : (theme.colors.info ?? theme.colors.primary)
                          }
                          size={18}
                          style={styles.noMargin}
                        />
                      </View>
                    )}
                  />
                ))}
              </View>
            )}
          </Surface>
        </Animated.View>

        {/* ── Work Log Card ── */}
        <Animated.View style={cardStyle(cardAnims[2])}>
          <Surface
            elevation={0}
            style={[
              styles.card,
              styles.cardBorder,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.outlineVariant,
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <Text
                style={[styles.cardTitle, { color: theme.colors.onSurface }]}
              >
                {isArabic ? "سجل الشغل" : "Work Log"}
              </Text>
              <Button
                mode="text"
                compact
                onPress={() => router.push("/work")}
                textColor={theme.colors.primary}
                labelStyle={styles.linkText}
              >
                {isArabic ? "عرض الكل" : "View all"}
              </Button>
            </View>

            {!dayWorkLog ? (
              <View style={styles.emptyWrap}>
                <Icon
                  source="briefcase-outline"
                  size={32}
                  color={theme.colors.onSurfaceVariant}
                />
                <Text
                  variant="bodyMedium"
                  style={[
                    styles.emptyText,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {isArabic
                    ? "لا يوجد تسجيل لهذا اليوم"
                    : "No work log for this day"}
                </Text>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                <View style={styles.workRow}>
                  <Chip
                    icon="clock-outline"
                    mode="outlined"
                    selectedColor={theme.colors.info ?? theme.colors.primary}
                    style={[
                      styles.workChip,
                      {
                        backgroundColor: withAlpha(
                          theme.colors.info ?? theme.colors.primary,
                          0.1,
                        ),
                        borderColor: withAlpha(
                          theme.colors.info ?? theme.colors.primary,
                          0.2,
                        ),
                      },
                    ]}
                    textStyle={[
                      styles.workChipText,
                      { color: theme.colors.info ?? theme.colors.primary },
                    ]}
                  >
                    {dayWorkLog.shiftStart || "-"} –{" "}
                    {dayWorkLog.shiftEnd || "-"}
                  </Chip>
                  <Chip
                    icon="cash-minus"
                    mode="outlined"
                    selectedColor={theme.colors.error}
                    style={[
                      styles.workChip,
                      {
                        backgroundColor: withAlpha(theme.colors.error, 0.1),
                        borderColor: withAlpha(theme.colors.error, 0.2),
                      },
                    ]}
                    textStyle={[
                      styles.workChipText,
                      { color: theme.colors.error },
                    ]}
                  >
                    {formatMoney(
                      dayWorkLog.totalWorkExpenses,
                      locale,
                      currency,
                    )}
                  </Chip>
                </View>
                {dayWorkLog.note ? (
                  <Text
                    style={[
                      styles.workNote,
                      {
                        color: theme.colors.onSurfaceVariant,
                        borderColor: theme.colors.outlineVariant,
                      },
                    ]}
                  >
                    {dayWorkLog.note}
                  </Text>
                ) : null}
              </View>
            )}
          </Surface>
        </Animated.View>

        {/* ── Transactions ── */}
        <View>
          <Text
            style={[styles.sectionTitle, { color: theme.colors.onBackground }]}
          >
            {isArabic ? "عمليات اليوم" : "Today Transactions"}
          </Text>

          {dayTransactions.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Icon
                source="cash-remove"
                size={32}
                color={theme.colors.onSurfaceVariant}
              />
              <Text
                variant="bodyMedium"
                style={[
                  styles.emptyText,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {isArabic
                  ? "لا توجد معاملات اليوم"
                  : "No transactions for this day"}
              </Text>
            </View>
          ) : (
            dayTransactions.map((item: Transaction) => {
              const isTransfer = item.source === "transfer";
              const meta = isTransfer
                ? {
                    icon: "swap-horizontal",
                    color: theme.colors.info ?? theme.colors.primary,
                    bg: withAlpha(
                      theme.colors.info ?? theme.colors.primary,
                      0.12,
                    ),
                  }
                : (transactionKindMeta[
                    item.kind as keyof typeof transactionKindMeta
                  ] ?? transactionKindMeta.expense);
              const isIncome = item.signedAmount >= 0;
              const accountName = accounts.find(
                (acc) => acc.id === item.accountId,
              )?.name;
              const transferLabel = isIncome
                ? isArabic
                  ? "تحويل وارد"
                  : "Transfer in"
                : isArabic
                  ? "تحويل صادر"
                  : "Transfer out";
              const titleText =
                item.note || (isTransfer ? transferLabel : item.kind);
              const subtitleParts = [
                isTransfer
                  ? accountName
                    ? isIncome
                      ? isArabic
                        ? `إلى ${accountName}`
                        : `To ${accountName}`
                      : isArabic
                        ? `من ${accountName}`
                        : `From ${accountName}`
                    : null
                  : accountName,
                new Date(item.occurredAt).toLocaleDateString(locale),
              ].filter(Boolean);

              return (
                <Animated.View
                  key={item.id}
                  style={{
                    opacity: fadeAnim,
                    transform: [
                      {
                        translateX: fadeAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [isArabic ? 20 : -20, 0],
                        }),
                      },
                    ],
                  }}
                >
                  <Surface
                    elevation={0}
                    style={[
                      styles.txCard,
                      styles.cardBorder,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.outlineVariant,
                      },
                    ]}
                  >
                    <List.Item
                      onPress={() =>
                        router.push({
                          pathname: "/transactions/[id]",
                          params: { id: String(item.id) },
                        })
                      }
                      title={titleText}
                      description={
                        subtitleParts.length > 0
                          ? subtitleParts.join(" • ")
                          : undefined
                      }
                      titleNumberOfLines={1}
                      descriptionNumberOfLines={1}
                      style={styles.txItem}
                      titleStyle={[
                        styles.txTitle,
                        { color: theme.colors.onSurface },
                      ]}
                      descriptionStyle={[
                        styles.txDate,
                        { color: theme.colors.onSurfaceVariant },
                      ]}
                      left={() => (
                        <View
                          style={[styles.txIcon, { backgroundColor: meta.bg }]}
                        >
                          <IconButton
                            icon={meta.icon}
                            iconColor={meta.color}
                            size={20}
                            style={styles.noMargin}
                          />
                        </View>
                      )}
                      right={() => (
                        <Text
                          style={[
                            styles.txAmount,
                            {
                              color:
                                item.signedAmount >= 0
                                  ? (theme.colors.success ??
                                    theme.colors.secondary)
                                  : theme.colors.error,
                            },
                          ]}
                        >
                          {formatMoney(
                            item.signedAmount,
                            locale,
                            currency,
                            true,
                          )}
                        </Text>
                      )}
                    />
                  </Surface>
                </Animated.View>
              );
            })
          )}
        </View>
      </Animated.ScrollView>

      {/*
       * ── Header Overlay ──
       *
       * position: absolute فوق الـ ScrollView.
       * الهيدر مش جزء من الـ flex tree بتاع الـ ScrollView،
       * فتغيير حجمه مش بيأثر على الـ contentSize ومش بيعمل scroll events.
       *)
      */}
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.headerOverlay,
          {
            opacity: headerAnim,
            transform: [
              {
                translateY: headerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-30, 0],
                }),
              },
            ],
          },
        ]}
      >
        <Animated.View
          style={[
            styles.headerWrap,
            {
              height: headerHeightAnim,
              backgroundColor: headerStart,
            },
          ]}
        >
          <LinearGradient
            colors={[headerStart, headerMid, headerEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.header,
              { paddingTop: 12, flex: 1, shadowColor: headerStart },
            ]}
          >
            <View style={styles.headerBar}>
              <View style={styles.headerActions}>
                <IconButton
                  icon="menu"
                  iconColor={headerIcon}
                  size={20}
                  mode="contained-tonal"
                  containerColor={headerGlass}
                  style={styles.iconBtn}
                  onPress={() => {}}
                />
                <IconButton
                  icon="chart-box-outline"
                  iconColor={headerIcon}
                  size={20}
                  mode="contained-tonal"
                  containerColor={headerGlass}
                  style={styles.iconBtn}
                  onPress={() => router.push("/reports/current")}
                />
              </View>

              <Text style={[styles.balanceLabel, { color: headerTextMuted }]}>
                {isArabic ? "إجمالي الرصيد" : "Total Balance"}
              </Text>

              <View style={styles.headerActions}>
                <IconButton
                  icon="receipt-text-outline"
                  iconColor={headerIcon}
                  size={20}
                  mode="contained-tonal"
                  containerColor={headerGlass}
                  style={styles.iconBtn}
                  onPress={() => router.push("/bills")}
                />
                <IconButton
                  icon="briefcase-outline"
                  iconColor={headerIcon}
                  size={20}
                  mode="contained-tonal"
                  containerColor={headerGlass}
                  style={styles.iconBtn}
                  onPress={() => router.push("/work")}
                />
              </View>
            </View>

            <Animated.View
              style={{
                opacity: balanceAnim,
                transform: [
                  {
                    scale: balanceAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.85, 1],
                    }),
                  },
                ],
              }}
            >
              <AnimatedBalanceText
                value={summary?.balance ?? 0}
                locale={locale}
                currency={currency}
                resetKey={focusTick}
                textStyle={[
                  styles.balanceValue,
                  {
                    color: headerText,
                    textShadowColor: withAlpha(headerText, 0.35),
                  },
                ]}
              />
            </Animated.View>

            {/*
             * المحتوى اللي بيختفي عند الـ collapse (day picker + limit bar + summary cards).
             * opacity + translateY مرتبطين بـ headerCollapse بس مش بيأثروا على الـ layout
             * بتاع الـ ScrollView لأن الهيدر overlay.
             *)
            */}
            <Animated.View
              style={{
                opacity: headerCollapse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 0],
                }),
                transform: [
                  {
                    translateY: headerCollapse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -8],
                    }),
                  },
                ],
              }}
            >
              {limitStatus.hasLimit && (
                <View style={styles.limitWrap}>
                  <View style={styles.limitRow}>
                    <Text
                      style={[styles.limitText, { color: headerTextStrong }]}
                    >
                      {limitStatus.isOver
                        ? isArabic
                          ? `⚠ تجاوزت الحد بـ ${formatMoney(limitStatus.overBy, locale, currency)}`
                          : `⚠ Over limit by ${formatMoney(limitStatus.overBy, locale, currency)}`
                        : isArabic
                          ? `متبقي ${formatMoney(limitStatus.remaining ?? 0, locale, currency)}`
                          : `${formatMoney(limitStatus.remaining ?? 0, locale, currency)} left`}
                    </Text>
                    <Text
                      style={[styles.limitSubText, { color: headerTextMuted }]}
                    >
                      {formatMoney(limitStatus.spent, locale, currency)} /{" "}
                      {formatMoney(limitStatus.limit, locale, currency)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.limitTrack,
                      { backgroundColor: headerBorder },
                    ]}
                  >
                    <ProgressBar
                      progress={limitStatus.progress}
                      color={
                        limitStatus.isOver
                          ? theme.colors.error
                          : (theme.colors.success ?? theme.colors.secondary)
                      }
                      style={styles.limitProgress}
                    />
                  </View>
                </View>
              )}

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

              <View style={styles.summaryRow}>
                <View
                  style={[styles.summaryCard, { borderColor: headerBorder }]}
                >
                  <LinearGradient
                    colors={[
                      withAlpha(theme.colors.error, 0.15),
                      withAlpha(theme.colors.error, 0.05),
                    ]}
                    style={StyleSheet.absoluteFill}
                  />
                  <View
                    style={[
                      styles.summaryIcon,
                      { backgroundColor: withAlpha(theme.colors.error, 0.2) },
                    ]}
                  >
                    <IconButton
                      icon="trending-down"
                      iconColor={theme.colors.error}
                      size={18}
                      style={styles.noMargin}
                    />
                  </View>
                  <View>
                    <Text
                      style={[
                        styles.summaryCardLabel,
                        { color: headerTextMuted },
                      ]}
                    >
                      {isArabic ? "المصروفات" : "Expenses"}
                    </Text>
                    <Text
                      style={[
                        styles.summaryCardValue,
                        { color: theme.colors.error },
                      ]}
                      numberOfLines={1}
                    >
                      {formatMoney(
                        summary?.monthlyExpense ?? 0,
                        locale,
                        currency,
                      )}
                    </Text>
                  </View>
                </View>

                <View
                  style={[styles.summaryCard, { borderColor: headerBorder }]}
                >
                  <LinearGradient
                    colors={[
                      withAlpha(
                        theme.colors.success ?? theme.colors.secondary,
                        0.15,
                      ),
                      withAlpha(
                        theme.colors.success ?? theme.colors.secondary,
                        0.05,
                      ),
                    ]}
                    style={StyleSheet.absoluteFill}
                  />
                  <View
                    style={[
                      styles.summaryIcon,
                      {
                        backgroundColor: withAlpha(
                          theme.colors.success ?? theme.colors.secondary,
                          0.2,
                        ),
                      },
                    ]}
                  >
                    <IconButton
                      icon="trending-up"
                      iconColor={theme.colors.success ?? theme.colors.secondary}
                      size={18}
                      style={styles.noMargin}
                    />
                  </View>
                  <View>
                    <Text
                      style={[
                        styles.summaryCardLabel,
                        { color: headerTextMuted },
                      ]}
                    >
                      {isArabic ? "الدخل" : "Income"}
                    </Text>
                    <Text
                      style={[
                        styles.summaryCardValue,
                        {
                          color: theme.colors.success ?? theme.colors.secondary,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {formatMoney(
                        summary?.monthlyIncome ?? 0,
                        locale,
                        currency,
                      )}
                    </Text>
                  </View>
                </View>
              </View>
            </Animated.View>
          </LinearGradient>
        </Animated.View>
      </Animated.View>

      {/* ── FAB ── */}
      {isFocused && fabVisible && (
        <Portal>
          <FAB
            icon="plus"
            color={theme.colors.onPrimary}
            style={{
              position: "absolute",
              right: 16,
              bottom: tabBarHeight + Math.max(30, insets.bottom),
              backgroundColor: theme.colors.primary,
              borderRadius: 18,
              elevation: 6,
            }}
            onPress={() => router.push("/transactions/add")}
          />
        </Portal>
      )}
    </View>
  );
}

// ── StyleSheet ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollFill: { flex: 1 },
  headerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 4,
    elevation: 10,
  },

  // ── Header ──
  headerWrap: {
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    overflow: "hidden",
  },
  header: {
    paddingTop: 48,
    paddingBottom: 8,
    gap: 14,
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
    marginHorizontal: 2,
  },
  noMargin: { margin: 0 },

  balanceLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 2,
    textAlign: "center",
    flex: 1,
  },
  balanceValue: {
    fontSize: 36,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.5,
    paddingHorizontal: 16,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },

  // ── Limit bar ──
  limitWrap: { paddingHorizontal: 20, gap: 6 },
  limitRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  limitText: { fontSize: 12, fontWeight: "700" },
  limitSubText: { fontSize: 10, fontWeight: "600" },
  limitTrack: {
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
  },
  limitProgress: {
    height: 8,
    borderRadius: 999,
  },

  // ── Summary cards ──
  summaryRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  summaryCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  summaryIcon: { borderRadius: 10, overflow: "hidden" },
  summaryCardLabel: { fontSize: 11, fontWeight: "700" },
  summaryCardValue: { fontSize: 15, fontWeight: "900" },

  // ── Scroll ──
  scrollContent: {
    gap: 16,
    paddingHorizontal: 16,
    paddingBottom: 160,
    // paddingTop بيتحدد inline بقيمة ثابتة = HEADER_EXPANDED_H + SCROLL_GAP_BELOW_HEADER
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontSize: 10, fontWeight: "600" },

  // ── List items (bills) ──
  listItem: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  listItemIcon: { borderRadius: 12, overflow: "hidden" },
  listItemTitle: { fontSize: 13, fontWeight: "700" },
  listItemSub: { fontSize: 11, fontWeight: "600", marginTop: 1, opacity: 0.7 },

  // ── Work log ──
  workRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  workChip: {
    borderRadius: 999,
    borderWidth: 1,
  },
  workChipText: { fontSize: 12, fontWeight: "700" },
  workNote: {
    fontSize: 12,
    fontWeight: "600",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    lineHeight: 18,
  },

  // ── Transactions ──
  sectionTitle: {
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  txCard: { borderRadius: 20, marginBottom: 10, overflow: "hidden" },
  txItem: { paddingVertical: 6, paddingHorizontal: 8 },
  txIcon: { borderRadius: 14, overflow: "hidden" },
  txTitle: { fontSize: 14, fontWeight: "700" },
  txDate: { fontSize: 11, fontWeight: "600", marginTop: 2, opacity: 0.6 },
  txAmount: { fontSize: 15, fontWeight: "900" },

  // ── Empty states ──
  emptyWrap: { alignItems: "center", paddingVertical: 16, gap: 6 },
  emptyText: { fontWeight: "600" },
});