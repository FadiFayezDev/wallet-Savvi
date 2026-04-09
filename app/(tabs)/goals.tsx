import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Animated,
  StyleSheet, View,
} from 'react-native';

import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Card,
  ProgressBar,
  Surface,
  Text,
  TextInput,
  TouchableRipple,
  useTheme,
} from 'react-native-paper';

import { EmptyState } from '@/src/components/common/EmptyState';
import { MaterialScreen } from '@/src/components/layout/MaterialScreen';
import { goalService } from '@/src/services/goalService';
import { useSettingsStore } from '@/src/stores/settingsStore';
import type { AppTheme } from '@/src/types/appTheme';
import type { Goal } from '@/src/types/domain';
import { withAlpha } from '@/src/utils/colors';
import { formatMoney } from '@/src/utils/money';

// ── بطاقة هدف واحد مع أنيميشن ──────────────────────────────────
function GoalCard({
  goal, index, locale, currency, onPress,
}: {
  goal: Goal; index: number; locale: 'ar' | 'en'; currency: string; onPress: () => void;
}) {
  const theme    = useTheme<AppTheme>();
  const anim     = useRef(new Animated.Value(0)).current;
  const scaleRef = useRef(new Animated.Value(1)).current;

  const progress = goal.targetAmount > 0
    ? Math.min(goal.savedAmount / goal.targetAmount, 1) : 0;
  const isDone = progress >= 1;

  // entrance stagger
  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1, tension: 60, friction: 12,
      delay: index * 60, useNativeDriver: true,
    }).start();
  }, [anim, index]);

  const onPressIn  = () => Animated.spring(scaleRef, { toValue: 0.97, useNativeDriver: true, tension: 200, friction: 10 }).start();
  const onPressOut = () => Animated.spring(scaleRef, { toValue: 1,    useNativeDriver: true, tension: 200, friction: 10 }).start();

  const barColor = isDone ? (theme.colors.success ?? theme.colors.secondary) : theme.colors.primary;

  return (
    <Animated.View style={{
      opacity: anim,
      transform: [
        { scale: scaleRef },
        { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
      ],
    }}>
      <TouchableRipple
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        borderless={false}
        style={[styles.cardRipple, { borderRadius: 20 }]}
      >
        <Surface
          elevation={0}
          style={[styles.card, {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.outlineVariant,
          }]}
        >
          {/* الاسم + النسبة */}
          <View style={styles.cardRow}>
            <Text variant="titleMedium" style={[styles.goalName, { color: theme.colors.onSurface }]} numberOfLines={1}>
              {goal.name}
            </Text>
            <Surface
              elevation={0}
              style={[styles.percentBadge, {
                backgroundColor: isDone
                  ? withAlpha(theme.colors.success ?? theme.colors.secondary, 0.12)
                  : withAlpha(theme.colors.primary, 0.12),
              }]}
            >
              <Text variant="labelLarge" style={[styles.percentText, { color: isDone ? (theme.colors.success ?? theme.colors.secondary) : theme.colors.primary }]}>
                {Math.round(progress * 100)}%
              </Text>
            </Surface>
          </View>

          <ProgressBar
            progress={progress}
            color={barColor}
            style={[styles.track, { marginTop: 12, backgroundColor: theme.colors.surfaceVariant }]}
          />

          {/* الأرقام */}
          <View style={[styles.cardRow, { marginTop: 10 }]}>
            <Text variant="bodySmall" style={[styles.moneyLabel, { color: theme.colors.onSurfaceVariant }]}>
              {formatMoney(goal.savedAmount, locale, currency)}
            </Text>
            <Text variant="bodySmall" style={[styles.moneyLabel, { color: theme.colors.onSurfaceVariant }]}>
              / {formatMoney(goal.targetAmount, locale, currency)}
            </Text>
          </View>

          {isDone && (
            <Text variant="labelLarge" style={[styles.doneTag, { color: theme.colors.success }]}>✓ مكتمل</Text>
          )}
        </Surface>
      </TouchableRipple>
    </Animated.View>
  );
}

