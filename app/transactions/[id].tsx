import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from 'react-native-paper';

import { categoryService } from '@/src/services/categoryService';
import { transactionService } from '@/src/services/transactionService';
import type { Category, Transaction } from '@/src/types/domain';
import { confirmAction } from '@/src/utils/confirm';

export default function EditTransactionScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const transactionId = Number(params.id);

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
      title: 'Delete transaction?',
      message: 'This will remove the transaction from your history.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    });
    if (!ok) return;
    await transactionService.softDeleteTransaction(transaction.id);
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
        {/* Category Chips */}
        <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {categories.map((category) => (
            <Pressable
              key={category.id}
              onPress={() => setCategoryId(category.id)}
              style={{
                borderRadius: 100,
                paddingHorizontal: 12,
                paddingVertical: 8,
                backgroundColor: categoryId === category.id ? theme.colors.primary : theme.colors.surfaceVariant,
              }}>
              <Text style={{ color: categoryId === category.id ? theme.colors.onPrimary : theme.colors.onSurfaceVariant }}>
                {category.nameEn}
              </Text>
            </Pressable>
          ))}
        </View>
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
