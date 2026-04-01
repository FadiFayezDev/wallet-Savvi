import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { IconButton, Menu, useTheme } from "react-native-paper";
import dayjs from "dayjs";

import { EmptyState } from "@/src/components/common/EmptyState";
import { accountService } from "@/src/services/accountService";
import { categoryService } from "@/src/services/categoryService";
import { reportService } from "@/src/services/reportService";
import { useSettingsStore } from "@/src/stores/settingsStore";
import type { Account, Category, MonthlyReport } from "@/src/types/domain";
import { formatMoney } from "@/src/utils/money";
import { toMonthKey } from "@/src/utils/date";
import { ACCOUNT_GROUPS } from "@/src/constants/accountGroups";
import { withAlpha } from "@/src/utils/colors";
import { confirmAction } from "@/src/utils/confirm";

type ToolsTab = "budget" | "account" | "history";
type AccountViewMode = "all" | "month";
type AccountActionMode = "none" | "edit" | "delete";

export default function ToolsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ToolsTab>("account");
  const [menuVisible, setMenuVisible] = useState(false);
  const [accountActionMode, setAccountActionMode] = useState<AccountActionMode>("none");

  const tabStyle = (tab: ToolsTab) => {
    const isActive = tab === activeTab;
    return {
      flex: 1,
      borderRadius: 12,
      paddingVertical: 10,
      alignItems: "center" as const,
      backgroundColor: isActive ? theme.colors.primary : "transparent",
    };
  };

  const tabTextStyle = (tab: ToolsTab) => ({
    fontSize: 13,
    fontWeight: "700" as const,
    color: tab === activeTab ? theme.colors.onPrimary : theme.colors.onSurfaceVariant,
  });

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 20, fontWeight: "900", color: theme.colors.onSurface }}>
          {t("tools.title")}
        </Text>
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <IconButton
              icon="dots-vertical"
              size={22}
              iconColor={theme.colors.onSurfaceVariant}
              onPress={() => setMenuVisible(true)}
            />
          }
          contentStyle={{
            backgroundColor: theme.colors.surface,
            borderRadius: 16,
            paddingVertical: 6,
            borderWidth: 1,
            borderColor: theme.colors.outlineVariant,
          }}
        >
          <Menu.Item
            title={t("tools.createAccount")}
            onPress={() => {
              setMenuVisible(false);
              setActiveTab("account");
              setAccountActionMode("none");
              router.push("/accounts/create");
            }}
          />
          <Menu.Item
            title={t("tools.updateAccount")}
            onPress={() => {
              setMenuVisible(false);
              setActiveTab("account");
              setAccountActionMode("edit");
            }}
          />
          <Menu.Item
            title={t("tools.deleteAccount")}
            onPress={() => {
              setMenuVisible(false);
              setActiveTab("account");
              setAccountActionMode("delete");
            }}
          />
        </Menu>
      </View>

      {/* Internal Tabs */}
      <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
        <View
          style={{
            backgroundColor: theme.colors.surfaceVariant,
            borderRadius: 16,
            padding: 4,
            flexDirection: "row",
            gap: 6,
          }}
        >
          <Pressable onPress={() => setActiveTab("budget")} style={tabStyle("budget")}>
            <Text style={tabTextStyle("budget")}>{t("tools.budget")}</Text>
          </Pressable>
          <Pressable onPress={() => setActiveTab("account")} style={tabStyle("account")}>
            <Text style={tabTextStyle("account")}>{t("tools.account")}</Text>
          </Pressable>
          <Pressable onPress={() => setActiveTab("history")} style={tabStyle("history")}>
            <Text style={tabTextStyle("history")}>{t("tools.history")}</Text>
          </Pressable>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        {activeTab === "budget" ? <BudgetTab /> : null}
        {activeTab === "account" ? (
          <AccountTab
            actionMode={accountActionMode}
            onActionModeChange={setAccountActionMode}
          />
        ) : null}
        {activeTab === "history" ? <HistoryTab /> : null}
      </View>
    </View>
  );
}

