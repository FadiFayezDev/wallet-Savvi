import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { IconButton, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";

import type { Account } from "@/src/types/domain";
import { accountService } from "@/src/services/accountService";
import { AccountForm } from "@/src/components/forms/AccountForm";

export default function UpdateAccountScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id?: string }>();
  const [account, setAccount] = useState<Account | null>(null);

  const loadAccount = useCallback(async () => {
    const id = Number(params.id);
    if (!Number.isFinite(id)) return;
    const row = await accountService.getAccountById(id);
    setAccount(row);
  }, [params.id]);

  useEffect(() => {
    loadAccount().catch(() => setAccount(null));
  }, [loadAccount]);

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
      </ScrollView>
    </View>
  );
}
