import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from 'react-native-paper';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';

import { categoryService } from '@/src/services/categoryService';
import type { Category, TransactionKind } from '@/src/types/domain';

interface TransactionFormProps {
  kind: Extract<TransactionKind, 'income' | 'expense'>;
  onSubmit: (input: { amount: number; categoryId: number | null; note: string | null }) => Promise<void>;
  submitLabel: string;
}

export function TransactionForm({ kind, onSubmit, submitLabel }: TransactionFormProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const isFocused = useIsFocused();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const locale = i18n.language.startsWith('ar') ? 'ar' : 'en';
  const isIncome = kind === 'income';

  // income = primary, expense = error
  const accentColor = isIncome ? theme.colors.primary : theme.colors.error;
  const onAccentColor = isIncome ? theme.colors.onPrimary : theme.colors.onError;

  useEffect(() => {
    if (!isFocused) return;
    categoryService
      .listCategories(kind)
      .then((rows) => {
        setCategories(rows);
        if (rows.length > 0) {
          setSelectedCategory((prev) => prev ?? rows[0].id);
        }
      })
      .catch(() => setCategories([]));
  }, [kind, isFocused]);

  const parsedAmount = useMemo(() => Number(amount), [amount]);

  const submit = async () => {
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid amount', 'Please enter an amount greater than zero.');
      return;
    }
    if (!selectedCategory) {
      Alert.alert(
        locale === 'ar' ? 'اختر الفئة' : 'Pick a category',
        locale === 'ar' ? 'اختيار الفئة مطلوب قبل الحفظ.' : 'Category is required before saving.',
      );
      return;
    }

    setIsSaving(true);
    try {
      await onSubmit({
        amount: parsedAmount,
        categoryId: selectedCategory,
        note: note.trim() ? note.trim() : null,
      });
      setAmount('');
      setNote('');
      setSelectedCategory(null);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : t('errors.generic'));
    } finally {
      setIsSaving(false);
    }
  };

  const inputStyle = {
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceVariant,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: theme.colors.onSurface,
  };

  return (
    <View style={{ gap: 16, borderRadius: 16, backgroundColor: theme.colors.background, padding: 16 }}>
      {/* Amount */}
      <View>
        <Text style={{ marginBottom: 4, fontSize: 13, color: theme.colors.onSurfaceVariant }}>
          {locale === 'ar' ? 'المبلغ (مطلوب)' : 'Amount (required)'}
        </Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          placeholder={locale === 'ar' ? 'مثال: 250' : 'Example: 250'}
          keyboardType="decimal-pad"
          returnKeyType="done"
          style={{ ...inputStyle, fontSize: 18 }}
          placeholderTextColor={theme.colors.onSurfaceVariant}
        />
      </View>

      {/* Note */}
      <View>
        <Text style={{ marginBottom: 4, fontSize: 13, color: theme.colors.onSurfaceVariant }}>
          {locale === 'ar' ? 'الوصف (اختياري)' : 'Note (optional)'}
        </Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder={locale === 'ar' ? 'سبب العملية أو ملاحظة' : 'What is this for?'}
          style={inputStyle}
          placeholderTextColor={theme.colors.onSurfaceVariant}
        />
      </View>

      {/* Category label */}
      <View>
        <Text style={{ marginBottom: 4, fontSize: 13, color: theme.colors.onSurfaceVariant }}>
          {locale === 'ar'
            ? `فئة ${isIncome ? 'الدخل' : 'المصروف'} (مطلوب)`
            : `${isIncome ? 'Income' : 'Expense'} category (required)`}
        </Text>
        <Text style={{ marginBottom: 8, fontSize: 12, color: theme.colors.outline }}>
          {locale === 'ar'
            ? 'اختر الفئة الصحيحة لضمان تقارير دقيقة.'
            : 'Select the right category for accurate reports.'}
        </Text>
      </View>

      {/* Category Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: -8 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            onPress={() => router.push({ pathname: '/categories/manage', params: { tab: kind } })}
            style={{
              borderRadius: 100,
              borderWidth: 1,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderColor: theme.colors.outlineVariant,
              backgroundColor: theme.colors.surfaceVariant,
            }}
          >
            <Text style={{ color: theme.colors.onSurfaceVariant }}>
              {locale === 'ar' ? '+ إضافة فئة' : '+ Add category'}
            </Text>
          </Pressable>
          {categories.map((category) => {
            const selected = selectedCategory === category.id;
            const title = locale === 'ar' ? category.nameAr : category.nameEn;
            return (
              <Pressable
                key={category.id}
                onPress={() => setSelectedCategory(category.id)}
                style={{
                  borderRadius: 100,
                  borderWidth: 1,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderColor: selected ? accentColor : theme.colors.outlineVariant,
                  backgroundColor: selected ? (isIncome ? theme.colors.primaryContainer : theme.colors.errorContainer) : theme.colors.surfaceVariant,
                }}>
                <Text style={{ color: selected ? (isIncome ? theme.colors.onPrimaryContainer : theme.colors.onErrorContainer) : theme.colors.onSurfaceVariant }}>
                  {title}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Quick Summary */}
      <View style={{
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.colors.outlineVariant,
        backgroundColor: theme.colors.surface,
        paddingHorizontal: 12,
        paddingVertical: 8,
      }}>
        <Text style={{ fontSize: 12, color: theme.colors.onSurfaceVariant }}>
          {locale === 'ar' ? 'ملخص سريع' : 'Quick summary'}
        </Text>
        <Text style={{ fontSize: 14, color: theme.colors.onSurface }}>
          {locale === 'ar'
            ? `${isIncome ? 'دخل' : 'مصروف'} بقيمة ${amount || '0'}`
            : `${isIncome ? 'Income' : 'Expense'} amount: ${amount || '0'}`}
        </Text>
      </View>

      {/* Submit */}
      <Pressable
        onPress={submit}
        disabled={isSaving}
        style={{
          borderRadius: 12,
          paddingVertical: 12,
          backgroundColor: accentColor,
          opacity: isSaving ? 0.6 : 1,
        }}>
        <Text style={{ textAlign: 'center', fontWeight: 'bold', color: onAccentColor }}>{submitLabel}</Text>
      </Pressable>
    </View>
  );
}
