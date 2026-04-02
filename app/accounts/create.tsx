import { View } from "react-native";
import { useRouter } from "expo-router";
import { IconButton, Text, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";

import { AccountForm } from "@/src/components/forms/AccountForm";
import { MaterialScreen } from "@/src/components/layout/MaterialScreen";
import { accountService } from "@/src/services/accountService";

export default function CreateAccountScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <MaterialScreen
      layout="stack"
      header={
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 8 }}>
          <IconButton
            icon="arrow-left"
            iconColor={theme.colors.onSurface}
            size={22}
            onPress={() => router.back()}
            style={{ margin: 0 }}
          />
          <Text variant="titleLarge" style={{ color: theme.colors.onSurface, flex: 1 }}>
            {t("tools.createAccount")}
          </Text>
        </View>
      }
    >
      <AccountForm
        submitLabel={t("tools.save")}
        onSubmit={async ({ name, groupKey, balance, description }) => {
          await accountService.createAccount({ name, groupKey, balance, description });
          await accountService.syncTotalBalance();
          router.back();
        }}
      />
    </MaterialScreen>
  );
}
