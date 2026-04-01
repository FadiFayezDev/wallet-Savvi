import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from 'react-native-paper';

import { categoryService } from '@/src/services/categoryService';
import { transactionService } from '@/src/services/transactionService';
import { useSettingsStore } from '@/src/stores/settingsStore';
import type { Category, Transaction } from '@/src/types/domain';
import { confirmAction } from '@/src/utils/confirm';
import { ComboSelect } from '@/src/components/forms/ComboSelect';

export default function EditTransactionScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const transactionId = Number(params.id);
  const locale = useSettingsStore((s) => s.settings?.locale ?? 'ar');

  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  const load = useCallback(async () => {
    if (!Number.isFinite(transactionId)) return;
    const value = await transactionService.getTransactionById(transactionId);
    if (!value) return;
    setTransaction(value);
    setAmount(String(value.amountAbs));
    setNote(value.note ?? '');
    setCategoryId(value.categoryId);
    const type = value.kind === 'income' ? 'income' : 'expense';
    const categoryRows = await categoryService.listCategories(type);
    setCategories(categoryRows);
  }, [transactionId]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  if (!transaction) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background }}>
        <Text style={{ color: theme.colors.onSurfaceVariant }}>Loading...</Text>
      </View>
    );
  }

  const onSave = async () => {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      Alert.alert('Invalid amount');
      return;
    }
    try {
      await transactionService.updateTransaction({
        id: transaction.id,
        amount: parsed,
        categoryId,
        note: note.trim() || null,
      });
      router.back();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Update failed');
    }
  };

  const onDelete = async () => {
    const ok = await confirmAction({
      title: locale === 'ar' ? 'حذف العملية؟' : 'Delete transaction?',
      message: locale === 'ar'
        ? 'سيتم إلغاء العملية واسترجاع الرصيد.'
        : 'The transaction will be cancelled and refunded.',
      confirmText: locale === 'ar' ? 'حذف' : 'Delete',
      cancelText: locale === 'ar' ? 'إلغاء' : 'Cancel',
      destructive: true,
    });
    if (!ok) return;
    await transactionService.cancelTransaction(
      transaction.id,
      locale === 'ar' ? 'إلغاء العملية' : 'Transaction cancelled'
    );
    router.back();
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: 16, paddingTop: 16 }}
    >
      <View style={{ borderRadius: 16, backgroundColor: theme.colors.surface, padding: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.colors.onSurface }}>Edit Transaction</Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          style={{
            marginTop: 12,
            borderRadius: 12,
            backgroundColor: theme.colors.surfaceVariant,
            paddingHorizontal: 16,
            paddingVertical: 12,
            color: theme.colors.onSurface,
          }}
          placeholder="Amount"
          placeholderTextColor={theme.colors.onSurfaceVariant}
        />
        <TextInput
          value={note}
          onChangeText={setNote}
          style={{
            marginTop: 8,
            borderRadius: 12,
            backgroundColor: theme.colors.surfaceVariant,
            paddingHorizontal: 16,
            paddingVertical: 12,
            color: theme.colors.onSurface,
          }}
          placeholder="Note"
          placeholderTextColor={theme.colors.onSurfaceVariant}
        />
        <ComboSelect
          label={locale === 'ar' ? 'الفئة' : 'Category'}
          placeholder={locale === 'ar' ? 'اختر الفئة' : 'Pick category'}
          value={categoryId}
          options={categories.map((category) => ({
            value: category.id,
            label: locale === 'ar' ? category.nameAr : category.nameEn,
          }))}
          onChange={(value) => setCategoryId(value)}
        />
        <Pressable
          onPress={onSave}
          style={{ marginTop: 16, borderRadius: 12, backgroundColor: theme.colors.primary, paddingVertical: 12 }}>
          <Text style={{ textAlign: 'center', fontWeight: '600', color: theme.colors.onPrimary }}>Save Changes</Text>
        </Pressable>
        <Pressable
          onPress={onDelete}
          style={{ marginTop: 8, borderRadius: 12, backgroundColor: theme.colors.error, paddingVertical: 12 }}>
          <Text style={{ textAlign: 'center', fontWeight: '600', color: theme.colors.onError }}>Delete</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
