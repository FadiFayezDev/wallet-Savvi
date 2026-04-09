import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";

import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Button,
  Card,
  IconButton,
  Menu,
  Modal,
  Portal,
  ProgressBar,
  SegmentedButtons,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import dayjs from "dayjs";

import { EmptyState } from "@/src/components/common/EmptyState";
import { ComboSelect } from "@/src/components/forms/ComboSelect";
import { MATERIAL_H } from "@/src/components/layout/MaterialScreen";
import { accountService } from "@/src/services/accountService";
import { budgetService } from "@/src/services/budgetService";
import { categoryService } from "@/src/services/categoryService";
import { reportService } from "@/src/services/reportService";
import { useSettingsStore } from "@/src/stores/settingsStore";
import type { Account, Budget, Category, MonthlyReport } from "@/src/types/domain";
import { formatMoney } from "@/src/utils/money";
import { toMonthKey } from "@/src/utils/date";
import { ACCOUNT_GROUPS } from "@/src/constants/accountGroups";
import type { AppTheme } from "@/src/types/appTheme";
import { withAlpha } from "@/src/utils/colors";
import { confirmAction } from "@/src/utils/confirm";

type ToolsTab = "budget" | "account" | "history";
type AccountViewMode = "all" | "month";
type AccountActionMode = "none" | "edit" | "delete";

