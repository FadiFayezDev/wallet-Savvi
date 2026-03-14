import { useRef, useEffect } from "react";
import { Alert, Animated, ScrollView, StyleSheet, Text, View } from "react-native";

import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { IconButton, useTheme } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";

import { TransactionForm } from "@/src/components/forms/TransactionForm";
import { transactionService } from "@/src/services/transactionService";

// ── Steps Indicator ──────────────────────────────────────────────
function StepsIndicator({ isAr }: { isAr: boolean }) {
  const theme = useTheme();
  const steps = isAr
    ? ["المبلغ", "الفئة", "الحفظ"]
    : ["Amount", "Category", "Save"];

  return (
    <View style={styles.stepsRow}>
      {steps.map((label, i) => (
        <View key={i} style={styles.stepWrap}>
          {/* خط رابط قبل الدائرة */}
          {i > 0 && (
            <View style={[styles.stepLine, { backgroundColor: "rgba(248,113,113,0.3)" }]} />
          )}
          <View style={styles.stepItem}>
            <View style={[styles.stepCircle, { backgroundColor: "rgba(248,113,113,0.15)", borderColor: "rgba(248,113,113,0.4)" }]}>
              <Text style={styles.stepNum}>{i + 1}</Text>
            </View>
            <Text style={[styles.stepLabel, { color: "rgba(255,255,255,0.65)" }]}>{label}</Text>
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
  const theme   = useTheme();
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
          colors={["#4a0a0a", "#7f1d1d", "#1c0a0a"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          {/* زر الرجوع */}
          <View style={styles.backRow}>
            <View style={[styles.backBtn, { backgroundColor: "rgba(255,255,255,0.08)" }]}>
              <IconButton
                icon={isAr ? "arrow-right" : "arrow-left"}
                iconColor="rgba(255,255,255,0.7)"
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
                colors={["rgba(248,113,113,0.3)", "rgba(220,38,38,0.15)"]}
                style={styles.heroIconGradient}
              >
                <IconButton icon="minus-circle" iconColor="#F87171" size={32} style={styles.noMargin} />
              </LinearGradient>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>{t("dashboard.addExpense")}</Text>
              <Text style={styles.heroSubtitle}>
                {isAr ? "سجّل مصروفك في ثوانٍ" : "Log your expense in seconds"}
              </Text>
            </View>
          </View>

          {/* Steps */}
          <StepsIndicator isAr={isAr} />
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
            shadowColor: "#F87171",
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
    shadowColor: "#000",
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
  heroTitle:        { fontSize: 24, fontWeight: "900", color: "#fff" },
  heroSubtitle:     { fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: 3, fontWeight: "500" },

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
  stepNum:   { color: "#F87171", fontSize: 12, fontWeight: "800" },
  stepLabel: { fontSize: 10, fontWeight: "600" },

  // scroll + card
  scroll: { padding: 16, paddingBottom: 60 },
  card: {
    borderRadius: 28, borderWidth: 1, padding: 20,
  },
});