import { useEffect, useState, type ReactNode } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Button,
  Card,
  Divider,
  List,
  Switch,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { useRouter } from "expo-router";

import { CalculatorField } from "@/src/components/common/CalculatorField";
import { MaterialScreen } from "@/src/components/layout/MaterialScreen";
import { ComboSelect } from "@/src/components/forms/ComboSelect";
import { backupService } from "@/src/services/backupService";
import { dailySummaryService } from "@/src/services/dailySummaryService";
import { notificationService } from "@/src/services/notificationService";
import { securityService } from "@/src/services/securityService";
import { useSettingsStore } from "@/src/stores/settingsStore";
import { confirmAction } from "@/src/utils/confirm";

const lockMethods: ("none" | "pin" | "biometric")[] = ["none", "pin", "biometric"];
const themeModes: ("light" | "dark" | "system")[] = ["light", "dark", "system"];
const themeSources: ("material" | "fixed" | "mono" | "custom" | "palette")[] = [
  "material",
  "fixed",
  "mono",
  "custom",
  "palette",
];
const timeFormats: ("12h" | "24h")[] = ["12h", "24h"];
const locales: ("ar" | "en")[] = ["ar", "en"];

/** بطاقة إعدادات MD3: سطح مرتفع + حواف من الثيم */
function SettingsCard({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <Card
      mode="elevated"
      elevation={1}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.roundness * 2,
        },
      ]}
    >
      {children}
    </Card>
  );
}

