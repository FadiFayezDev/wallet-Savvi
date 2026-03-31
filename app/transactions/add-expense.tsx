import { useRef, useEffect } from "react";
import { Alert, Animated, ScrollView, StyleSheet, Text, View } from "react-native";

import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { IconButton, useTheme } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";

import { TransactionForm } from "@/src/components/forms/TransactionForm";
import { transactionService } from "@/src/services/transactionService";
import { withAlpha } from "@/src/utils/colors";

// ── Steps Indicator ──────────────────────────────────────────────
function StepsIndicator({ isAr, accent, labelColor }: { isAr: boolean; accent: string; labelColor: string }) {
  const steps = isAr
    ? ["المبلغ", "الفئة", "الحفظ"]
    : ["Amount", "Category", "Save"];

  return (
    <View style={styles.stepsRow}>
      {steps.map((label, i) => (
        <View key={i} style={styles.stepWrap}>
          {/* خط رابط قبل الدائرة */}
          {i > 0 && (
            <View style={[styles.stepLine, { backgroundColor: withAlpha(accent, 0.3) }]} />
          )}
          <View style={styles.stepItem}>
            <View style={[styles.stepCircle, { backgroundColor: withAlpha(accent, 0.15), borderColor: withAlpha(accent, 0.4) }]}>
              <Text style={[styles.stepNum, { color: accent }]}>{i + 1}</Text>
            </View>
            <Text style={[styles.stepLabel, { color: labelColor }]}>{label}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ── الشاشة ───────────────────────────────────────────────────────
export default function AddExpenseScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const theme   = useTheme() as any;
  const accent  = theme.colors.error;
  const headerText = theme.colors.headerText ?? theme.colors.onPrimary;
  const headerStart = theme.colors.headerGradientStart ?? `${accent}55`;
  const headerEnd   = theme.colors.headerGradientEnd ?? `${accent}55`;
  const headerMid   = theme.colors.headerGradientMid ?? `${accent}99`;
  const isAr    = i18n.language === "ar";

  const headerAnim = useRef(new Animated.Value(0)).current;
  const cardAnim   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(80, [
      Animated.spring(headerAnim, { toValue: 1, tension: 60, friction: 12, useNativeDriver: true }),
      Animated.spring(cardAnim,   { toValue: 1, tension: 55, friction: 13, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>

      {/* ── Header بـ Gradient ── */}
      <Animated.View style={{
        opacity: headerAnim,
        transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }],
      }}>
        <LinearGradient
          colors={[headerStart, headerMid, headerEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { shadowColor: theme.colors.shadow ?? headerText }]}
        >
          {/* زر الرجوع */}
          <View style={styles.backRow}>
            <View style={[styles.backBtn, { backgroundColor: withAlpha(headerText, 0.08) }]}>
              <IconButton
                icon={isAr ? "arrow-right" : "arrow-left"}
                iconColor={theme.colors.headerIcon ?? theme.colors.onPrimary}
                size={20}
                style={styles.noMargin}
                onPress={() => router.back()}
              />
            </View>
          </View>

          {/* الأيقونة والعنوان */}
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <LinearGradient
                colors={[`${accent}4D`, `${accent}26`]}
                style={styles.heroIconGradient}
              >
                <IconButton icon="minus-circle" iconColor={accent} size={32} style={styles.noMargin} />
              </LinearGradient>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroTitle, { color: headerText }]}>{t("dashboard.addExpense")}</Text>
              <Text style={[styles.heroSubtitle, { color: withAlpha(headerText, 0.55) }]}>
                {isAr ? "سجّل مصروفك في ثوانٍ" : "Log your expense in seconds"}
              </Text>
            </View>
          </View>

          {/* Steps */}
          <StepsIndicator isAr={isAr} accent={accent} labelColor={withAlpha(headerText, 0.65)} />
        </LinearGradient>
      </Animated.View>

      {/* ── الفورم ── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <Animated.View style={{
          opacity: cardAnim,
          transform: [{ translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [32, 0] }) }],
        }}>
          <View style={[styles.card, {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.outlineVariant,
            // shadow
            shadowColor: accent,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.08,
            shadowRadius: 16,
            elevation: 4,
          }]}>
            <TransactionForm
              kind="expense"
              submitLabel={t("common.save")}
              onSubmit={async ({ amount, categoryId, note }) => {
                try {
                  await transactionService.createTransaction({
                    kind: "expense",
                    amount,
                    categoryId,
                    note,
                    occurredAt: new Date().toISOString(),
                  });
                  router.back();
                } catch (error) {
                  Alert.alert("Error", error instanceof Error ? error.message : "Failed");
                }
              }}
            />
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────
const styles = StyleSheet.create({
  noMargin: { margin: 0 },

  // header
  header: {
    paddingTop: 52,
    paddingBottom: 24,
    paddingHorizontal: 16,
    gap: 16,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },
  backRow: { flexDirection: "row" },
  backBtn: { borderRadius: 12, overflow: "hidden" },

  heroRow:          { flexDirection: "row", alignItems: "center", gap: 14 },
  heroIcon:         { borderRadius: 20, overflow: "hidden" },
  heroIconGradient: { borderRadius: 20, padding: 4 },
  heroTitle:        { fontSize: 24, fontWeight: "900" },
  heroSubtitle:     { fontSize: 13, marginTop: 3, fontWeight: "500" },

  // steps
  stepsRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 4 },
  stepWrap: { flex: 1, flexDirection: "row", alignItems: "center" },
  stepLine: { flex: 1, height: 1.5, marginHorizontal: 4 },
  stepItem: { alignItems: "center", gap: 4 },
  stepCircle: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
  },
  stepNum:   { fontSize: 12, fontWeight: "800" },
  stepLabel: { fontSize: 10, fontWeight: "600" },

  // scroll + card
  scroll: { padding: 16, paddingBottom: 60 },
  card: {
    borderRadius: 28, borderWidth: 1, padding: 20,
  },
});
