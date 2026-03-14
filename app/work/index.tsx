import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { useFocusEffect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { IconButton, useTheme } from "react-native-paper";

import { CalculatorField } from "@/src/components/common/CalculatorField";
import { DatePickerField } from "@/src/components/common/DatePickerField";
import { TimePickerField, formatTimeLabel } from "@/src/components/common/TimePickerField";
import { WORK_SKIP_NOTE, workService } from "@/src/services/workService";
import { useSettingsStore } from "@/src/stores/settingsStore";
import type { DailyWorkExpense, WorkSchedule, WorkDayLog } from "@/src/types/domain";
import { confirmAction } from "@/src/utils/confirm";
import { formatMoney } from "@/src/utils/money";

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayLabelsAr = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

type SectionKey = "today" | "schedule" | "expenses" | "logs";

const withAlpha = (color: string, alpha: number) => {
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
    if (full.length >= 6) {
      const r = parseInt(full.slice(0, 2), 16);
      const g = parseInt(full.slice(2, 4), 16);
      const b = parseInt(full.slice(4, 6), 16);
      return `rgba(${r},${g},${b},${alpha})`;
    }
  }
  if (color.startsWith("rgb(")) return color.replace("rgb(", "rgba(").replace(")", `,${alpha})`);
  if (color.startsWith("rgba(")) {
    return color.replace(/rgba\(([^,]+),([^,]+),([^,]+),[^\)]+\)/, `rgba($1,$2,$3,${alpha})`);
  }
  return color;
};