function BudgetTab() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language.startsWith("ar");

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
    >
      <View
        style={{
          borderRadius: 20,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          backgroundColor: theme.colors.surface,
          padding: 20,
          gap: 8,
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: "800", color: theme.colors.onSurface }}>
          {t("tools.budget")}
        </Text>
        <Text style={{ fontSize: 13, color: theme.colors.onSurfaceVariant }}>
          {isAr ? "الميزة قيد التطوير في هذا الإصدار." : "This section is coming soon in this release."}
        </Text>
      </View>
    </ScrollView>
  );
}

function AccountTab({
  actionMode,
  onActionModeChange,
}: {
  actionMode: AccountActionMode;
  onActionModeChange: (mode: AccountActionMode) => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const settings = useSettingsStore((state) => state.settings);
  const locale = settings?.locale ?? "ar";
  const currency = settings?.currencyCode ?? "EGP";

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [netChanges, setNetChanges] = useState<Record<number, number>>({});
  const [viewMode, setViewMode] = useState<AccountViewMode>("all");
  const [monthKey, setMonthKey] = useState(() => toMonthKey(new Date()));

  const loadData = useCallback(async () => {
    const [rows, netMap] = await Promise.all([
      accountService.listAccounts(),
      accountService.listNetChangesByMonth(monthKey),
    ]);
    setAccounts(rows);
    setNetChanges(netMap);
  }, [monthKey]);

  useFocusEffect(
    useCallback(() => {
      loadData().catch(() => {
        setAccounts([]);
        setNetChanges({});
      });
    }, [loadData]),
  );

  const grouped = useMemo(() => {
    return ACCOUNT_GROUPS.map((group) => {
      const groupAccounts = accounts.filter((acc) => acc.groupKey === group.key);
      const total = groupAccounts.reduce((sum, acc) => {
        const raw = viewMode === "all" ? acc.balance : netChanges[acc.id] ?? 0;
        return sum + raw;
      }, 0);
      return { group, accounts: groupAccounts, total };
    }).filter((g) => g.accounts.length > 0);
  }, [accounts, netChanges, viewMode]);

  const totals = useMemo(() => {
    let assets = 0;
    let liabilities = 0;
    for (const group of grouped) {
      const isLiability = group.group.type === "liability";
      if (isLiability) {
        liabilities += Math.abs(group.total);
      } else {
        assets += group.total;
      }
    }
    const total = assets - liabilities;
    return { assets, liabilities, total };
  }, [grouped]);

  const monthLabel = useMemo(() => {
    const base = dayjs(`${monthKey}-01`);
    return base.format("MMM YYYY");
  }, [monthKey]);

  const changeMonth = (dir: "prev" | "next") => {
    const base = dayjs(`${monthKey}-01`);
    const next = dir === "prev" ? base.subtract(1, "month") : base.add(1, "month");
    setMonthKey(next.format("YYYY-MM"));
  };

  const summaryChip = (label: string, value: number, color: string) => (
    <View style={{ flex: 1, alignItems: "center", gap: 4 }}>
      <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12 }}>{label}</Text>
      <Text style={{ fontSize: 16, fontWeight: "800", color }}>
        {formatMoney(value, locale, currency, viewMode === "month")}
      </Text>
    </View>
  );

  const showActionBanner = actionMode !== "none";
  const bannerColor =
    actionMode === "delete" ? theme.colors.error : theme.colors.primary;
  const bannerText =
    actionMode === "delete"
      ? t("tools.deleteMode")
      : t("tools.editMode");

  const handleDelete = async (account: Account) => {
    const ok = await confirmAction({
      title: t("tools.deleteAccount"),
      message: t("tools.deleteAccountConfirm"),
      confirmText: t("tools.delete"),
      cancelText: t("common.cancel"),
      destructive: true,
    });
    if (!ok) return;
    try {
      await accountService.deleteAccount(account.id);
      await accountService.syncTotalBalance();
      await loadData();
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : t("errors.generic"));
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
    >
      {showActionBanner ? (
        <View
          style={{
            borderRadius: 14,
            borderWidth: 1,
            borderColor: withAlpha(bannerColor, 0.4),
            backgroundColor: withAlpha(bannerColor, 0.08),
            padding: 12,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text style={{ color: bannerColor, fontWeight: "700" }}>{bannerText}</Text>
          <Pressable
            onPress={() => onActionModeChange("none")}
            style={{
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 6,
              backgroundColor: withAlpha(bannerColor, 0.12),
            }}
          >
            <Text style={{ color: bannerColor, fontWeight: "700" }}>{t("tools.done")}</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Toggle */}
      <View
        style={{
          alignSelf: "flex-start",
          backgroundColor: theme.colors.surfaceVariant,
          borderRadius: 14,
          padding: 4,
          flexDirection: "row",
          gap: 6,
        }}
      >
        {(["all", "month"] as AccountViewMode[]).map((mode) => {
          const active = viewMode === mode;
          return (
            <Pressable
              key={mode}
              onPress={() => setViewMode(mode)}
              style={{
                borderRadius: 10,
                paddingVertical: 6,
                paddingHorizontal: 14,
                backgroundColor: active ? theme.colors.surface : "transparent",
                borderWidth: active ? 1 : 0,
                borderColor: theme.colors.outlineVariant,
              }}
            >
              <Text style={{ color: active ? theme.colors.onSurface : theme.colors.onSurfaceVariant }}>
                {mode === "all" ? t("tools.all") : t("tools.month")}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Month Navigation */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "flex-end",
          marginTop: 12,
          gap: 8,
          opacity: viewMode === "month" ? 1 : 0.6,
        }}
      >
        <Pressable onPress={() => changeMonth("prev")} disabled={viewMode !== "month"}>
          <IconButton icon="chevron-left" size={20} iconColor={theme.colors.onSurfaceVariant} />
        </Pressable>
        <Text style={{ fontSize: 16, fontWeight: "700", color: theme.colors.onSurface }}>
          {monthLabel}
        </Text>
        <Pressable onPress={() => changeMonth("next")} disabled={viewMode !== "month"}>
          <IconButton icon="chevron-right" size={20} iconColor={theme.colors.onSurfaceVariant} />
        </Pressable>
      </View>

      {/* Summary Card */}
      <View
        style={{
          marginTop: 12,
          borderRadius: 20,
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          padding: 16,
          flexDirection: "row",
          gap: 12,
        }}
      >
        {summaryChip(t("tools.assets"), totals.assets, theme.colors.primary)}
        {summaryChip(t("tools.liabilities"), totals.liabilities, theme.colors.error)}
        {summaryChip(t("tools.total"), totals.total, theme.colors.success ?? theme.colors.secondary)}
      </View>

      {/* Groups */}
      {grouped.length === 0 ? (
        <View style={{ marginTop: 20 }}>
          <EmptyState title={t("common.noData")} />
        </View>
      ) : (
        <View style={{ marginTop: 16, gap: 16 }}>
          {grouped.map((group) => {
          const groupMeta = group.group;
          const groupLabel = locale === "ar" ? groupMeta.labelAr : groupMeta.labelEn;
          const totalValue = viewMode === "all" && groupMeta.type === "liability"
            ? Math.abs(group.total)
            : group.total;
          return (
            <View key={group.group.key} style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 18, fontWeight: "800", color: theme.colors.onSurface }}>
                  {groupLabel}
                </Text>
                <Text style={{ fontSize: 15, fontWeight: "700", color: groupMeta.type === "liability" ? theme.colors.error : theme.colors.primary }}>
                  {formatMoney(totalValue, locale, currency, viewMode === "month")}
                </Text>
              </View>

              <View
                style={{
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: theme.colors.outlineVariant,
                  backgroundColor: theme.colors.surface,
                  overflow: "hidden",
                }}
              >
                {group.accounts.map((account, index) => {
                  const raw = viewMode === "all" ? account.balance : netChanges[account.id] ?? 0;
                  const displayValue = viewMode === "all" && groupMeta.type === "liability"
                    ? Math.abs(raw)
                    : raw;
                  const color = groupMeta.type === "liability" ? theme.colors.error : theme.colors.primary;
                  return (
                    <Pressable
                      key={account.id}
                      onPress={() => {
                        if (actionMode === "delete") return;
                        if (actionMode === "edit") {
                          router.push({ pathname: "/accounts/[id]", params: { id: String(account.id) } });
                          return;
                        }
                        router.push({ pathname: "/accounts/[id]", params: { id: String(account.id) } });
                      }}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        borderTopWidth: index === 0 ? 0 : 1,
                        borderTopColor: theme.colors.outlineVariant,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: withAlpha(color, 0.7),
                          }}
                        />
                        <Text style={{ color: theme.colors.onSurface, fontSize: 15, fontWeight: "600" }}>
                          {account.name}
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <Text style={{ color, fontWeight: "700" }}>
                          {formatMoney(displayValue, locale, currency, viewMode === "month")}
                        </Text>
                        {actionMode === "delete" ? (
                          <IconButton
                            icon="trash-can-outline"
                            size={18}
                            iconColor={theme.colors.error}
                            onPress={() => handleDelete(account)}
                          />
                        ) : actionMode === "edit" ? (
                          <IconButton
                            icon="pencil-outline"
                            size={18}
                            iconColor={theme.colors.onSurfaceVariant}
                          />
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}
        </View>
      )}

      {/* Add New Account */}
      <Pressable
        onPress={() => router.push("/accounts/create")}
        style={{
          marginTop: 24,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          backgroundColor: theme.colors.surfaceVariant,
          paddingVertical: 14,
          alignItems: "center",
        }}
      >
        <Text style={{ color: theme.colors.primary, fontWeight: "700" }}>
          {t("tools.addAccount")}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function HistoryTab() {
  const { t } = useTranslation();
  const theme = useTheme();
  const params = useLocalSearchParams<{ month?: string }>();
  const settings = useSettingsStore((state) => state.settings);
  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [breakdownRows, setBreakdownRows] = useState<any[]>([]);

  const locale = settings?.locale ?? "ar";
  const currency = settings?.currencyCode ?? "EGP";

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
      const requested = typeof params.month === "string" ? params.month : null;
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
    if (!category) return "-";
    return locale === "ar" ? category.nameAr : category.nameEn;
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: 16, paddingTop: 16, paddingBottom: 80 }}
    >
      {/* Month Picker */}
      <View style={{ borderRadius: 16, backgroundColor: theme.colors.surface, padding: 16 }}>
        <Text style={{ fontSize: 15, fontWeight: "bold", color: theme.colors.onSurface }}>
          {t("months.title")}
        </Text>
        <View style={{ marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
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
          <EmptyState title={t("common.noData")} />
        ) : (
          <View style={{ borderRadius: 16, backgroundColor: theme.colors.surface, padding: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: "bold", color: theme.colors.onSurface }}>{selected.monthKey}</Text>
            <Text style={{ marginTop: 12, color: theme.colors.onSurfaceVariant }}>
              {t("months.incomeTotal")}: {formatMoney(selected.totalIncome, locale, currency)}
            </Text>
            <Text style={{ color: theme.colors.onSurfaceVariant }}>
              {t("months.expenseTotal")}: {formatMoney(selected.totalExpense, locale, currency)}
            </Text>
            {/* Net result: primary = positive, error = negative */}
            <Text style={{ color: selected.netResult >= 0 ? theme.colors.primary : theme.colors.error, fontWeight: "700" }}>
              {t("months.net")}: {formatMoney(selected.netResult, locale, currency, true)}
            </Text>
            <Text style={{ marginTop: 8, color: theme.colors.onSurfaceVariant }}>
              {t("months.topExpenseCategory")}: {categoryName(topExpense)}
            </Text>
            <Text style={{ color: theme.colors.onSurfaceVariant }}>
              {t("months.topIncomeCategory")}: {categoryName(topIncome)}
            </Text>
            <Text style={{ color: theme.colors.onSurfaceVariant }}>
              {t("months.highestSpendDay")}: {selected.highestSpendDay ?? "-"}
            </Text>
            <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: theme.colors.outlineVariant, paddingTop: 12 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: theme.colors.onSurface }}>
                {locale === "ar" ? "تفصيل المصروفات حسب الفئة" : "Expense Breakdown by Category"}
              </Text>
              {breakdownRows.length === 0 ? (
                <Text style={{ marginTop: 6, color: theme.colors.onSurfaceVariant }}>
                  {locale === "ar" ? "لا يوجد تفصيل للفئات" : "No breakdown data"}
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
                        {locale === "ar" ? row.name_ar : row.name_en}
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
