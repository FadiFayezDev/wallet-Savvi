import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Animated, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';

import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { IconButton, useTheme } from 'react-native-paper';

import { EmptyState } from '@/src/components/common/EmptyState';
import { goalService } from '@/src/services/goalService';
import { useSettingsStore } from '@/src/stores/settingsStore';
import type { Goal } from '@/src/types/domain';
import { formatMoney } from '@/src/utils/money';

// ── بطاقة هدف واحد مع أنيميشن ──────────────────────────────────
function GoalCard({
  goal, index, locale, currency, onPress,
}: {
  goal: Goal; index: number; locale: 'ar' | 'en'; currency: string; onPress: () => void;
}) {
  const theme    = useTheme();
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

  const barColor = isDone ? '#4ADE80' : theme.colors.primary;

  return (
    <Animated.View style={{
      opacity: anim,
      transform: [
        { scale: scaleRef },
        { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
      ],
    }}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[styles.card, {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.outlineVariant,
        }]}
      >
        {/* الاسم + النسبة */}
        <View style={styles.cardRow}>
          <Text style={[styles.goalName, { color: theme.colors.onSurface }]} numberOfLines={1}>
            {goal.name}
          </Text>
          <View style={[styles.percentBadge, {
            backgroundColor: isDone ? 'rgba(74,222,128,0.12)' : `${theme.colors.primary}18`,
          }]}>
            <Text style={[styles.percentText, { color: isDone ? '#4ADE80' : theme.colors.primary }]}>
              {Math.round(progress * 100)}%
            </Text>
          </View>
        </View>

        {/* شريط التقدم */}
        <View style={[styles.track, { backgroundColor: theme.colors.surfaceVariant, marginTop: 12 }]}>
          <Animated.View style={[styles.fill, { backgroundColor: barColor, width: `${Math.round(progress * 100)}%` }]} />
        </View>

        {/* الأرقام */}
        <View style={[styles.cardRow, { marginTop: 10 }]}>
          <Text style={[styles.moneyLabel, { color: theme.colors.onSurfaceVariant }]}>
            {formatMoney(goal.savedAmount, locale, currency)}
          </Text>
          <Text style={[styles.moneyLabel, { color: theme.colors.onSurfaceVariant }]}>
            / {formatMoney(goal.targetAmount, locale, currency)}
          </Text>
        </View>

        {isDone && (
          <Text style={styles.doneTag}>✓ مكتمل</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ── الشاشة الرئيسية ──────────────────────────────────────────────
export default function GoalsTab() {
  const router   = useRouter();
  const { t }    = useTranslation();
  const theme    = useTheme();
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

  const inputStyle = (active: boolean) => ([
    styles.input,
    {
      backgroundColor: theme.colors.surfaceVariant,
      color: theme.colors.onSurface,
      borderColor: active ? theme.colors.primary : 'transparent',
    },
  ]);

  const safeGoals = goals.filter((g): g is Goal => Boolean(g && g.name));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={[styles.scroll, { paddingTop: 16 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── فورم إضافة هدف ── */}
      <View style={[styles.formCard, {
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.outlineVariant,
      }]}>
        <Text style={[styles.formTitle, { color: theme.colors.onSurface }]}>
          {t('goals.newGoal')}
        </Text>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t('goals.goalName')}
          placeholderTextColor={theme.colors.onSurfaceVariant}
          onFocus={() => setFocused('name')}
          onBlur={() => setFocused(null)}
          style={inputStyle(focused === 'name')}
        />

        <TextInput
          value={target}
          onChangeText={setTarget}
          placeholder={t('goals.targetAmount')}
          keyboardType="decimal-pad"
          placeholderTextColor={theme.colors.onSurfaceVariant}
          onFocus={() => setFocused('amount')}
          onBlur={() => setFocused(null)}
          style={inputStyle(focused === 'amount')}
        />

        <Pressable
          onPress={createGoal}
          style={[styles.saveBtn, { backgroundColor: theme.colors.primary }]}
        >
          <IconButton icon="plus" iconColor={theme.colors.onPrimary} size={18} style={styles.noMargin} />
          <Text style={[styles.saveBtnText, { color: theme.colors.onPrimary }]}>
            {t('common.save')}
          </Text>
        </Pressable>
      </View>

      {/* ── قائمة الأهداف ── */}
      <View style={styles.list}>
        {safeGoals.length === 0 ? (
          <EmptyState title={t('common.noData')} />
        ) : (
          safeGoals.map((goal, i) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              index={i}
              locale={locale}
              currency={currency}
              onPress={() => router.push({ pathname: '/goals/[id]', params: { id: String(goal.id) } })}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

// ── Styles ───────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 80, gap: 16 },

  // فورم
  formCard: {
    borderRadius: 24, padding: 18,
    borderWidth: 1, gap: 10,
  },
  formTitle: { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  input: {
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13,
    fontSize: 14, borderWidth: 1.5,
  },
  saveBtn: {
    marginTop: 4, borderRadius: 14, paddingVertical: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  saveBtnText: { fontWeight: '700', fontSize: 14 },
  noMargin: { margin: 0 },

  // list
  list: { gap: 10, marginBottom: 32 },

  // card
  card: {
    borderRadius: 20, padding: 16, borderWidth: 1,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  goalName: { fontSize: 15, fontWeight: '700', flex: 1, marginEnd: 8 },
  percentBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  percentText:  { fontSize: 12, fontWeight: '800' },
  track: { height: 7, borderRadius: 999, overflow: 'hidden' },
  fill:  { height: '100%', borderRadius: 999 },
  moneyLabel: { fontSize: 12, fontWeight: '600' },
  doneTag: {
    marginTop: 8, alignSelf: 'flex-start',
    color: '#4ADE80', fontSize: 11, fontWeight: '700',
  },
});
