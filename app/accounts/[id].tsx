import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { IconButton, List, Surface, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";

import type { Account } from "@/src/types/domain";
import { accountService } from "@/src/services/accountService";
import { AccountForm } from "@/src/components/forms/AccountForm";
import { transactionService } from "@/src/services/transactionService";
import { useSettingsStore } from "@/src/stores/settingsStore";
import type { Transaction } from "@/src/types/domain";
import { formatMoney } from "@/src/utils/money";
import { nowIso } from "@/src/utils/date";
import { withAlpha } from "@/src/utils/colors";

export default function UpdateAccountScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id?: string }>();
  const [account, setAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const settings = useSettingsStore((s) => s.settings);
  const locale = settings?.locale ?? "ar";
  const currency = settings?.currencyCode ?? "EGP";
  const isArabic = locale === "ar";

  const loadAccount = useCallback(async () => {
    const id = Number(params.id);
    if (!Number.isFinite(id)) return;
    const row = await accountService.getAccountById(id);
    setAccount(row);
  }, [params.id]);

  const loadTransactions = useCallback(async () => {
    const id = Number(params.id);
    if (!Number.isFinite(id)) return;
    const rows = await transactionService.listTransactionsByAccount(id);
    setTransactions(rows);
  }, [params.id]);

  useEffect(() => {
    loadAccount().catch(() => setAccount(null));
  }, [loadAccount]);

  useEffect(() => {
    loadTransactions().catch(() => setTransactions([]));
  }, [loadTransactions]);

  const sections = useMemo(() => {
    const grouped: { title: string; items: Transaction[] }[] = [];
    for (const tx of transactions) {
      const title = new Date(tx.occurredAt).toLocaleDateString(locale, {
        month: "long",
        year: "numeric",
      });
      const last = grouped[grouped.length - 1];
      if (last && last.title === title) {
        last.items.push(tx);
      } else {
        grouped.push({ title, items: [tx] });
      }
    }
    return grouped;
  }, [transactions, locale]);

  const transactionKindMeta = useMemo(() => {
    const success = (theme.colors as any).success ?? theme.colors.secondary;
    const warning = (theme.colors as any).warning ?? theme.colors.tertiary;
    const info = (theme.colors as any).info ?? theme.colors.primary;
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

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <IconButton
          icon="arrow-left"
          iconColor={theme.colors.onSurface}
          size={22}
          onPress={() => router.back()}
        />
        <IconButton icon="wallet-outline" iconColor={theme.colors.primary} size={20} />
        <Text style={{ fontSize: 18, fontWeight: "800", color: theme.colors.onSurface }}>
          {t("tools.updateAccount")}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        {account ? (
          <AccountForm
            initial={{
              name: account.name,
              groupKey: account.groupKey,
              balance: account.balance,
              description: account.description,
            }}
            submitLabel={t("tools.save")}
            onSubmit={async ({ name, groupKey, balance, description }) => {
              const diff = balance - account.balance;
              if (diff !== 0) {
                const kind = diff > 0 ? "income" : "expense";
                await transactionService.createSystemTransaction({
                  kind,
                  amount: Math.abs(diff),
                  categoryId: null,
                  note: t("tools.balanceAdjustment"),
                  accountId: account.id,
                  occurredAt: nowIso(),
                });
              }
              await accountService.updateAccount(account.id, {
                name,
                groupKey,
                balance,
                description,
              });
              await accountService.syncTotalBalance();
              router.back();
            }}
          />
        ) : (
          <Text style={{ color: theme.colors.onSurfaceVariant }}>{t("common.loading")}</Text>
        )}

        <View style={{ marginTop: 24, gap: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: theme.colors.onSurface }}>
            {isArabic ? "عمليات الحساب" : "Account Transactions"}
          </Text>

          {sections.length === 0 ? (
            <Text style={{ color: theme.colors.onSurfaceVariant }}>
              {isArabic ? "لا توجد عمليات لهذا الحساب" : "No transactions for this account"}
            </Text>
          ) : (
            sections.map((section) => (
              <View key={section.title} style={{ gap: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: theme.colors.onSurfaceVariant }}>
                  {section.title}
                </Text>
                {section.items.map((item) => {
                  const isTransfer = item.source === "transfer";
                  const meta = isTransfer
                    ? {
                        icon: "swap-horizontal",
                        color: (theme.colors as any).info ?? theme.colors.primary,
                        bg: withAlpha(
                          (theme.colors as any).info ?? theme.colors.primary,
                          0.12,
                        ),
                      }
                    : (transactionKindMeta[
                        item.kind as keyof typeof transactionKindMeta
                      ] ?? transactionKindMeta.expense);
                  const isIncome = item.signedAmount >= 0;
                  const transferLabel = isIncome
                    ? isArabic
                      ? "تحويل وارد"
                      : "Transfer in"
                    : isArabic
                      ? "تحويل صادر"
                      : "Transfer out";
                  const titleText = item.note || (isTransfer ? transferLabel : item.kind);
                  const subtitle = new Date(item.occurredAt).toLocaleDateString(locale);

                  return (
                    <Surface
                      key={item.id}
                      elevation={0}
                      style={{
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.outlineVariant,
                        borderWidth: 1,
                        borderRadius: 14,
                        overflow: "hidden",
                      }}
                    >
                      <List.Item
                        title={titleText}
                        description={subtitle}
                        titleNumberOfLines={1}
                        descriptionNumberOfLines={1}
                        style={{ paddingVertical: 4 }}
                        titleStyle={{ fontWeight: "700", color: theme.colors.onSurface }}
                        descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
                        left={() => (
                          <View
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 12,
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: meta.bg,
                              marginLeft: 8,
                            }}
                          >
                            <IconButton
                              icon={meta.icon}
                              iconColor={meta.color}
                              size={18}
                              style={{ margin: 0 }}
                            />
                          </View>
                        )}
                        right={() => (
                          <Text
                            style={{
                              fontSize: 14,
                              fontWeight: "700",
                              color:
                                item.signedAmount >= 0
                                  ? ((theme.colors as any).success ??
                                    theme.colors.secondary)
                                  : theme.colors.error,
                              marginRight: 12,
                            }}
                          >
                            {formatMoney(item.signedAmount, locale, currency, true)}
                          </Text>
                        )}
                      />
                    </Surface>
                  );
                })}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}