export default function SettingsTab() {
  const { t, i18n } = useTranslation();
  const { settings, loadSettings, patchSettings } = useSettingsStore();
  const theme = useTheme();
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [dailyLimitInput, setDailyLimitInput] = useState("");
  const [savingLimit, setSavingLimit] = useState(false);

  useEffect(() => {
    if (!settings) loadSettings().catch(() => undefined);
  }, [loadSettings, settings]);

  useEffect(() => {
    if (!settings) return;
    setDailyLimitInput(settings.dailyLimit == null ? "" : String(settings.dailyLimit));
  }, [settings?.dailyLimit]);

  if (!settings) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator animating size="large" color={theme.colors.primary} />
        <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>
          {t("common.loading")}
        </Text>
      </View>
    );
  }

  const isAr = settings.locale === "ar";
  const themeSourceValue = settings.themeSource ?? "material";
  const timeFormatValue = settings.timeFormat ?? "24h";

  const saveLimit = async (clear = false) => {
    if (!clear) {
      const trimmed = dailyLimitInput.trim();
      const limit = trimmed.length === 0 ? null : Number(trimmed);
      if (trimmed.length > 0 && (!Number.isFinite(limit) || (limit as number) <= 0)) {
        Alert.alert(isAr ? "قيمة غير صحيحة" : "Invalid limit");
        return;
      }
      setSavingLimit(true);
      try {
        await patchSettings({ dailyLimit: limit });
        dailySummaryService.recomputeAllSummaries().catch(() => undefined);
      } finally {
        setSavingLimit(false);
      }
    } else {
      setDailyLimitInput("");
      setSavingLimit(true);
      try {
        await patchSettings({ dailyLimit: null });
        dailySummaryService.recomputeAllSummaries().catch(() => undefined);
      } finally {
        setSavingLimit(false);
      }
    }
  };

  const toggleNotifyBills = async () => {
    await patchSettings({ notifyBillsEnabled: !settings.notifyBillsEnabled });
    notificationService.rescheduleAll().catch(() => undefined);
  };

  const toggleNotifyWork = async () => {
    await patchSettings({ notifyWorkEnabled: !settings.notifyWorkEnabled });
    notificationService.rescheduleAll().catch(() => undefined);
  };

  const onThemeSourceChange = (source: string) => {
    if (source === "custom" && !settings.activeThemeId) {
      Alert.alert(
        isAr ? "اختر ثيم أولاً" : "Pick a theme first",
        isAr
          ? "افتح مكتبة الثيمات واختر ثيمًا مخصصًا لتفعيله."
          : "Open theme library and pick a custom theme to enable it.",
      );
      return;
    }
    if (source === "palette" && !settings.activePaletteThemeId) {
      Alert.alert(
        isAr ? "اختر ثيم لوحة أولاً" : "Pick a palette first",
        isAr
          ? "افتح مكتبة لوحة الألوان واختر ثيمًا لتفعيله."
          : "Open palette library and pick a palette theme to enable it.",
      );
      return;
    }
    patchSettings({ themeSource: source as "material" | "fixed" | "mono" | "custom" | "palette" }).catch(
      () => undefined,
    );
  };

  const pageTitle = isAr ? "الإعدادات" : "Settings";

  return (
    <MaterialScreen title={pageTitle} layout="tab">
        {/* ——— عام ——— */}
        <Text variant="labelLarge" style={[styles.groupLabel, { color: theme.colors.onSurfaceVariant }]}>
          {isAr ? "عام" : "General"}
        </Text>
        <SettingsCard>
          <List.Section style={styles.listSection}>
            <ComboSelect
              value={settings.locale}
              placeholder={isAr ? "اختر" : "Select"}
              options={locales.map((locale) => ({
                value: locale,
                label: locale === "ar" ? "العربية" : "English",
              }))}
              onChange={async (locale) => {
                await patchSettings({ locale: locale as "ar" | "en" });
                await i18n.changeLanguage(locale);
              }}
              listRow={{
                title: t("settings.language"),
                icon: "translate",
              }}
            />
            <Divider />
            <ComboSelect
              value={timeFormatValue}
              placeholder={isAr ? "اختر" : "Select"}
              options={timeFormats.map((fmt) => ({
                value: fmt,
                label: fmt === "12h" ? (isAr ? "١٢ ساعة" : "12h") : (isAr ? "٢٤ ساعة" : "24h"),
              }))}
              onChange={(fmt) => {
                patchSettings({ timeFormat: fmt as "12h" | "24h" }).catch(() => undefined);
              }}
              listRow={{
                title: isAr ? "تنسيق الوقت" : "Time format",
                description: isAr ? "١٢ أو ٢٤ ساعة" : "12h or 24h clock",
                icon: "clock-outline",
              }}
            />
          </List.Section>
        </SettingsCard>

        {/* ——— المظهر ——— */}
        <Text variant="labelLarge" style={[styles.groupLabel, { color: theme.colors.onSurfaceVariant }]}>
          {isAr ? "المظهر" : "Appearance"}
        </Text>
        <SettingsCard>
          <List.Section style={styles.listSection}>
            <ComboSelect
              value={settings.themeMode}
              placeholder={isAr ? "اختر" : "Select"}
              options={themeModes.map((mode) => ({
                value: mode,
                label: t(`settings.${mode}`),
              }))}
              onChange={(mode) => {
                patchSettings({ themeMode: mode as "light" | "dark" | "system" }).catch(() => undefined);
              }}
              listRow={{
                title: t("settings.theme"),
                description: isAr ? "فاتح، داكن، أو النظام" : "Light, dark, or system",
                icon: "brightness-6",
              }}
            />
            <Divider />
            <ComboSelect
              value={themeSourceValue}
              placeholder={isAr ? "اختر" : "Select"}
              options={themeSources.map((source) => ({
                value: source,
                label:
                  source === "material"
                    ? "Material You"
                    : source === "mono"
                      ? isAr
                        ? "أبيض وأسود"
                        : "Black & White"
                      : source === "custom"
                        ? isAr
                          ? "مخصص"
                          : "Custom"
                        : source === "palette"
                          ? isAr
                            ? "لوحة ألوان"
                            : "Palette"
                          : isAr
                            ? "ثابت"
                            : "Fixed",
              }))}
              onChange={onThemeSourceChange}
              listRow={{
                title: isAr ? "مصدر الثيم" : "Theme source",
                description: isAr ? "Material You أو ثابت أو مخصص" : "Dynamic color or fixed palette",
                icon: "palette-swatch",
              }}
            />
            <Divider />
            <List.Item
              title={isAr ? "الثيمات المخصصة" : "Custom themes"}
              description={isAr ? "إنشاء، استيراد، تصدير" : "Create, import, export"}
              left={(props) => <List.Icon {...props} icon="palette-advanced" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => router.push("/themes")}
            />
            <Divider />
            <List.Item
              title={isAr ? "لوحات الألوان" : "Palette themes"}
              description={isAr ? "ثيم كامل من لوحة ألوان" : "Full palette themes"}
              left={(props) => <List.Icon {...props} icon="palette" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => router.push("/themes/palette")}
            />
          </List.Section>
        </SettingsCard>

        {/* ——— حد المصروف ——— */}
        <Text variant="labelLarge" style={[styles.groupLabel, { color: theme.colors.onSurfaceVariant }]}>
          {isAr ? "الإنفاق" : "Spending"}
        </Text>
        <SettingsCard>
          <Card.Content style={styles.cardPad}>
            <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
              {isAr ? "حد المصروف اليومي" : "Daily spending limit"}
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
              {isAr ? "تنبيه عند التجاوز — لا يتم الحجب" : "Alert when exceeded — nothing is blocked"}
            </Text>
            <View style={{ marginTop: 12 }}>
              <CalculatorField
                label={isAr ? "قيمة الحد" : "Limit amount"}
                hint={isAr ? "اختياري — اتركه فارغًا لإلغاء الحد" : "Optional — empty removes the limit"}
                value={dailyLimitInput}
                onChange={setDailyLimitInput}
                locale={settings.locale}
              />
            </View>
            <View style={styles.buttonRow}>
              <Button
                mode="contained"
                icon="content-save-outline"
                onPress={() => saveLimit(false)}
                disabled={savingLimit}
                style={styles.flexBtn}
              >
                {isAr ? "حفظ" : "Save"}
              </Button>
              <Button mode="outlined" onPress={() => saveLimit(true)} disabled={savingLimit} style={styles.flexBtn}>
                {isAr ? "إلغاء الحد" : "Clear"}
              </Button>
            </View>
          </Card.Content>
        </SettingsCard>

        {/* ——— الأمان ——— */}
        <Text variant="labelLarge" style={[styles.groupLabel, { color: theme.colors.onSurfaceVariant }]}>
          {isAr ? "الأمان" : "Security"}
        </Text>
        <SettingsCard>
          <List.Section style={styles.listSection}>
            <ComboSelect
              value={settings.lockMethod}
              placeholder={isAr ? "اختر" : "Select"}
              options={lockMethods.map((method) => ({
                value: method,
                label: t(`settings.${method}`),
              }))}
              onChange={async (method) => {
                if (method === "pin") {
                  const hasPin = await securityService.hasPin();
                  if (!hasPin) {
                    Alert.alert(isAr ? "احفظ الـ PIN أولاً" : "Set a PIN first");
                    return;
                  }
                }
                if (method === "biometric") {
                  const canUse = await securityService.canUseBiometric();
                  if (!canUse) {
                    Alert.alert(isAr ? "البصمة غير متاحة" : "Biometric unavailable");
                    return;
                  }
                }
                await patchSettings({ lockMethod: method as "none" | "pin" | "biometric" });
              }}
              listRow={{
                title: t("settings.lockMethod"),
                description: isAr ? "بدون، PIN، أو بصمة" : "None, PIN, or biometric",
                icon: "shield-lock-outline",
              }}
            />
          </List.Section>
          <Divider />
          <Card.Content style={styles.cardPad}>
            <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 8 }}>
              {isAr ? "رمز PIN" : "PIN code"}
            </Text>
            <TextInput
              mode="outlined"
              value={pin}
              onChangeText={setPin}
              secureTextEntry
              keyboardType="number-pad"
              placeholder={isAr ? "أدخل الـ PIN" : "Enter PIN"}
              left={<TextInput.Icon icon="lock-outline" />}
              dense
            />
            <View style={[styles.buttonRow, { marginTop: 12 }]}>
              <Button
                mode="contained"
                icon="lock-check-outline"
                onPress={async () => {
                  try {
                    await securityService.setPin(pin);
                    setPin("");
                    Alert.alert(isAr ? "تم حفظ الـ PIN" : "PIN saved");
                  } catch (err) {
                    Alert.alert("Error", err instanceof Error ? err.message : "Failed");
                  }
                }}
                style={styles.flexBtn}
              >
                {t("settings.setPin")}
              </Button>
              <Button
                mode="contained-tonal"
                icon="lock-remove-outline"
                buttonColor={theme.colors.errorContainer}
                textColor={theme.colors.onErrorContainer}
                onPress={async () => {
                  const ok = await confirmAction({
                    title: isAr ? "حذف الـ PIN؟" : "Remove PIN?",
                    message: isAr ? "سيتم تعطيل الحماية بالـ PIN." : "PIN protection will be disabled.",
                    confirmText: isAr ? "حذف" : "Remove",
                    cancelText: isAr ? "إلغاء" : "Cancel",
                    destructive: true,
                  });
                  if (!ok) return;
                  await securityService.clearPin();
                  await patchSettings({ lockMethod: "none" });
                  setPin("");
                  Alert.alert(isAr ? "تم حذف الـ PIN" : "PIN removed");
                }}
                style={styles.flexBtn}
              >
                {t("settings.resetPin")}
              </Button>
            </View>
          </Card.Content>
        </SettingsCard>

        {/* ——— النسخ الاحتياطي ——— */}
        <Text variant="labelLarge" style={[styles.groupLabel, { color: theme.colors.onSurfaceVariant }]}>
          {isAr ? "البيانات" : "Data"}
        </Text>
        <SettingsCard>
          <Card.Content style={styles.cardPad}>
            <Text variant="titleMedium" style={{ color: theme.colors.onSurface, marginBottom: 12 }}>
              {t("settings.backup")}
            </Text>
            <View style={styles.stackBtns}>
              <Button
                mode="contained-tonal"
                icon="upload-outline"
                disabled={busy}
                onPress={async () => {
                  setBusy(true);
                  try {
                    await backupService.exportBackup();
                  } catch (err) {
                    Alert.alert("Export failed", err instanceof Error ? err.message : "Failed");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {t("common.export")}
              </Button>
              <Button
                mode="outlined"
                icon="download-outline"
                disabled={busy}
                onPress={async () => {
                  const ok = await confirmAction({
                    title: isAr ? "استيراد واستبدال؟" : "Import and replace?",
                    message: isAr ? "سيتم استبدال كل البيانات الحالية." : "All current data will be replaced.",
                    confirmText: isAr ? "استيراد" : "Import",
                    cancelText: isAr ? "إلغاء" : "Cancel",
                    destructive: true,
                  });
                  if (!ok) return;
                  setBusy(true);
                  try {
                    const imported = await backupService.importBackupReplaceAll();
                    if (imported) {
                      await loadSettings();
                      Alert.alert(isAr ? "تم الاستيراد" : "Import completed");
                    }
                  } catch (err) {
                    Alert.alert("Import failed", err instanceof Error ? err.message : "Failed");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {t("settings.importReplace")}
              </Button>
            </View>
          </Card.Content>
        </SettingsCard>

        {/* ——— التنبيهات ——— */}
        <Text variant="labelLarge" style={[styles.groupLabel, { color: theme.colors.onSurfaceVariant }]}>
          {isAr ? "التنبيهات" : "Notifications"}
        </Text>
        <SettingsCard>
          <List.Section style={styles.listSection}>
            <List.Item
              title={isAr ? "تنبيهات الفواتير" : "Bill reminders"}
              description={isAr ? "قبل موعد الاستحقاق" : "Before due dates"}
              left={(props) => <List.Icon {...props} icon="receipt-text-outline" />}
              right={() => <Switch value={settings.notifyBillsEnabled} onValueChange={toggleNotifyBills} />}
            />
            <Divider />
            <List.Item
              title={isAr ? "تنبيهات الشغل" : "Work reminders"}
              description={isAr ? "تذكير بأيام العمل" : "Work day reminders"}
              left={(props) => <List.Icon {...props} icon="briefcase-outline" />}
              right={() => <Switch value={settings.notifyWorkEnabled} onValueChange={toggleNotifyWork} />}
            />
          </List.Section>
          <Divider />
          <Card.Content style={styles.cardPad}>
            <View style={styles.buttonRow}>
              <Button
                mode="contained-tonal"
                icon="bell-ring-outline"
                onPress={() => {
                  notificationService.scheduleTestNotification(5).catch(() => undefined);
                  Alert.alert(
                    isAr ? "تم الإرسال" : "Scheduled",
                    isAr ? "سيظهر التنبيه بعد 5 ثوانٍ." : "Notification will appear in 5 seconds.",
                  );
                }}
                style={styles.flexBtn}
              >
                {isAr ? "اختبار" : "Test"}
              </Button>
              <Button
                mode="outlined"
                icon="bell-off-outline"
                onPress={() => {
                  notificationService.cancelAllTestNotifications().catch(() => undefined);
                  Alert.alert(
                    isAr ? "تم المسح" : "Cleared",
                    isAr ? "تم حذف تنبيهات الاختبار." : "Test notifications cleared.",
                  );
                }}
                style={styles.flexBtn}
              >
                {isAr ? "مسح الاختبار" : "Clear test"}
              </Button>
            </View>
          </Card.Content>
        </SettingsCard>

    </MaterialScreen>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  groupLabel: {
    marginTop: 12,
    marginBottom: 8,
    marginLeft: 2,
    letterSpacing: 0.5,
    fontWeight: "700",
  },
  card: {
    marginBottom: 4,
  },
  listSection: {
    marginBottom: 0,
    marginTop: 0,
    paddingVertical: 0,
  },
  cardPad: {
    paddingVertical: 12,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  flexBtn: {
    flex: 1,
    minWidth: 120,
  },
  stackBtns: {
    gap: 10,
  },
});
