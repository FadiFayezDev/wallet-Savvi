import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/src/components/common/EmptyState';
import { goalService } from '@/src/services/goalService';
import { useSettingsStore } from '@/src/stores/settingsStore';
import type { GoalDetails } from '@/src/types/domain';
import { formatMoney } from '@/src/utils/money';
import { confirmAction } from '@/src/utils/confirm';

export default function GoalDetailsScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id: string }>();
  const goalId = Number(params.id);
  const settings = useSettingsStore((state) => state.settings);

  const [details, setDetails] = useState<GoalDetails | null>(null);
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [transferAmount, setTransferAmount] = useState('');

  const locale = settings?.locale ?? 'ar';
  const currency = settings?.currencyCode ?? 'EGP';
  const isAr = locale === 'ar';

  const loadDetails = useCallback(async () => {
    if (!Number.isFinite(goalId)) return;
    const payload = await goalService.getGoalDetails(goalId);
    setDetails(payload);
    setName(payload.goal.name);
    setTargetAmount(String(payload.goal.targetAmount));
  }, [goalId]);

  useFocusEffect(
    useCallback(() => {
      loadDetails().catch(() => {
        setDetails(null);
      });
    }, [loadDetails]),
  );

  const progress = useMemo(() => {
    if (!details) return 0;
    if (details.goal.targetAmount <= 0) return 0;
    return Math.min(details.goal.savedAmount / details.goal.targetAmount, 1);
  }, [details]);

  if (!details) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-950">
        <Text className="text-slate-300">{t('common.loading')}</Text>
      </View>
    );
  }

  const onTransfer = async () => {
    const amount = Number(transferAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Invalid transfer amount');
      return;
    }
    try {
      await goalService.transferToGoal({
        goalId,
        amount,
        occurredAt: new Date().toISOString(),
      });
      setTransferAmount('');
      await loadDetails();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Transfer failed');
    }
  };

  const onUpdateGoal = async () => {
    const target = Number(targetAmount);
    if (!name.trim() || !Number.isFinite(target) || target <= 0) {
      Alert.alert('Invalid goal data');
      return;
    }
    try {
      await goalService.updateGoal(goalId, { name: name.trim(), targetAmount: target });
      await loadDetails();
      Alert.alert('Goal updated');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to update');
    }
  };

  const onCancelGoal = async () => {
    try {
      const ok = await confirmAction({
        title: isAr ? 'إلغاء الهدف' : 'Cancel goal',
        message: isAr ? 'سيتم إلغاء الهدف واسترجاع الرصيد للمحفظة.' : 'The goal will be cancelled and refunded to your wallet.',
        confirmText: isAr ? 'إلغاء' : 'Cancel',
        cancelText: isAr ? 'رجوع' : 'Back',
        destructive: true,
      });
      if (!ok) return;
      await goalService.cancelGoal(goalId);
      await loadDetails();
      Alert.alert('Goal cancelled');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to cancel');
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#020617' }}
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 }}
    >
      <View className="rounded-2xl bg-slate-900 p-4">
        <Text className="text-xl font-bold text-white">{details.goal.name}</Text>
        <Text className="mt-2 text-slate-200">
          {t('goals.saved')}: {formatMoney(details.goal.savedAmount, locale, currency)}
        </Text>
        <Text className="text-slate-400">
          {t('goals.remaining')}:{' '}
          {formatMoney(Math.max(details.goal.targetAmount - details.goal.savedAmount, 0), locale, currency)}
        </Text>
        <View className="mt-3 h-3 rounded-full bg-slate-700">
          <View
            className="h-3 rounded-full bg-emerald-500"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </View>
        <Text className="mt-1 text-right text-slate-400">{Math.round(progress * 100)}%</Text>
      </View>

      <View className="mt-4 rounded-2xl bg-slate-900 p-4">
        <Text className="text-base font-bold text-white">{t('goals.transfer')}</Text>
        <TextInput
          value={transferAmount}
          onChangeText={setTransferAmount}
          placeholder={t('goals.transferAmount')}
          keyboardType="decimal-pad"
          placeholderTextColor="#64748b"
          className="mt-2 rounded-xl bg-slate-800 px-4 py-3 text-white"
        />
        <Pressable onPress={onTransfer} className="mt-3 rounded-xl bg-emerald-500 py-3">
          <Text className="text-center font-semibold text-white">{t('goals.transfer')}</Text>
        </Pressable>
      </View>

      <View className="mt-4 rounded-2xl bg-slate-900 p-4">
        <Text className="text-base font-bold text-white">{t('goals.updateGoal')}</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t('goals.goalName')}
          placeholderTextColor="#64748b"
          className="mt-2 rounded-xl bg-slate-800 px-4 py-3 text-white"
        />
        <TextInput
          value={targetAmount}
          onChangeText={setTargetAmount}
          placeholder={t('goals.targetAmount')}
          keyboardType="decimal-pad"
          placeholderTextColor="#64748b"
          className="mt-2 rounded-xl bg-slate-800 px-4 py-3 text-white"
        />
        <Pressable onPress={onUpdateGoal} className="mt-3 rounded-xl bg-indigo-500 py-3">
          <Text className="text-center font-semibold text-white">{t('goals.updateGoal')}</Text>
        </Pressable>
        <Pressable onPress={onCancelGoal} className="mt-3 rounded-xl bg-rose-500 py-3">
          <Text className="text-center font-semibold text-white">{t('goals.cancelGoal')}</Text>
        </Pressable>
      </View>

      <View className="mb-12 mt-4 rounded-2xl bg-slate-900 p-4">
        <Text className="text-base font-bold text-white">{t('goals.history')}</Text>
        <View className="mt-3 gap-2">
          {details.transfers.length === 0 ? (
            <EmptyState title={t('common.noData')} />
          ) : (
            details.transfers.map((row) => (
              <View key={row.id} className="rounded-xl bg-slate-800 px-4 py-3">
                <Text className="text-slate-200">{row.action}</Text>
                <Text className={row.action === 'transfer' ? 'text-rose-400' : 'text-emerald-400'}>
                  {formatMoney(row.action === 'transfer' ? -row.amount : row.amount, locale, currency, true)}
                </Text>
                <Text className="text-xs text-slate-500">{row.transactionOccurredAt}</Text>
              </View>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}
