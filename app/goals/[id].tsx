import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTheme } from "react-native-paper";

import { EmptyState } from "@/src/components/common/EmptyState";
import { ComboSelect } from "@/src/components/forms/ComboSelect";
import { accountService } from "@/src/services/accountService";
import { goalService } from "@/src/services/goalService";
import { useSettingsStore } from "@/src/stores/settingsStore";
import type { Account, GoalDetails } from "@/src/types/domain";
import { confirmAction } from "@/src/utils/confirm";
import { formatMoney } from "@/src/utils/money";

export default function GoalDetailsScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id: string }>();
  const goalId = Number(params.id);
  const settings = useSettingsStore((state) => state.settings);
  const theme = useTheme();

  const [details, setDetails] = useState<GoalDetails | null>(null);
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<number | null>(null);

  const locale = settings?.locale ?? "ar";
  const currency = settings?.currencyCode ?? "EGP";
  const isAr = locale === "ar";

  const loadDetails = useCallback(async () => {
    if (!Number.isFinite(goalId)) return;
    const payload = await goalService.getGoalDetails(goalId);
    setDetails(payload);
    setName(payload.goal.name);
    setTargetAmount(String(payload.goal.targetAmount));
  }, [goalId]);

  const loadAccounts = useCallback(async () => {
    const rows = await accountService.listAccounts();
    setAccounts(rows);
    const defaultAccount = rows.find((row) => row.isDefault);
    setSelectedAccount(defaultAccount?.id ?? rows[0]?.id ?? null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDetails().catch(() => {
        setDetails(null);
      });
    }, [loadDetails]),
  );

  useFocusEffect(
    useCallback(() => {
      loadAccounts().catch(() => setAccounts([]));
    }, [loadAccounts]),
  );

  const progress = useMemo(() => {
    if (!details) return 0;
    if (details.goal.targetAmount <= 0) return 0;
    return Math.min(details.goal.savedAmount / details.goal.targetAmount, 1);
  }, [details]);

  const accountOptions = useMemo(
    () => accounts.map((a) => ({ value: a.id, label: a.name })),
    [accounts],
  );

  if (!details) {
    return (
      <View
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: theme.colors.background }}
      >
        <Text style={{ color: theme.colors.onSurfaceVariant }}>
          {t("common.loading")}
        </Text>
      </View>
    );
  }

  const onTransfer = async () => {
    const amount = Number(transferAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert("Invalid transfer amount");
      return;
    }
    if (!selectedAccount) {
      Alert.alert("Select an account");
      return;
    }
    try {
      await goalService.transferToGoal({
        goalId,
        amount,
        accountId: selectedAccount,
        occurredAt: new Date().toISOString(),
      });
      setTransferAmount("");
      await loadDetails();
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Transfer failed",
      );
    }
  };

  const onUpdateGoal = async () => {
    const target = Number(targetAmount);
    if (!name.trim() || !Number.isFinite(target) || target <= 0) {
      Alert.alert("Invalid goal data");
      return;
    }
    try {
      await goalService.updateGoal(goalId, {
        name: name.trim(),
        targetAmount: target,
        id: 0
      });
      await loadDetails();
      Alert.alert("Goal updated");
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Failed to update",
      );
    }
  };

  const onCancelGoal = async () => {
    try {
      const ok = await confirmAction({
        title: isAr ? "إلغاء الهدف" : "Cancel goal",
        message: isAr
          ? "سيتم إلغاء الهدف واسترجاع الرصيد للمحفظة."
          : "The goal will be cancelled and refunded to your wallet.",
        confirmText: isAr ? "إلغاء" : "Cancel",
        cancelText: isAr ? "رجوع" : "Back",
        destructive: true,
      });
      if (!ok) return;
      await goalService.cancelGoal(goalId);
      await loadDetails();
      Alert.alert("Goal cancelled");
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Failed to cancel",
      );
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 16,
      }}
    >
      <View
        className="rounded-2xl p-4"
        style={{ backgroundColor: theme.colors.surface }}
      >
        <Text
          className="text-xl font-bold"
          style={{ color: theme.colors.onSurface }}
        >
          {details.goal.name}
        </Text>
        <Text className="mt-2" style={{ color: theme.colors.onSurfaceVariant }}>
          {t("goals.saved")}:{" "}
          {formatMoney(details.goal.savedAmount, locale, currency)}
        </Text>
        <Text style={{ color: theme.colors.onSurfaceVariant }}>
          {t("goals.remaining")}:{" "}
          {formatMoney(
            Math.max(details.goal.targetAmount - details.goal.savedAmount, 0),
            locale,
            currency,
          )}
        </Text>
        <View
          className="mt-3 h-3 rounded-full"
          style={{ backgroundColor: theme.colors.surfaceVariant }}
        >
          <View
            className="h-3 rounded-full"
            style={{
              backgroundColor: theme.colors.success,
              width: `${Math.round(progress * 100)}%`,
            }}
          />
        </View>
        <Text
          className="mt-1 text-right"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {Math.round(progress * 100)}%
        </Text>
      </View>

      <View
        className="mt-4 rounded-2xl p-4"
        style={{ backgroundColor: theme.colors.surface }}
      >
        <Text
          className="text-base font-bold"
          style={{ color: theme.colors.onSurface }}
        >
          {t("goals.transfer")}
        </Text>
        <TextInput
          value={transferAmount}
          onChangeText={setTransferAmount}
          placeholder={t("goals.transferAmount")}
          keyboardType="decimal-pad"
          placeholderTextColor={theme.colors.onSurfaceVariant}
          className="mt-2 rounded-xl px-4 py-3"
          style={{
            backgroundColor: theme.colors.surfaceVariant,
            color: theme.colors.onSurface,
          }}
        />
        <View className="mt-2">
          <ComboSelect
            value={selectedAccount}
            options={accountOptions}
            placeholder={isAr ? "اختر الحساب" : "Select Account"}
            onChange={setSelectedAccount}
            variant="filled"
            triggerStyle={{ backgroundColor: theme.colors.surfaceVariant }}
            triggerTextStyle={{ color: theme.colors.onSurface }}
          />
        </View>
        <Pressable
          onPress={onTransfer}
          className="mt-3 rounded-xl py-3"
          style={{ backgroundColor: theme.colors.success }}
        >
          <Text
            className="text-center font-semibold"
            style={{ color: theme.colors.onSuccess }}
          >
            {t("goals.transfer")}
          </Text>
        </Pressable>
      </View>

      <View
        className="mt-4 rounded-2xl p-4"
        style={{ backgroundColor: theme.colors.surface }}
      >
        <Text
          className="text-base font-bold"
          style={{ color: theme.colors.onSurface }}
        >
          {t("goals.updateGoal")}
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t("goals.goalName")}
          placeholderTextColor={theme.colors.onSurfaceVariant}
          className="mt-2 rounded-xl px-4 py-3"
          style={{
            backgroundColor: theme.colors.surfaceVariant,
            color: theme.colors.onSurface,
          }}
        />
        <TextInput
          value={targetAmount}
          onChangeText={setTargetAmount}
          placeholder={t("goals.targetAmount")}
          keyboardType="decimal-pad"
          placeholderTextColor={theme.colors.onSurfaceVariant}
          className="mt-2 rounded-xl px-4 py-3"
          style={{
            backgroundColor: theme.colors.surfaceVariant,
            color: theme.colors.onSurface,
          }}
        />
        <Pressable
          onPress={onUpdateGoal}
          className="mt-3 rounded-xl py-3"
          style={{ backgroundColor: theme.colors.primary }}
        >
          <Text
            className="text-center font-semibold"
            style={{ color: theme.colors.onPrimary }}
          >
            {t("goals.updateGoal")}
          </Text>
        </Pressable>
        <Pressable
          onPress={onCancelGoal}
          className="mt-3 rounded-xl py-3"
          style={{ backgroundColor: theme.colors.error }}
        >
          <Text
            className="text-center font-semibold"
            style={{ color: theme.colors.onError }}
          >
            {t("goals.cancelGoal")}
          </Text>
        </Pressable>
      </View>

      <View
        className="mb-12 mt-4 rounded-2xl p-4"
        style={{ backgroundColor: theme.colors.surface }}
      >
        <Text
          className="text-base font-bold"
          style={{ color: theme.colors.onSurface }}
        >
          {t("goals.history")}
        </Text>
        <View className="mt-3 gap-2">
          {details.transfers.length === 0 ? (
            <EmptyState title={t("common.noData")} />
          ) : (
            details.transfers.map((row) => (
              <View
                key={row.id}
                className="rounded-xl px-4 py-3"
                style={{ backgroundColor: theme.colors.surfaceVariant }}
              >
                <Text style={{ color: theme.colors.onSurface }}>
                  {row.action}
                </Text>
                <Text
                  style={{
                    color:
                      row.action === "transfer"
                        ? theme.colors.error
                        : theme.colors.success,
                  }}
                >
                  {formatMoney(
                    row.action === "transfer" ? -row.amount : row.amount,
                    locale,
                    currency,
                    true,
                  )}
                </Text>
                <Text
                  className="text-xs"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {row.transactionOccurredAt}
                </Text>
              </View>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}