export default function ToolsScreen() {
  const { t } = useTranslation();
  const theme = useTheme<AppTheme>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ToolsTab>("account");
  const [menuVisible, setMenuVisible] = useState(false);
  const [accountActionMode, setAccountActionMode] = useState<AccountActionMode>("none");
  const [budgetDialogVisible, setBudgetDialogVisible] = useState(false);
  const [budgetEditCategoryId, setBudgetEditCategoryId] = useState<number | null>(null);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View
        style={{
          paddingHorizontal: MATERIAL_H,
          paddingTop: 12,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text variant="headlineSmall" style={{ color: theme.colors.onSurface, flex: 1 }}>
          {t("tools.title")}
        </Text>
        {activeTab === "account" ? (
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
        ) : activeTab === "budget" ? (
          <IconButton
            icon="plus"
            size={22}
            iconColor={theme.colors.primary}
            onPress={() => {
              setBudgetEditCategoryId(null);
              setBudgetDialogVisible(true);
            }}
          />
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <View style={{ paddingHorizontal: MATERIAL_H, marginTop: 12 }}>
        <SegmentedButtons
          value={activeTab}
          onValueChange={(v) => {
            const next = v as ToolsTab;
            setActiveTab(next);
            if (next !== "account") setMenuVisible(false);
          }}
          buttons={[
            { value: "budget", label: t("tools.budget") },
            { value: "account", label: t("tools.account") },
            { value: "history", label: t("tools.history") },
          ]}
        />
      </View>

      <View style={{ flex: 1 }}>
        {activeTab === "budget" ? (
          <BudgetTab
            dialogVisible={budgetDialogVisible}
            onDismissDialog={() => setBudgetDialogVisible(false)}
            editCategoryId={budgetEditCategoryId}
            onEditCategory={(id) => {
              setBudgetEditCategoryId(id);
              setBudgetDialogVisible(true);
            }}
          />
        ) : null}
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

function BudgetTab({
  dialogVisible,
  onDismissDialog,
  editCategoryId,
  onEditCategory,
}: {
  dialogVisible: boolean;
  onDismissDialog: () => void;
  editCategoryId: number | null;
  onEditCategory: (id: number) => void;
}) {
  const theme = useTheme<AppTheme>();
  const { t, i18n } = useTranslation();
  const settings = useSettingsStore((state) => state.settings);
  const locale = settings?.locale ?? "ar";
  const currency = settings?.currencyCode ?? "EGP";
  const isAr = i18n.language.startsWith("ar");
  const monthKey = toMonthKey(new Date());

  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [spendMap, setSpendMap] = useState<Record<number, number>>({});
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [amountText, setAmountText] = useState("");
  const [saving, setSaving] = useState(false);

  const budgetMap = useMemo(() => new Map(budgets.map((b) => [b.categoryId, b])), [budgets]);

  const loadData = useCallback(async () => {
    const [categoryRows, budgetRows, spendRows] = await Promise.all([
      categoryService.listCategories("expense"),
      budgetService.listBudgets(),
      budgetService.listCategorySpendForMonth(monthKey),
    ]);
    setCategories(categoryRows);
    setBudgets(budgetRows);
    setSpendMap(spendRows);
  }, [monthKey]);

  useFocusEffect(
    useCallback(() => {
      loadData().catch(() => {
        setCategories([]);
        setBudgets([]);
        setSpendMap({});
      });
    }, [loadData]),
  );

  useEffect(() => {
    if (!dialogVisible) return;
    if (editCategoryId) {
      const existing = budgetMap.get(editCategoryId);
      setSelectedCategoryId(editCategoryId);
      setAmountText(existing ? String(existing.amount) : "");
      return;
    }
    const first = categories[0]?.id ?? null;
    setSelectedCategoryId(first);
    setAmountText("");
  }, [dialogVisible, editCategoryId, categories, budgetMap]);

  const categoryOptions = useMemo(
    () =>
      categories.map((c) => ({
        value: c.id,
        label: locale === "ar" ? c.nameAr : c.nameEn,
      })),
    [categories, locale],
  );

  const onSave = async () => {
    if (!selectedCategoryId) {
      Alert.alert(isAr ? "اختر الفئة" : "Select a category");
      return;
    }
    const amount = Number(amountText);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert(isAr ? "ادخل مبلغ صحيح" : "Enter a valid amount");
      return;
    }
    setSaving(true);
    try {
      await budgetService.upsertBudget(selectedCategoryId, amount);
      await loadData();
      onDismissDialog();
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!selectedCategoryId) return;
    const ok = await confirmAction({
      title: t("tools.deleteBudget"),
      message: t("tools.deleteBudgetConfirm"),
      confirmText: t("tools.delete"),
    });
    if (!ok) return;
    setSaving(true);
    try {
      await budgetService.deleteBudget(selectedCategoryId);
      await loadData();
      onDismissDialog();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ paddingHorizontal: MATERIAL_H, paddingTop: 12, paddingBottom: 72 }}
    >
      {categories.length === 0 ? (
        <EmptyState title={t("common.noData")} />
      ) : (
        <View style={{ gap: 12 }}>
          {categories.map((cat) => {
            const budget = budgetMap.get(cat.id) ?? null;
            const spent = spendMap[cat.id] ?? 0;
            const remaining = budget ? Math.max(budget.amount - spent, 0) : null;
            const progress = budget ? Math.min(spent / budget.amount, 1) : 0;
            const name = locale === "ar" ? cat.nameAr : cat.nameEn;
            const isOver = budget ? spent >= budget.amount : false;
            const progressColor = isOver ? theme.colors.error : theme.colors.primary;

            return (
              <Pressable
                key={cat.id}
                onPress={() => onEditCategory(cat.id)}
                style={{
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: theme.colors.outlineVariant,
                  backgroundColor: theme.colors.surface,
                  padding: 14,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: theme.colors.onSurface }}>
                    {name}
                  </Text>
                  {budget ? (
                    <Text style={{ color: theme.colors.onSurfaceVariant }}>
                      {formatMoney(budget.amount, locale, currency)}
                    </Text>
                  ) : (
                    <Text style={{ color: theme.colors.onSurfaceVariant }}>
                      {t("tools.noBudget")}
                    </Text>
                  )}
                </View>

                <View style={{ marginTop: 8 }}>
                  <Text style={{ color: theme.colors.onSurfaceVariant }}>
                    {t("tools.budgetSpent")}: {formatMoney(spent, locale, currency)}
                  </Text>
                  {budget ? (
                    <Text style={{ color: theme.colors.onSurfaceVariant }}>
                      {t("tools.budgetRemaining")}: {formatMoney(remaining ?? 0, locale, currency)}
                    </Text>
                  ) : null}
                </View>

                {budget ? (
                  <View style={{ marginTop: 10 }}>
                    <ProgressBar progress={progress} color={progressColor} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      )}

      <Portal>
        <Modal
          visible={dialogVisible}
          onDismiss={onDismissDialog}
          contentContainerStyle={{
            marginHorizontal: 16,
            borderRadius: 20,
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.outlineVariant,
            padding: 16,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "800", color: theme.colors.onSurface }}>
            {editCategoryId ? t("tools.editBudget") : t("tools.addBudget")}
          </Text>

          <View style={{ marginTop: 12 }}>
            <Text style={{ color: theme.colors.onSurfaceVariant, marginBottom: 6 }}>
              {t("tools.selectCategory")}
            </Text>
            <ComboSelect
              placeholder={isAr ? "اختر" : "Select"}
              value={selectedCategoryId ?? undefined}
              options={categoryOptions}
              onChange={(value) => setSelectedCategoryId(value)}
            />
          </View>

          <View style={{ marginTop: 12 }}>
            <TextInput
              mode="outlined"
              keyboardType="numeric"
              value={amountText}
              onChangeText={setAmountText}
              placeholder={t("tools.budgetAmount")}
            />
          </View>

          <View style={{ marginTop: 16, flexDirection: "row", gap: 10 }}>
            <Button mode="contained" onPress={onSave} loading={saving} style={{ flex: 1 }}>
              {t("tools.saveBudget")}
            </Button>
            {editCategoryId ? (
              <Button mode="outlined" onPress={onDelete} disabled={saving}>
                {t("tools.delete")}
              </Button>
            ) : null}
          </View>
        </Modal>
      </Portal>
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
  const theme = useTheme<AppTheme>();
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
      contentContainerStyle={{ paddingHorizontal: MATERIAL_H, paddingTop: 8, paddingBottom: 80 }}
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
  const theme = useTheme<AppTheme>();
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
      contentContainerStyle={{ paddingHorizontal: MATERIAL_H, paddingTop: 16, paddingBottom: 80 }}
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
