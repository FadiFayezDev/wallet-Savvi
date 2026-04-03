import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import dayjs from "dayjs";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Calendar } from "react-native-calendars";
import {
  IconButton,
  Modal,
  Portal,
  SegmentedButtons,
  useTheme,
} from "react-native-paper";

import { ComboSelect } from "@/src/components/forms/ComboSelect";
import { accountService } from "@/src/services/accountService";
import { categoryService } from "@/src/services/categoryService";
import { transactionService } from "@/src/services/transactionService";
import { useSettingsStore } from "@/src/stores/settingsStore";
import type { Account, Category, Transaction } from "@/src/types/domain";
import { withAlpha } from "@/src/utils/colors";
import { formatMoney } from "@/src/utils/money";

type AddTab = "income" | "expense" | "transfer";

export default function AddTransactionScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const settings = useSettingsStore((s) => s.settings);
  const locale = settings?.locale ?? "ar";
  const currency = settings?.currencyCode ?? "EGP";
  const timeFormat = settings?.timeFormat ?? "24h";
  const isArabic = locale === "ar";

  // ── States ──
  const [tab, setTab] = useState<AddTab>("income");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<number | null>(null);
  const [fromAccount, setFromAccount] = useState<number | null>(null);
  const [toAccount, setToAccount] = useState<number | null>(null);
  const [date, setDate] = useState<Date>(new Date());
  const [dateVisible, setDateVisible] = useState(false);

  // ── Effects & Callbacks (Logic Unchanged) ──
  useEffect(() => {
    if (
      params.tab === "income" ||
      params.tab === "expense" ||
      params.tab === "transfer"
    ) {
      setTab(params.tab as AddTab);
    }
  }, [params.tab]);

  const loadAccounts = useCallback(async () => {
    const rows = await accountService.listAccounts();
    setAccounts(rows);
    const defaultAccount = rows.find((row) => row.isDefault);
    const fallback = defaultAccount?.id ?? rows[0]?.id ?? null;
    setSelectedAccount((prev) => prev ?? fallback);
    setFromAccount((prev) => prev ?? fallback);
    if (rows.length > 1) {
      setToAccount(
        (prev) =>
          prev ??
          rows.find((row) => row.id !== fallback)?.id ??
          rows[1]?.id ??
          null
      );
    } else {
      setToAccount((prev) => prev ?? fallback);
    }
  }, []);

  const loadCategories = useCallback(async (kind: "income" | "expense") => {
    const rows = await categoryService.listCategories(kind);
    setCategories(rows);
    setSelectedCategory(rows[0]?.id ?? null);
  }, []);

  const loadRecent = useCallback(async () => {
    const rows = await transactionService.listTransactions({ limit: 10 });
    setRecentTransactions(rows);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (tab !== "transfer") {
        loadCategories(tab);
      }
    }, [tab, loadCategories])
  );

  useEffect(() => {
    loadAccounts().catch(() => setAccounts([]));
  }, [loadAccounts]);

  useEffect(() => {
    if (tab === "transfer") {
      setCategories([]);
      setSelectedCategory(null);
      return;
    }
    loadCategories(tab).catch(() => setCategories([]));
  }, [tab, loadCategories]);

  useEffect(() => {
    loadRecent().catch(() => setRecentTransactions([]));
  }, [loadRecent]);

  useEffect(() => {
    if (tab !== "transfer") return;
    if (!fromAccount || !toAccount) return;
    if (fromAccount === toAccount && accounts.length > 1) {
      const alt = accounts.find((acc) => acc.id !== fromAccount)?.id ?? null;
      if (alt) setToAccount(alt);
    }
  }, [tab, fromAccount, toAccount, accounts]);

  // ── Memos ──
  const dateLabel = useMemo(() => {
    const todayKey = dayjs().format("YYYY-MM-DD");
    const selectedKey = dayjs(date).format("YYYY-MM-DD");
    if (todayKey === selectedKey) return isArabic ? "اليوم" : "Today";
    return dayjs(date).format("MMM D, YYYY");
  }, [date, isArabic]);

  const accountOptions = useMemo(
    () => accounts.map((a) => ({ value: a.id, label: a.name })),
    [accounts]
  );

  const categoryOptions = useMemo(
    () =>
      categories.map((c) => ({
        value: c.id,
        label: locale === "ar" ? c.nameAr : c.nameEn,
      })),
    [categories, locale]
  );

  const categoryMap = useMemo(() => {
    const map = new Map<number, string>();
    categories.forEach((c) =>
      map.set(c.id, locale === "ar" ? c.nameAr : c.nameEn)
    );
    return map;
  }, [categories, locale]);

  const accountMap = useMemo(() => {
    const map = new Map<number, string>();
    accounts.forEach((a) => map.set(a.id, a.name));
    return map;
  }, [accounts]);

  const filteredRecent = useMemo(() => {
    if (tab === "transfer") {
      return recentTransactions.filter((tx) => tx.source === "transfer");
    }
    return recentTransactions.filter(
      (tx) => tx.kind === tab && tx.source !== "transfer"
    );
  }, [recentTransactions, tab]);

  // ── Handlers ──
  const handleSave = async () => {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      Alert.alert(isArabic ? "أدخل المبلغ" : "Enter amount");
      return;
    }
    try {
      if (tab === "transfer") {
        if (!fromAccount || !toAccount) {
          Alert.alert(isArabic ? "اختر الحسابات" : "Pick accounts");
          return;
        }
        await transactionService.createTransfer({
          amount: parsed,
          fromAccountId: fromAccount,
          toAccountId: toAccount,
          occurredAt: date.toISOString(),
          note: note.trim() ? note.trim() : null,
        });
      } else {
        if (!selectedCategory) {
          Alert.alert(isArabic ? "اختر الفئة" : "Pick category");
          return;
        }
        if (!selectedAccount) {
          Alert.alert(isArabic ? "اختر الحساب" : "Pick account");
          return;
        }
        await transactionService.createTransaction({
          kind: tab,
          amount: parsed,
          categoryId: selectedCategory,
          accountId: selectedAccount,
          note: note.trim() ? note.trim() : null,
          occurredAt: date.toISOString(),
        });
      }
      setAmount("");
      setNote("");
      await loadRecent();
      router.back();
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed");
    }
  };

  const timePattern = timeFormat === "24h" ? "HH:mm" : "hh:mm A";
  const infoColor = (theme.colors as any).info ?? theme.colors.primary;
  const successColor = (theme.colors as any).success ?? theme.colors.secondary;

  // ── RowField (NativeWind Implementation) ──
  const RowField = ({
    label,
    children,
  }: {
    label: string;
    children: React.ReactNode;
  }) => (
    <View className="mb-1">
      <View
        className={`flex-row items-center gap-4 ${
          isArabic ? "flex-row-reverse" : ""
        }`}
      >
        <Text
          className="text-sm font-semibold"
          style={{ width: 90, color: theme.colors.onSurfaceVariant }}
        >
          {label}
        </Text>
        <View className="flex-1">{children}</View>
      </View>
      <View
        className="h-[1px] mt-3"
        style={{ backgroundColor: theme.colors.outlineVariant }}
      />
    </View>
  );

  return (
    <View className="flex-1" style={{ backgroundColor: theme.colors.background }}>
      {/* ── Header ── */}
      <View
        className={`flex-row items-center justify-between px-3 pt-3 pb-2 ${
          isArabic ? "flex-row-reverse" : ""
        }`}
      >
        <Pressable onPress={() => router.back()}>
          <IconButton
            icon={isArabic ? "arrow-right" : "arrow-left"}
            size={22}
            iconColor={theme.colors.onSurface}
            className="m-0"
          />
        </Pressable>

        <Text
          className="text-lg font-extrabold"
          style={{ color: theme.colors.onSurface }}
        >
          {tab === "income"
            ? isArabic ? "دخل" : "Income"
            : tab === "expense"
            ? isArabic ? "مصروف" : "Expense"
            : isArabic ? "تحويل" : "Transfer"}
        </Text>

        <IconButton
          icon="cog-outline"
          size={22}
          iconColor={theme.colors.primary}
          className="m-0"
          onPress={() => router.push("/settings")}
        />
      </View>

      {/* ── Scrollable Body ── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
        >
        {/* ── Form Card ── */}
        <View
          className="rounded-[24px] px-4 py-3 gap-4 border"
          style={{
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.outlineVariant,
          }}
        >
          {/* Tab Switcher */}
          <SegmentedButtons
            value={tab}
            onValueChange={(v) => setTab(v as AddTab)}
            buttons={[
              { value: "income", label: isArabic ? "دخل" : "Income" },
              { value: "expense", label: isArabic ? "مصروف" : "Expense" },
              { value: "transfer", label: isArabic ? "تحويل" : "Transfer" },
            ]}
            style={{
              backgroundColor: theme.colors.surfaceVariant,
              borderRadius: 16,
            }}
          />

          {/* ── Dynamic Form Fields ── */}
          {tab === "transfer" ? (
            <>
              <RowField label={isArabic ? "المبلغ" : "Amount"}>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder={
                    isArabic ? `مثال ${currency} 8790` : `${currency} Ex. 8790`
                  }
                  keyboardType="decimal-pad"
                  className={`text-sm font-bold py-1.5`}
                  style={{
                    color: theme.colors.onSurface,
                    textAlign: isArabic ? "right" : "left",
                  }}
                  placeholderTextColor={theme.colors.onSurfaceVariant}
                />
              </RowField>

              <RowField label={isArabic ? "من" : "From"}>
                <ComboSelect
                  value={fromAccount}
                  options={accountOptions}
                  placeholder={isArabic ? "اختر" : "Select"}
                  onChange={setFromAccount}
                  variant="underline"
                  triggerStyle={{ flex: 1 }}
                  triggerTextStyle={{ textAlign: isArabic ? "right" : "left" }}
                />
              </RowField>

              <RowField label={isArabic ? "إلى" : "To"}>
                <ComboSelect
                  value={toAccount}
                  options={accountOptions}
                  placeholder={isArabic ? "اختر" : "Select"}
                  onChange={setToAccount}
                  variant="underline"
                  triggerStyle={{ flex: 1 }}
                  triggerTextStyle={{ textAlign: isArabic ? "right" : "left" }}
                />
              </RowField>
            </>
          ) : (
            <>
              {/* Category */}
              <RowField label={isArabic ? "الفئة" : "Category"}>
                <View
                  className={`flex-row items-center ${
                    isArabic ? "flex-row-reverse" : ""
                  }`}
                >
                  <ComboSelect
                    value={selectedCategory}
                    options={categoryOptions}
                    placeholder={isArabic ? "اختر" : "Select"}
                    onChange={setSelectedCategory}
                    variant="underline"
                    triggerStyle={{ flex: 1 }}
                    triggerTextStyle={{ textAlign: isArabic ? "right" : "left" }}
                  />
                  <IconButton
                    icon="plus-circle-outline"
                    size={20}
                    iconColor={theme.colors.primary}
                    className="m-0 ml-0.5"
                    onPress={() =>
                      router.push({
                        pathname: "/categories/manage",
                        params: { type: tab },
                      })
                    }
                  />
                </View>
              </RowField>

              {/* Amount */}
              <RowField label={isArabic ? "المبلغ" : "Amount"}>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder={
                    isArabic ? `مثال ${currency} 8790` : `${currency} Ex. 8790`
                  }
                  keyboardType="decimal-pad"
                  className={`text-sm font-bold py-1.5`}
                  style={{
                    color: theme.colors.onSurface,
                    textAlign: isArabic ? "right" : "left",
                  }}
                  placeholderTextColor={theme.colors.onSurfaceVariant}
                />
              </RowField>
            </>
          )}

          {/* Date */}
          <RowField label={isArabic ? "التاريخ" : "Date"}>
            <Pressable
              onPress={() => setDateVisible(true)}
              className={`flex-row items-center gap-1.5 ${
                isArabic ? "flex-row-reverse" : ""
              }`}
            >
              <IconButton
                icon="calendar"
                size={18}
                iconColor={theme.colors.primary}
                className="m-0"
              />
              <Text
                className="font-bold"
                style={{ color: theme.colors.primary }}
              >
                {dateLabel}
              </Text>
            </Pressable>
          </RowField>

          {/* Account (income / expense only) */}
          {tab !== "transfer" && (
            <RowField label={isArabic ? "الحساب" : "Account"}>
              <ComboSelect
                value={selectedAccount}
                options={accountOptions}
                placeholder={isArabic ? "اختر" : "Select"}
                onChange={setSelectedAccount}
                variant="underline"
                triggerStyle={{ flex: 1 }}
                triggerTextStyle={{ textAlign: isArabic ? "right" : "left" }}
              />
            </RowField>
          )}

          {/* Note */}
          <RowField label={isArabic ? "ملاحظة" : "Note"}>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder={
                tab === "transfer"
                  ? isArabic ? "ملاحظات التحويل" : "Ex. Transaction Notes"
                  : isArabic ? "ملاحظات العملية" : "Ex. Transaction Notes"
              }
              className={`text-sm font-bold py-1.5`}
              style={{
                color: theme.colors.onSurface,
                textAlign: isArabic ? "right" : "left",
              }}
              placeholderTextColor={theme.colors.onSurfaceVariant}
            />
          </RowField>

          {/* Save Button */}
          <Pressable
            onPress={handleSave}
            className="rounded-[26px] py-3.5 items-center active:opacity-70"
            style={{ backgroundColor: theme.colors.primary }}
          >
            <Text
              className="text-base font-extrabold"
              style={{ color: theme.colors.onPrimary }}
            >
              {isArabic ? "حفظ" : "Save"}
            </Text>
          </Pressable>
        </View>

        {/* ── Recent Transactions ── */}
        {filteredRecent.length > 0 && (
          <View className="mt-4 gap-3">
            {filteredRecent.map((tx) => {
              const isTransfer = tx.source === "transfer";
              const isIncome = tx.signedAmount >= 0;
              const categoryLabel = tx.categoryId
                ? categoryMap.get(tx.categoryId)
                : null;
              const accountLabel = tx.accountId
                ? accountMap.get(tx.accountId)
                : null;
              const transferLabel = isIncome
                ? isArabic ? "تحويل وارد" : "Transfer in"
                : isArabic ? "تحويل صادر" : "Transfer out";

              const title =
                tx.note ||
                (isTransfer
                  ? transferLabel
                  : categoryLabel ||
                    (isIncome
                      ? isArabic ? "دخل" : "Income"
                      : isArabic ? "مصروف" : "Expense"));

              const subtitleParts = [
                isTransfer
                  ? accountLabel
                    ? isIncome
                      ? isArabic ? `إلى ${accountLabel}` : `To ${accountLabel}`
                      : isArabic ? `من ${accountLabel}` : `From ${accountLabel}`
                    : null
                  : accountLabel,
                dayjs(tx.occurredAt).format(timePattern),
              ].filter(Boolean);

              const dotColor = isTransfer
                ? infoColor
                : isIncome
                ? successColor
                : theme.colors.error;

              return (
                <View
                  key={tx.id}
                  className={`rounded-[20px] p-3.5 border flex-row items-center justify-between ${
                    isArabic ? "flex-row-reverse" : ""
                  }`}
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.outlineVariant,
                  }}
                >
                  <View
                    className={`flex-row items-center gap-3 ${
                      isArabic ? "flex-row-reverse" : ""
                    }`}
                  >
                    <View
                      className="w-[34px] h-[34px] rounded-full items-center justify-center"
                      style={{ backgroundColor: withAlpha(dotColor, 0.12) }}
                    >
                      <IconButton
                        icon={
                          isTransfer
                            ? "swap-horizontal"
                            : isIncome
                            ? "arrow-up"
                            : "arrow-down"
                        }
                        size={18}
                        iconColor={dotColor}
                        className="m-0"
                      />
                    </View>
                    <View>
                      <Text
                        className={`font-bold ${isArabic ? "text-right" : "text-left"}`}
                        style={{ color: theme.colors.onSurface }}
                      >
                        {title}
                      </Text>
                      {subtitleParts.length > 0 && (
                        <Text
                          className={`text-[12px] ${isArabic ? "text-right" : "text-left"}`}
                          style={{ color: theme.colors.onSurfaceVariant }}
                        >
                          {subtitleParts.join(" • ")}
                        </Text>
                      )}
                    </View>
                  </View>

                  <View className="items-end gap-1.5">
                    <Text
                      className="font-extrabold"
                      style={{
                        color: isIncome ? successColor : theme.colors.error,
                      }}
                    >
                      {formatMoney(tx.signedAmount, locale, currency, true)}
                    </Text>
                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: "/transactions/[id]",
                          params: { id: String(tx.id) },
                        })
                      }
                    >
                      <IconButton
                        icon="pencil"
                        size={18}
                        iconColor={theme.colors.primary}
                        className="m-0"
                      />
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>      </KeyboardAvoidingView>
      {/* ── Calendar Modal ── */}
      <Portal>
        <Modal
          visible={dateVisible}
          onDismiss={() => setDateVisible(false)}
          contentContainerStyle={{
            marginHorizontal: 16,
            borderRadius: 20,
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.outlineVariant,
            padding: 12,
          }}
        >
          <Calendar
            onDayPress={(day) => {
              setDate(new Date(day.dateString));
              setDateVisible(false);
            }}
            markedDates={{
              [dayjs(date).format("YYYY-MM-DD")]: {
                selected: true,
                selectedColor: theme.colors.primary,
              },
            }}
            theme={{
              calendarBackground: theme.colors.surface,
              dayTextColor: theme.colors.onSurface,
              monthTextColor: theme.colors.onSurface,
              textDisabledColor: theme.colors.onSurfaceVariant,
              selectedDayBackgroundColor: theme.colors.primary,
              selectedDayTextColor: theme.colors.onPrimary,
              arrowColor: theme.colors.primary,
            }}
          />
        </Modal>
      </Portal>
    </View>
  );
}