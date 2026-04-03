import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import dayjs from "dayjs";
import { useLocalSearchParams, useRouter } from "expo-router";
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

  const [tab, setTab] = useState<AddTab>("income");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>(
    [],
  );

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<number | null>(null);

  const [fromAccount, setFromAccount] = useState<number | null>(null);
  const [toAccount, setToAccount] = useState<number | null>(null);

  const [date, setDate] = useState<Date>(new Date());
  const [dateVisible, setDateVisible] = useState(false);

  useEffect(() => {
    if (
      params.tab === "income" ||
      params.tab === "expense" ||
      params.tab === "transfer"
    ) {
      setTab(params.tab);
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
          null,
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

  const dateLabel = useMemo(() => {
    const todayKey = dayjs().format("YYYY-MM-DD");
    const selectedKey = dayjs(date).format("YYYY-MM-DD");
    if (todayKey === selectedKey) return isArabic ? "اليوم" : "Today";
    return dayjs(date).format("MMM D, YYYY");
  }, [date, isArabic]);

  const accountOptions = useMemo(
    () =>
      accounts.map((account) => ({
        value: account.id,
        label: account.name,
      })),
    [accounts],
  );

  const categoryOptions = useMemo(
    () =>
      categories.map((category) => ({
        value: category.id,
        label: locale === "ar" ? category.nameAr : category.nameEn,
      })),
    [categories, locale],
  );

  const categoryMap = useMemo(() => {
    const map = new Map<number, string>();
    categories.forEach((cat) => {
      map.set(cat.id, locale === "ar" ? cat.nameAr : cat.nameEn);
    });
    return map;
  }, [categories, locale]);

  const accountMap = useMemo(() => {
    const map = new Map<number, string>();
    accounts.forEach((acc) => map.set(acc.id, acc.name));
    return map;
  }, [accounts]);

  const filteredRecent = useMemo(() => {
    if (tab === "transfer") {
      return recentTransactions.filter((tx) => tx.source === "transfer");
    }
    return recentTransactions.filter(
      (tx) => tx.kind === tab && tx.source !== "transfer",
    );
  }, [recentTransactions, tab]);

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

  const inputTextStyle = {
    color: theme.colors.onSurface,
    fontWeight: "700" as const,
    paddingVertical: 6,
    minWidth: 160,
    textAlign: isArabic ? ("right" as const) : ("left" as const),
  };

  const rowLabelStyle = {
    color: theme.colors.onSurfaceVariant,
    fontSize: 14,
    fontWeight: "600" as const,
  };

  const rowDivider = {
    height: 1,
    backgroundColor: theme.colors.outlineVariant,
    marginTop: 12,
  };

  const timePattern = timeFormat === "24h" ? "HH:mm" : "hh:mm A";

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View
        style={{
          paddingHorizontal: 12,
          paddingTop: 10,
          paddingBottom: 6,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Pressable onPress={() => router.back()}>
          <IconButton
            icon={isArabic ? "arrow-right" : "arrow-left"}
            size={22}
            iconColor={theme.colors.onSurface}
            style={{ margin: 0 }}
          />
        </Pressable>
        <Text
          style={{
            fontSize: 18,
            fontWeight: "800",
            color: theme.colors.onSurface,
          }}
        >
          {tab === "income"
            ? isArabic
              ? "دخل"
              : "Income"
            : tab === "expense"
              ? isArabic
                ? "مصروف"
                : "Expense"
              : isArabic
                ? "تحويل"
                : "Transfer"}
        </Text>
        <IconButton
          icon="cog-outline"
          size={22}
          iconColor={theme.colors.primary}
          style={{ margin: 0 }}
          onPress={() => router.push("/settings")}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            borderRadius: 24,
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.outlineVariant,
            paddingHorizontal: 16,
            paddingVertical: 14,
            gap: 16,
          }}
        >
          <SegmentedButtons
            value={tab}
            onValueChange={(value) => setTab(value as AddTab)}
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

          {tab === "transfer" ? (
            <>
              <View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={rowLabelStyle}>
                    {isArabic ? "المبلغ" : "Amount"}
                  </Text>
                  <TextInput
                    value={amount}
                    onChangeText={setAmount}
                    placeholder={
                      isArabic
                        ? `مثال ${currency} 8790`
                        : `${currency} Ex. 8790`
                    }
                    keyboardType="decimal-pad"
                    style={inputTextStyle}
                    placeholderTextColor={theme.colors.onSurfaceVariant}
                  />
                </View>
                <View style={rowDivider} />
              </View>

              <View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={rowLabelStyle}>{isArabic ? "من" : "From"}</Text>
                  <ComboSelect
                    value={fromAccount}
                    options={accountOptions}
                    placeholder={isArabic ? "اختر" : "Select"}
                    onChange={(value) => setFromAccount(value)}
                    variant="underline"
                    triggerStyle={{ minWidth: 180 }}
                    triggerTextStyle={{
                      textAlign: isArabic ? "right" : "left",
                    }}
                  />
                </View>
                <View style={rowDivider} />
              </View>

              <View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={rowLabelStyle}>{isArabic ? "إلى" : "To"}</Text>
                  <ComboSelect
                    value={toAccount}
                    options={accountOptions}
                    placeholder={isArabic ? "اختر" : "Select"}
                    onChange={(value) => setToAccount(value)}
                    variant="underline"
                    triggerStyle={{ minWidth: 180 }}
                    triggerTextStyle={{
                      textAlign: isArabic ? "right" : "left",
                    }}
                  />
                </View>
                <View style={rowDivider} />
              </View>
            </>
          ) : (
            <>
              {/* Category */}
              <View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={rowLabelStyle}>
                    {isArabic ? "الفئة" : "Category"}
                  </Text>

                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <ComboSelect
                      value={selectedCategory}
                      options={categoryOptions}
                      placeholder={isArabic ? "اختر" : "Select"}
                      onChange={(value) => setSelectedCategory(value)}
                      variant="underline"
                      triggerStyle={{ minWidth: 160 }}
                      triggerTextStyle={{
                        textAlign: isArabic ? "right" : "left",
                      }}
                    />
                    <IconButton
                      icon="plus-circle-outline"
                      size={20}
                      iconColor={theme.colors.primary}
                      style={{ margin: 0, marginLeft: 2 }}
                      onPress={() =>
                        router.push({
                          pathname: "/categories/manage",
                          params: { type: tab },
                        })
                      }
                    />
                  </View>
                </View>
                <View style={rowDivider} />
              </View>
              <View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={rowLabelStyle}>
                    {isArabic ? "المبلغ" : "Amount"}
                  </Text>
                  <TextInput
                    value={amount}
                    onChangeText={setAmount}
                    placeholder={
                      isArabic
                        ? `مثال ${currency} 8790`
                        : `${currency} Ex. 8790`
                    }
                    keyboardType="decimal-pad"
                    style={inputTextStyle}
                    placeholderTextColor={theme.colors.onSurfaceVariant}
                  />
                </View>
                <View style={rowDivider} />
              </View>
            </>
          )}

          <View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text style={rowLabelStyle}>{isArabic ? "التاريخ" : "Date"}</Text>
              <Pressable
                onPress={() => setDateVisible(true)}
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <IconButton
                  icon="calendar"
                  size={18}
                  iconColor={theme.colors.primary}
                  style={{ margin: 0 }}
                />
                <Text
                  style={{ color: theme.colors.primary, fontWeight: "700" }}
                >
                  {dateLabel}
                </Text>
              </Pressable>
            </View>
            <View style={rowDivider} />
          </View>

          {tab !== "transfer" ? (
            <View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text style={rowLabelStyle}>
                  {isArabic ? "الحساب" : "Account"}
                </Text>
                <ComboSelect
                  value={selectedAccount}
                  options={accountOptions}
                  placeholder={isArabic ? "اختر" : "Select"}
                  onChange={(value) => setSelectedAccount(value)}
                  variant="underline"
                  triggerStyle={{ minWidth: 180 }}
                  triggerTextStyle={{ textAlign: isArabic ? "right" : "left" }}
                />
              </View>
              <View style={rowDivider} />
            </View>
          ) : null}

          {tab === "transfer" ? (
            <View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text style={rowLabelStyle}>
                  {isArabic ? "ملاحظة" : "Note"}
                </Text>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder={
                    isArabic ? "ملاحظات التحويل" : "Ex. Transaction Notes"
                  }
                  style={inputTextStyle}
                  placeholderTextColor={theme.colors.onSurfaceVariant}
                />
              </View>
              <View style={rowDivider} />
            </View>
          ) : (
            <View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text style={rowLabelStyle}>
                  {isArabic ? "ملاحظة" : "Note"}
                </Text>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder={
                    isArabic ? "ملاحظات العملية" : "Ex. Transaction Notes"
                  }
                  style={inputTextStyle}
                  placeholderTextColor={theme.colors.onSurfaceVariant}
                />
              </View>
              <View style={rowDivider} />
            </View>
          )}

          <Pressable
            onPress={handleSave}
            style={{
              borderRadius: 26,
              backgroundColor: theme.colors.primary,
              paddingVertical: 14,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: theme.colors.onPrimary,
                fontWeight: "800",
                fontSize: 16,
              }}
            >
              {isArabic ? "حفظ" : "Save"}
            </Text>
          </Pressable>
        </View>

        {filteredRecent.length > 0 ? (
          <View style={{ marginTop: 16, gap: 12 }}>
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
                ? isArabic
                  ? "تحويل وارد"
                  : "Transfer in"
                : isArabic
                  ? "تحويل صادر"
                  : "Transfer out";
              const title =
                tx.note ||
                (isTransfer
                  ? transferLabel
                  : categoryLabel ||
                    (isIncome
                      ? isArabic
                        ? "دخل"
                        : "Income"
                      : isArabic
                        ? "مصروف"
                        : "Expense"));
              const subtitleParts = [
                isTransfer
                  ? accountLabel
                    ? isIncome
                      ? isArabic
                        ? `إلى ${accountLabel}`
                        : `To ${accountLabel}`
                      : isArabic
                        ? `من ${accountLabel}`
                        : `From ${accountLabel}`
                    : null
                  : accountLabel,
                dayjs(tx.occurredAt).format(timePattern),
              ].filter(Boolean);
              const infoColor =
                (theme.colors as any).info ?? theme.colors.primary;
              const successColor =
                (theme.colors as any).success ?? theme.colors.secondary;
              return (
                <View
                  key={tx.id}
                  style={{
                    borderRadius: 20,
                    backgroundColor: theme.colors.surface,
                    borderWidth: 1,
                    borderColor: theme.colors.outlineVariant,
                    padding: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 17,
                        backgroundColor: withAlpha(
                          isTransfer
                            ? infoColor
                            : isIncome
                              ? successColor
                              : theme.colors.error,
                          0.12,
                        ),
                        alignItems: "center",
                        justifyContent: "center",
                      }}
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
                        iconColor={
                          isTransfer
                            ? infoColor
                            : isIncome
                              ? successColor
                              : theme.colors.error
                        }
                        style={{ margin: 0 }}
                      />
                    </View>
                    <View>
                      <Text
                        style={{
                          color: theme.colors.onSurface,
                          fontWeight: "700",
                        }}
                      >
                        {title}
                      </Text>
                      {subtitleParts.length > 0 ? (
                        <Text
                          style={{
                            color: theme.colors.onSurfaceVariant,
                            fontSize: 12,
                          }}
                        >
                          {subtitleParts.join(" • ")}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 6 }}>
                    <Text
                      style={{
                        color: isIncome ? successColor : theme.colors.error,
                        fontWeight: "800",
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
                        style={{ margin: 0 }}
                      />
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}
      </ScrollView>

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
