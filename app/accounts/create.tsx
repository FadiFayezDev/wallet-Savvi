import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { IconButton, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";

import { AccountForm } from "@/src/components/forms/AccountForm";
import { accountService } from "@/src/services/accountService";

export default function CreateAccountScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { t } = useTranslation();

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
          {t("tools.createAccount")}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        <AccountForm
          submitLabel={t("tools.save")}
          onSubmit={async ({ name, groupKey, balance, description }) => {
            await accountService.createAccount({ name, groupKey, balance, description });
            await accountService.syncTotalBalance();
            router.back();
          }}
        />
      </ScrollView>
    </View>
  );
}