export default function WorkScreen() {
  const router = useRouter();
  const theme = useTheme();
  const settings = useSettingsStore((state) => state.settings);

  const [schedule, setSchedule] = useState<WorkSchedule[]>([]);
  const [expenses, setExpenses] = useState<DailyWorkExpense[]>([]);
  const [logs, setLogs] = useState<WorkDayLog[]>([]);
  const [todayLog, setTodayLog] = useState<WorkDayLog | null>(null);
  const [activeSection, setActiveSection] = useState<SectionKey>("today");
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());
  const [showCustom, setShowCustom] = useState(false);

  const [expenseName, setExpenseName] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");

  const [logDate, setLogDate] = useState<string | null>(() => new Date().toISOString().split("T")[0]);
  const [shiftStart, setShiftStart] = useState<string | null>(null);
  const [shiftEnd, setShiftEnd] = useState<string | null>(null);
  const [customExpense, setCustomExpense] = useState("");
  const [logNote, setLogNote] = useState("");

  const locale = settings?.locale ?? "ar";
  const currency = settings?.currencyCode ?? "EGP";
  const timeFormat = settings?.timeFormat ?? "24h";
  const isAr = locale === "ar";
  const localeKey = (locale === "en" ? "en" : "ar") as "ar" | "en";

  const today = useMemo(() => new Date(), []);
  const todayIso = today.toISOString();
  const todayKey = todayIso.split("T")[0];
  const todayDow = today.getDay();

  const load = useCallback(async () => {
    const [scheduleRows, expenseRows, logRows, todayLogRow] = await Promise.all([
      workService.listSchedule(),
      workService.listDailyExpenses(),
      workService.listWorkLogs(20),
      workService.getWorkLogByDate(todayIso),
    ]);
    setSchedule(scheduleRows);
    setExpenses(expenseRows);
    setLogs(logRows);
    setTodayLog(todayLogRow);
  }, [todayIso]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load]),
  );

  const todaySchedule = schedule.find((row) => row.dayOfWeek === todayDow);
  const selectedSchedule = schedule.find((row) => row.dayOfWeek === selectedDay);
  const isTodayWorkDay = Boolean(todaySchedule?.isWorkDay);

  const activeExpensesTotal = useMemo(
    () => expenses.filter((e) => e.isActive).reduce((sum, e) => sum + e.defaultAmount, 0),
    [expenses],
  );

  const todayStatus = useMemo(() => {
    if (!isTodayWorkDay) return { key: "off", label: isAr ? "إجازة" : "Off day", color: "#64748B" };
    if (!todayLog) return { key: "pending", label: isAr ? "معلّق" : "Pending", color: "#F59E0B" };
    if (todayLog.note === WORK_SKIP_NOTE) return { key: "skipped", label: isAr ? "تم الاستثناء" : "Skipped", color: "#94A3B8" };
    return { key: "logged", label: isAr ? "تم الخصم" : "Applied", color: "#22C55E" };
  }, [isTodayWorkDay, todayLog, isAr]);

  const dayName = (day: number) => (isAr ? dayLabelsAr[day] : dayLabels[day]);
  const formatTime = (value: string | null) => (value ? formatTimeLabel(value, timeFormat, locale) : "-");

  const toIsoDate = (value: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  };

  const onApplyStandardToday = async () => {
    if (!isTodayWorkDay) {
      Alert.alert(isAr ? "اليوم إجازة" : "Not a work day");
      return;
    }
    const result = await workService.logStandardWorkDay(todayIso);
    if (!result.success && result.status === "already_logged") {
      Alert.alert(isAr ? "اليوم مسجل بالفعل" : "Already logged today");
      return;
    }
    await load();
  };

  const onSkipToday = async () => {
    if (!isTodayWorkDay) return;
    Alert.alert(
      isAr ? "استثناء اليوم" : "Skip today",
      isAr ? "لن يتم خصم مصاريف العمل لهذا اليوم." : "No work expenses will be deducted today.",
      [
        { text: isAr ? "إلغاء" : "Cancel", style: "cancel" },
        {
          text: isAr ? "استثناء" : "Skip",
          style: "destructive",
          onPress: async () => {
            await workService.skipWorkDay(todayIso);
            await load();
          },
        },
      ],
    );
  };

  const onSaveSchedule = async () => {
    if (!selectedSchedule) return;
    await workService.updateSchedule(
      selectedSchedule.dayOfWeek,
      selectedSchedule.isWorkDay,
      selectedSchedule.startTime ?? undefined,
      selectedSchedule.endTime ?? undefined,
    );
    await load();
  };

  const onAddExpense = async () => {
    const parsed = Number(expenseAmount);
    if (!expenseName.trim() || !Number.isFinite(parsed) || parsed <= 0) {
      Alert.alert(isAr ? "بيانات غير صحيحة" : "Invalid data");
      return;
    }
    await workService.addDefaultExpense(expenseName.trim(), parsed);
    setExpenseName("");
    setExpenseAmount("");
    await load();
  };

  const onLogCustomDay = async () => {
    const iso = toIsoDate(logDate);
    const parsed = Number(customExpense);
    if (!iso || !Number.isFinite(parsed) || parsed <= 0) {
      Alert.alert(isAr ? "بيانات غير صحيحة" : "Invalid data");
      return;
    }
    try {
      await workService.logCustomWorkDay({
        date: iso.split("T")[0],
        shiftStart: shiftStart || undefined,
        shiftEnd: shiftEnd || undefined,
        expenseAmount: parsed,
        note: logNote || undefined,
      });
      setShiftStart(null);
      setShiftEnd(null);
      setCustomExpense("");
      setLogNote("");
      await load();
    } catch (err) {
      Alert.alert(isAr ? "اليوم مسجل بالفعل" : "Work day already logged");
    }
  };

  const sectionTabs: { key: SectionKey; label: string }[] = [
    { key: "today", label: isAr ? "اليوم" : "Today" },
    { key: "schedule", label: isAr ? "الجدول" : "Schedule" },
    { key: "expenses", label: isAr ? "المصاريف" : "Expenses" },
    { key: "logs", label: isAr ? "السجل" : "Logs" },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: 16, paddingTop: 16, paddingBottom: 40, gap: 16 }}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient colors={["#0b1220", "#0f1a2e", "#0b1220"]} style={styles.hero}>
        <View style={styles.heroTop}>
          <Pressable onPress={() => router.back()} style={styles.iconChip}>
            <IconButton icon={isAr ? "arrow-right" : "arrow-left"} iconColor="#E2E8F0" size={18} style={styles.noMargin} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>{isAr ? "الشغل والمصاريف" : "Work & Expenses"}</Text>
            <Text style={styles.heroSubtitle}>
              {isAr ? "تحكم ذكي في يومك — خصم مرن عند الحاجة" : "Smart control of your work day expenses"}
            </Text>
          </View>
        </View>

        <View style={styles.heroRow}>
          <View style={[styles.statusPill, { backgroundColor: withAlpha(todayStatus.color, 0.18) }]}>
            <Text style={[styles.statusText, { color: todayStatus.color }]}>
              {isAr ? "حالة اليوم:" : "Status:"} {todayStatus.label}
            </Text>
          </View>
          <View style={[styles.totalPill, { backgroundColor: withAlpha("#22C55E", 0.15) }]}>
            <Text style={styles.totalText}>
              {formatMoney(activeExpensesTotal, localeKey, currency)}
            </Text>
            <Text style={styles.totalSub}>{isAr ? "إجمالي مصاريف اليوم" : "Daily total"}</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={[styles.segmentWrap, { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.outlineVariant }]}>
        {sectionTabs.map((tab) => {
          const isActive = activeSection === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveSection(tab.key)}
              style={[
                styles.segmentBtn,
                isActive && { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant },
              ]}
            >
              <Text style={[styles.segmentText, { color: isActive ? theme.colors.onSurface : theme.colors.onSurfaceVariant }]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {activeSection === "today" && (
        <View style={{ gap: 12 }}>
          <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
                {isAr ? "إجراء سريع لليوم" : "Quick actions for today"}
              </Text>
              <Text style={[styles.cardHint, { color: theme.colors.onSurfaceVariant }]}>
                {todayKey}
              </Text>
            </View>

            <View style={styles.actionsRow}>
              <Pressable
                onPress={onApplyStandardToday}
                disabled={!isTodayWorkDay || Boolean(todayLog)}
                style={[
                  styles.actionBtn,
                  { backgroundColor: "#22C55E", opacity: !isTodayWorkDay || todayLog ? 0.6 : 1 },
                ]}
              >
                  <Text style={[styles.actionBtnText, { color: "#0B1220" }]}>
                    {isAr ? "خصم قياسي" : "Apply standard"}
                  </Text>
              </Pressable>
              <Pressable
                onPress={onSkipToday}
                disabled={!isTodayWorkDay || Boolean(todayLog)}
                style={[
                  styles.actionBtn,
                  { backgroundColor: "#334155", opacity: !isTodayWorkDay || todayLog ? 0.6 : 1 },
                ]}
              >
                  <Text style={[styles.actionBtnText, { color: "#F8FAFC" }]}>
                    {isAr ? "استثناء اليوم" : "Skip today"}
                  </Text>
              </Pressable>
            </View>

            <View style={styles.infoGrid}>
              <View style={[styles.infoTile, { borderColor: theme.colors.outlineVariant }]}>
                <Text style={[styles.infoLabel, { color: theme.colors.onSurfaceVariant }]}>
                  {isAr ? "وقت العمل" : "Shift time"}
                </Text>
                <Text style={[styles.infoValue, { color: theme.colors.onSurface }]}>
                  {formatTime(todaySchedule?.startTime ?? null)} - {formatTime(todaySchedule?.endTime ?? null)}
                </Text>
              </View>
              <View style={[styles.infoTile, { borderColor: theme.colors.outlineVariant }]}>
                <Text style={[styles.infoLabel, { color: theme.colors.onSurfaceVariant }]}>
                  {isAr ? "حالة الجدول" : "Schedule"}
                </Text>
                <Text style={[styles.infoValue, { color: theme.colors.onSurface }]}>
                  {isTodayWorkDay ? (isAr ? "يوم عمل" : "Work day") : (isAr ? "إجازة" : "Off day")}
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
            <Pressable onPress={() => setShowCustom((v) => !v)} style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
                {isAr ? "تسجيل يوم مخصص" : "Log custom day"}
              </Text>
              <Text style={[styles.cardHint, { color: theme.colors.onSurfaceVariant }]}>
                {showCustom ? (isAr ? "إخفاء" : "Hide") : (isAr ? "عرض" : "Show")}
              </Text>
            </Pressable>

            {showCustom && (
              <View style={{ gap: 10 }}>
                <DatePickerField
                  label={isAr ? "تاريخ اليوم" : "Work date"}
                  hint={isAr ? "مطلوب" : "Required"}
                  value={logDate}
                  onChange={(value) => setLogDate(value)}
                  required
                  locale={locale}
                />
                <View style={styles.infoGrid}>
                  <View style={{ flex: 1 }}>
                    <TimePickerField
                      label={isAr ? "بداية الوردية" : "Shift start"}
                      hint={isAr ? "اختياري" : "Optional"}
                      value={shiftStart}
                      onChange={(value) => setShiftStart(value)}
                      locale={locale}
                      timeFormat={timeFormat}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <TimePickerField
                      label={isAr ? "نهاية الوردية" : "Shift end"}
                      hint={isAr ? "اختياري" : "Optional"}
                      value={shiftEnd}
                      onChange={(value) => setShiftEnd(value)}
                      locale={locale}
                      timeFormat={timeFormat}
                    />
                  </View>
                </View>

                <CalculatorField
                  label={isAr ? "مصروف اليوم" : "Expense amount"}
                  hint={isAr ? "مطلوب" : "Required"}
                  value={customExpense}
                  onChange={setCustomExpense}
                  required
                  locale={locale}
                />

                <TextInput
                  value={logNote}
                  onChangeText={setLogNote}
                  placeholder={isAr ? "ملاحظة (اختياري)" : "Note (optional)"}
                  placeholderTextColor={theme.colors.onSurfaceVariant}
                  style={[
                    styles.noteInput,
                    { backgroundColor: theme.colors.surfaceVariant, color: theme.colors.onSurface },
                  ]}
                />

                <Pressable onPress={onLogCustomDay} style={[styles.actionBtn, { backgroundColor: "#0EA5E9" }]}>
                  <Text style={[styles.actionBtnText, { color: "#F8FAFC" }]}>
                    {isAr ? "تسجيل اليوم" : "Log day"}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      )}

      {activeSection === "schedule" && (
        <View style={{ gap: 12 }}>
          <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
            <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
              {isAr ? "اختيار اليوم" : "Pick a day"}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
              {Array.from({ length: 7 }, (_, i) => i).map((day) => {
                const isActive = selectedDay === day;
                const isWork = schedule.find((s) => s.dayOfWeek === day)?.isWorkDay;
                return (
                  <Pressable
                    key={day}
                    onPress={() => setSelectedDay(day)}
                    style={[
                      styles.dayChip,
                      {
                        backgroundColor: isActive ? "#0EA5E9" : theme.colors.surfaceVariant,
                        borderColor: isWork ? "#22C55E" : "transparent",
                      },
                    ]}
                  >
                    <Text style={[styles.dayChipText, { color: isActive ? "#fff" : theme.colors.onSurfaceVariant }]}>
                      {dayName(day)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
                {isAr ? "تفاصيل اليوم" : "Day details"}
              </Text>
              <Pressable
                onPress={async () => {
                  if (!selectedSchedule) return;
                  const goingWorkDay = !selectedSchedule.isWorkDay;
                  const ok = await confirmAction({
                    title: isAr
                      ? (goingWorkDay ? "تفعيل يوم عمل؟" : "إيقاف يوم عمل؟")
                      : (goingWorkDay ? "Enable work day?" : "Disable work day?"),
                    message: isAr
                      ? (goingWorkDay ? "سيتم تفعيل هذا اليوم كـ يوم عمل." : "سيتم اعتبار هذا اليوم إجازة.")
                      : (goingWorkDay ? "This day will be marked as a work day." : "This day will be treated as off."),
                    confirmText: isAr ? "تأكيد" : "Confirm",
                    cancelText: isAr ? "إلغاء" : "Cancel",
                  });
                  if (!ok) return;
                  setSchedule((prev) =>
                    prev.map((row) =>
                      row.dayOfWeek === selectedSchedule.dayOfWeek
                        ? { ...row, isWorkDay: !row.isWorkDay }
                        : row,
                    ),
                  );
                }}
                style={[
                  styles.togglePill,
                  { backgroundColor: selectedSchedule?.isWorkDay ? "#22C55E" : theme.colors.surfaceVariant },
                ]}
              >
                <Text style={styles.toggleText}>
                  {selectedSchedule?.isWorkDay ? (isAr ? "يوم عمل" : "Work day") : (isAr ? "إجازة" : "Off")}
                </Text>
              </Pressable>
            </View>

            <View style={styles.infoGrid}>
              <View style={{ flex: 1 }}>
                <TimePickerField
                  label={isAr ? "بداية الوردية" : "Start time"}
                  hint={isAr ? "اختياري" : "Optional"}
                  value={selectedSchedule?.startTime ?? null}
                  onChange={(value) =>
                    setSchedule((prev) =>
                      prev.map((row) =>
                        row.dayOfWeek === selectedDay ? { ...row, startTime: value } : row,
                      ),
                    )
                  }
                  locale={locale}
                  timeFormat={timeFormat}
                />
              </View>
              <View style={{ flex: 1 }}>
                <TimePickerField
                  label={isAr ? "نهاية الوردية" : "End time"}
                  hint={isAr ? "اختياري" : "Optional"}
                  value={selectedSchedule?.endTime ?? null}
                  onChange={(value) =>
                    setSchedule((prev) =>
                      prev.map((row) =>
                        row.dayOfWeek === selectedDay ? { ...row, endTime: value } : row,
                      ),
                    )
                  }
                  locale={locale}
                  timeFormat={timeFormat}
                />
              </View>
            </View>

            <Pressable onPress={onSaveSchedule} style={[styles.actionBtn, { backgroundColor: "#22C55E" }]}>
              <Text style={[styles.actionBtnText, { color: "#0B1220" }]}>
                {isAr ? "حفظ اليوم" : "Save day"}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {activeSection === "expenses" && (
        <View style={{ gap: 12 }}>
          <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
            <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
              {isAr ? "إضافة مصروف ثابت" : "Add daily expense"}
            </Text>
            <TextInput
              value={expenseName}
              onChangeText={setExpenseName}
              placeholder={isAr ? "اسم المصروف" : "Expense name"}
              placeholderTextColor={theme.colors.onSurfaceVariant}
              style={[
                styles.noteInput,
                { backgroundColor: theme.colors.surfaceVariant, color: theme.colors.onSurface },
              ]}
            />
            <CalculatorField
              label={isAr ? "المبلغ" : "Amount"}
              hint={isAr ? "مطلوب" : "Required"}
              value={expenseAmount}
              onChange={setExpenseAmount}
              required
              locale={locale}
            />
            <Pressable onPress={onAddExpense} style={[styles.actionBtn, { backgroundColor: "#0EA5E9" }]}>
              <Text style={[styles.actionBtnText, { color: "#F8FAFC" }]}>
                {isAr ? "إضافة" : "Add"}
              </Text>
            </Pressable>
          </View>

          <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
                {isAr ? "قائمة المصاريف" : "Expenses list"}
              </Text>
              <Text style={[styles.cardHint, { color: theme.colors.onSurfaceVariant }]}>
                {formatMoney(activeExpensesTotal, localeKey, currency)}
              </Text>
            </View>

            {expenses.length === 0 ? (
              <Text style={[styles.cardHint, { color: theme.colors.onSurfaceVariant }]}>
                {isAr ? "لا توجد مصاريف بعد" : "No expenses yet"}
              </Text>
            ) : (
              <View style={{ gap: 8 }}>
                {expenses.map((row) => (
                  <View key={row.id} style={[styles.expenseRow, { borderColor: theme.colors.outlineVariant }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.expenseName, { color: theme.colors.onSurface }]}>{row.name}</Text>
                      <Text style={[styles.expenseMeta, { color: theme.colors.onSurfaceVariant }]}>
                        {formatMoney(row.defaultAmount, locale as "ar" | "en", currency)}
                      </Text>
                    </View>
                    <Pressable
                      onPress={async () => {
                        const goingActive = !row.isActive;
                        const ok = await confirmAction({
                          title: isAr
                            ? (goingActive ? "تفعيل المصروف؟" : "إيقاف المصروف؟")
                            : (goingActive ? "Enable expense?" : "Disable expense?"),
                          message: isAr
                            ? (goingActive ? "سيتم احتساب هذا المصروف ضمن خصم اليوم." : "لن يتم احتساب هذا المصروف ضمن خصم اليوم.")
                            : (goingActive ? "This expense will be included in daily deduction." : "This expense will be excluded from daily deduction."),
                          confirmText: isAr ? "تأكيد" : "Confirm",
                          cancelText: isAr ? "إلغاء" : "Cancel",
                        });
                        if (!ok) return;
                        await workService.toggleExpenseActive(row.id, !row.isActive);
                        await load();
                      }}
                      style={[
                        styles.badge,
                        { backgroundColor: row.isActive ? "#22C55E" : theme.colors.surfaceVariant },
                      ]}
                    >
                      <Text style={[styles.badgeText, { color: row.isActive ? "#0B1220" : theme.colors.onSurfaceVariant }]}>
                        {row.isActive ? (isAr ? "نشط" : "Active") : (isAr ? "متوقف" : "Inactive")}
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      )}

      {activeSection === "logs" && (
        <View style={{ gap: 12 }}>
          <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
            <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
              {isAr ? "سجل أيام العمل" : "Work day history"}
            </Text>
            {logs.length === 0 ? (
              <Text style={[styles.cardHint, { color: theme.colors.onSurfaceVariant }]}>
                {isAr ? "لا يوجد سجلات" : "No logs yet"}
              </Text>
            ) : (
              <View style={{ gap: 8 }}>
                {logs.map((row) => (
                  <View key={row.id} style={[styles.logRow, { borderColor: theme.colors.outlineVariant }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.expenseName, { color: theme.colors.onSurface }]}>
                        {row.workDate}
                      </Text>
                      <Text style={[styles.expenseMeta, { color: theme.colors.onSurfaceVariant }]}>
                        {formatTime(row.shiftStart)} - {formatTime(row.shiftEnd)}
                      </Text>
                      {row.note && row.note !== WORK_SKIP_NOTE ? (
                        <Text style={[styles.expenseMeta, { color: theme.colors.onSurfaceVariant }]}>{row.note}</Text>
                      ) : null}
                    </View>
                    <View style={[styles.badge, { backgroundColor: row.note === WORK_SKIP_NOTE ? "#94A3B8" : "#22C55E" }]}>
                      <Text style={styles.badgeText}>
                        {row.note === WORK_SKIP_NOTE
                          ? (isAr ? "مستثنى" : "Skipped")
                          : formatMoney(row.totalWorkExpenses, localeKey, currency)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: 28,
    padding: 18,
    gap: 12,
  },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  heroTitle: { fontSize: 22, fontWeight: "900", color: "#F8FAFC" },
  heroSubtitle: { fontSize: 12, color: "rgba(248,250,252,0.65)", marginTop: 2 },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  iconChip: { borderRadius: 12, backgroundColor: "rgba(255,255,255,0.12)" },
  noMargin: { margin: 0 },

  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  statusText: { fontSize: 12, fontWeight: "700" },
  totalPill: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  totalText: { fontSize: 14, fontWeight: "900", color: "#E2E8F0" },
  totalSub: { fontSize: 10, color: "rgba(226,232,240,0.6)" },

  segmentWrap: {
    flexDirection: "row",
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
  },
  segmentBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  segmentText: { fontSize: 12, fontWeight: "800" },

  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { fontSize: 14, fontWeight: "900" },
  cardHint: { fontSize: 11, fontWeight: "600" },

  actionsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  actionBtn: {
    flex: 1,
    minWidth: 140,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  actionBtnText: { fontSize: 12, fontWeight: "800" },

  infoGrid: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  infoTile: {
    flex: 1,
    minWidth: 140,
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
    gap: 4,
  },
  infoLabel: { fontSize: 11, fontWeight: "700" },
  infoValue: { fontSize: 13, fontWeight: "800" },

  dayChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
  },
  dayChipText: { fontSize: 12, fontWeight: "800" },

  togglePill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  toggleText: { color: "#fff", fontWeight: "800", fontSize: 11 },

  noteInput: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 12 },

  expenseRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 10,
  },
  expenseName: { fontSize: 13, fontWeight: "800" },
  expenseMeta: { fontSize: 11, fontWeight: "600" },

  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: { fontSize: 11, fontWeight: "800", color: "#0B1220" },

  logRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 10,
  },
});
