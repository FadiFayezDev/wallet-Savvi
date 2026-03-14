import { useEffect, useRef } from "react";
import { Alert, Animated, ScrollView, StyleSheet, Text, View } from "react-native";

import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { IconButton, useTheme } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";

import { TransactionForm } from "@/src/components/forms/TransactionForm";
import { transactionService } from "@/src/services/transactionService";

function StepsIndicator({ isAr }: { isAr: boolean }) {
  const steps = isAr ? ["المبلغ", "الفئة", "الحفظ"] : ["Amount", "Category", "Save"];
  return (
    <View style={styles.stepsRow}>
      {steps.map((label, i) => (
        <View key={i} style={styles.stepWrap}>
          {i > 0 && <View style={[styles.stepLine, { backgroundColor: "rgba(74,222,128,0.3)" }]} />}
          <View style={styles.stepItem}>
            <View style={styles.stepCircle}>
              <Text style={styles.stepNum}>{i + 1}</Text>
            </View>
            <Text style={styles.stepLabel}>{label}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export default function AddIncomeScreen() {
  const router      = useRouter();
  const { t, i18n } = useTranslation();
  const theme       = useTheme();
  const isAr        = i18n.language === "ar";

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

      {/* ── Header ── */}
      <Animated.View style={{
        opacity: headerAnim,
        transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }],
      }}>
        <LinearGradient
          colors={["#052e16", "#14532d", "#052e16"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.backRow}>
            <View style={styles.backBtn}>
              <IconButton
                icon={isAr ? "arrow-right" : "arrow-left"}
                iconColor="rgba(255,255,255,0.7)"
                size={20}
                style={styles.noMargin}
                onPress={() => router.back()}
              />
            </View>
          </View>

          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <LinearGradient
                colors={["rgba(74,222,128,0.3)", "rgba(34,197,94,0.15)"]}
                style={styles.heroIconGradient}
              >
                <IconButton icon="plus-circle" iconColor="#4ADE80" size={32} style={styles.noMargin} />
              </LinearGradient>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>{t("dashboard.addIncome")}</Text>
              <Text style={styles.heroSubtitle}>
                {isAr ? "سجّل دخلك في ثوانٍ" : "Log your income in seconds"}
              </Text>
            </View>
          </View>

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
            shadowColor: "#4ADE80",
          }]}>
            <TransactionForm
              kind="income"
              submitLabel={t("common.save")}
              onSubmit={async ({ amount, categoryId, note }) => {
                try {
                  await transactionService.createTransaction({
                    kind: "income",
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

const styles = StyleSheet.create({
  noMargin: { margin: 0 },

  header: {
    paddingTop: 52, paddingBottom: 24, paddingHorizontal: 16, gap: 16,
    borderBottomLeftRadius: 32, borderBottomRightRadius: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 20, elevation: 10,
  },
  backRow: { flexDirection: "row" },
  backBtn: { borderRadius: 12, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.08)" },

  heroRow:          { flexDirection: "row", alignItems: "center", gap: 14 },
  heroIcon:         { borderRadius: 20, overflow: "hidden" },
  heroIconGradient: { borderRadius: 20, padding: 4 },
  heroTitle:        { fontSize: 24, fontWeight: "900", color: "#fff" },
  heroSubtitle:     { fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: 3, fontWeight: "500" },

  stepsRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 4 },
  stepWrap: { flex: 1, flexDirection: "row", alignItems: "center" },
  stepLine: { flex: 1, height: 1.5, marginHorizontal: 4 },
  stepItem: { alignItems: "center", gap: 4 },
  stepCircle: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "rgba(74,222,128,0.4)",
    backgroundColor: "rgba(74,222,128,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  stepNum:   { color: "#4ADE80", fontSize: 12, fontWeight: "800" },
  stepLabel: { color: "rgba(255,255,255,0.65)", fontSize: 10, fontWeight: "600" },

  scroll: { padding: 16, paddingBottom: 60 },
  card: {
    borderRadius: 28, borderWidth: 1, padding: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 16, elevation: 4,
  },
});