// ── الشاشة الرئيسية ──────────────────────────────────────────────
export default function GoalsTab() {
  const router   = useRouter();
  const { t }    = useTranslation();
  const theme    = useTheme<AppTheme>();
  const settings = useSettingsStore((s) => s.settings);

  const [goals,  setGoals]  = useState<Goal[]>([]);
  const [name,   setName]   = useState('');
  const [target, setTarget] = useState('');
  const [focused, setFocused] = useState<'name' | 'amount' | null>(null);

  const locale: 'ar' | 'en' = settings?.locale ?? 'ar';
  const currency = settings?.currencyCode ?? 'EGP';

  const loadGoals = useCallback(() => {
    goalService.listGoals().then(setGoals).catch(() => setGoals([]));
  }, []);

  useFocusEffect(useCallback(() => { loadGoals(); }, [loadGoals]));

  const createGoal = async () => {
    const amount = Number(target);
    if (!name.trim() || !Number.isFinite(amount) || amount <= 0) {
      Alert.alert('بيانات غير صحيحة');
      return;
    }
    try {
      await goalService.createGoal({ name: name.trim(), targetAmount: amount });
      setName(''); setTarget('');
      loadGoals();
    } catch (err) {
      Alert.alert('خطأ', err instanceof Error ? err.message : 'فشل الإنشاء');
    }
  };

  const safeGoals = goals.filter((g): g is Goal => Boolean(g && g.name));

  return (
    <MaterialScreen title={t("tabs.goals")} layout="tab">
      <Card mode="elevated" elevation={1} className='py-3 mb-8 ' style={{ borderRadius: theme.roundness * 2 }}>
        <Card.Content style={styles.formInner}>
          <Text variant="titleMedium" style={[styles.formTitle, { color: theme.colors.onSurface }]}>
            {t("goals.newGoal")}
          </Text>

          <TextInput
            mode="outlined"
            value={name}
            onChangeText={setName}
            placeholder={t("goals.goalName")}
            onFocus={() => setFocused("name")}
            onBlur={() => setFocused(null)}
            outlineColor={focused === "name" ? theme.colors.primary : theme.colors.outline}
            activeOutlineColor={theme.colors.primary}
            style={styles.paperInput}
          />

          <TextInput
            mode="outlined"
            value={target}
            onChangeText={setTarget}
            placeholder={t("goals.targetAmount")}
            keyboardType="decimal-pad"
            onFocus={() => setFocused("amount")}
            onBlur={() => setFocused(null)}
            outlineColor={focused === "amount" ? theme.colors.primary : theme.colors.outline}
            activeOutlineColor={theme.colors.primary}
            style={styles.paperInput}
          />

          <Button mode="contained" icon="plus" onPress={createGoal} style={styles.saveBtn}>
            {t("common.save")}
          </Button>
        </Card.Content>
      </Card>

      <View style={styles.list} className="overflow-auto">
        {safeGoals.length === 0 ? (
          <EmptyState title={t("common.noData")} />
        ) : (
          safeGoals.map((goal, i) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              index={i}
              locale={locale}
              currency={currency}
              onPress={() => router.push({ pathname: "/goals/[id]", params: { id: String(goal.id) } })}
            />
          ))
        )}
      </View>
    </MaterialScreen>
  );
}

// ── Styles ───────────────────────────────────────────────────────
const styles = StyleSheet.create({
  formInner: { gap: 10, paddingVertical: 4 },
  formTitle: { marginBottom: 2 },
  paperInput: { backgroundColor: "transparent" },
  saveBtn: {
    marginTop: 4,
    borderRadius: 14,
  },

  // list
  list: { gap: 10, marginBottom: 32 },

  // card
  cardRipple: { overflow: 'hidden' },
  card: {
    borderRadius: 20, padding: 16, borderWidth: 1,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  goalName: { flex: 1, marginEnd: 8 },
  percentBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  percentText:  { fontWeight: '800' },
  track: { height: 7, borderRadius: 999, overflow: 'hidden' },
  moneyLabel: { fontWeight: '600' },
  doneTag: {
    marginTop: 8, alignSelf: 'flex-start',
    fontSize: 11, fontWeight: '700',
  },
});
