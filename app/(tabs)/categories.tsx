import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Animated, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';

import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { IconButton, useTheme } from 'react-native-paper';

import { EmptyState } from '@/src/components/common/EmptyState';
import { categoryService } from '@/src/services/categoryService';
import { useSettingsStore } from '@/src/stores/settingsStore';
import type { Category } from '@/src/types/domain';
import { confirmAction } from '@/src/utils/confirm';

type CategoryTab = 'expense' | 'income';

const withAlpha = (color: string, alpha: number) => {
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const full = hex.length === 3
      ? hex.split('').map((c) => c + c).join('')
      : hex;
    if (full.length >= 6) {
      const r = parseInt(full.slice(0, 2), 16);
      const g = parseInt(full.slice(2, 4), 16);
      const b = parseInt(full.slice(4, 6), 16);
      return `rgba(${r},${g},${b},${alpha})`;
    }
  }
  if (color.startsWith('rgb(')) {
    return color.replace('rgb(', 'rgba(').replace(')', `,${alpha})`);
  }
  if (color.startsWith('rgba(')) {
    return color.replace(/rgba\(([^,]+),([^,]+),([^,]+),[^\)]+\)/, `rgba($1,$2,$3,${alpha})`);
  }
  return color;
};

// ── بطاقة فئة واحدة ─────────────────────────────────────────────
function CategoryCard({
  item, locale, activeColor, onEdit, onDelete,
}: {
  item: Category;
  locale: string;
  activeColor: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const theme  = useTheme();
  const scaleA = useRef(new Animated.Value(1)).current;

  const onPressIn  = () => Animated.spring(scaleA, { toValue: 0.97, useNativeDriver: true, tension: 200, friction: 10 }).start();
  const onPressOut = () => Animated.spring(scaleA, { toValue: 1,    useNativeDriver: true, tension: 200, friction: 10 }).start();

  return (
    <Animated.View style={{ transform: [{ scale: scaleA }] }}>
      <View style={[styles.categoryCard, {
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.outlineVariant,
      }]}>
        {/* شريط اللون الجانبي */}
        <View style={[styles.colorBar, { backgroundColor: activeColor }]} />

        <View style={{ flex: 1 }}>
          <Text style={[styles.categoryName, { color: theme.colors.onSurface }]}>
            {locale === 'ar' ? item.nameAr : item.nameEn}
          </Text>
        </View>

        {/* أزرار */}
        <View style={styles.cardActions}>
          <Pressable
            onPress={onEdit}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            style={[styles.actionBtn, { backgroundColor: withAlpha(theme.colors.primary, 0.14) }]}
          >
            <IconButton icon="pencil-outline" iconColor={theme.colors.primary} size={16} style={styles.noMargin} />
          </Pressable>
          <Pressable
            onPress={onDelete}
            style={[styles.actionBtn, { backgroundColor: withAlpha(theme.colors.error, 0.14) }]}
          >
            <IconButton icon="trash-can-outline" iconColor={theme.colors.error} size={16} style={styles.noMargin} />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

// ── الشاشة الرئيسية ──────────────────────────────────────────────
export default function CategoriesTabScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const settings = useSettingsStore((s) => s.settings);
  const locale   = settings?.locale ?? 'ar';
  const theme    = useTheme();
  const isAr     = locale === 'ar';

  const [categories,      setCategories]      = useState<Category[]>([]);
  const [activeTab,       setActiveTab]       = useState<CategoryTab>('expense');
  const [name,            setName]            = useState('');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [focused,         setFocused]         = useState<'name' | null>(null);

  const tabAnim = useRef(new Animated.Value(0)).current; // 0=expense, 1=income
  const didInitFromParam = useRef(false);

  const expenseColor = '#F87171';
  const incomeColor  = '#4ADE80';
  const expenseOn    = '#111827';
  const incomeOn     = '#064E3B';
  const activeColor  = activeTab === 'income' ? incomeColor : expenseColor;
  const activeOn     = activeTab === 'income' ? incomeOn : expenseOn;

  const loadCategories = useCallback(async () => {
    const rows = await categoryService.listCategories();
    setCategories(rows);
  }, []);

  useFocusEffect(useCallback(() => {
    loadCategories().catch(() => setCategories([]));
  }, [loadCategories]));

  const filtered = useMemo(
    () => categories.filter((c) => c.type === activeTab || c.type === 'both'),
    [activeTab, categories],
  );

  const switchTab = (tab: CategoryTab, opts: { reset?: boolean } = {}) => {
    Animated.spring(tabAnim, {
      toValue: tab === 'income' ? 1 : 0,
      tension: 80, friction: 12, useNativeDriver: false,
    }).start();
    setActiveTab(tab);
    if (opts.reset !== false) resetForm();
  };

  const resetForm = () => { setName(''); setEditingCategory(null); };

  const submit = async () => {
    if (!name.trim()) {
      Alert.alert(isAr ? 'أدخل الاسم' : 'Please enter a name');
      return;
    }
    try {
      if (editingCategory) {
        await categoryService.updateCategory(editingCategory.id, {
          nameAr: name.trim(), nameEn: name.trim(), type: activeTab,
        });
      } else {
        await categoryService.createCategory({
          nameAr: name.trim(), nameEn: name.trim(), type: activeTab,
        });
      }
      await loadCategories();
      resetForm();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed');
    }
  };

  const inputStyle = (active: boolean) => ([
    styles.input,
    {
      backgroundColor: theme.colors.surfaceVariant,
      color: theme.colors.onSurface,
      borderColor: active ? activeColor : 'transparent',
    },
  ]);

  // ── Animated tab indicator ──
  const indicatorLeft = tabAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '50%'] });

  useEffect(() => {
    if (didInitFromParam.current) return;
    const requested = params?.tab === 'income' || params?.tab === 'expense' ? params.tab : null;
    if (!requested || requested === activeTab) {
      didInitFromParam.current = true;
      return;
    }
    switchTab(requested);
    didInitFromParam.current = true;
  }, [params?.tab, activeTab]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={[styles.scroll, { paddingTop: 16 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── عنوان ── */}
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: theme.colors.onSurface }]}>
          {isAr ? 'الفئات' : 'Categories'}
        </Text>
        <View style={[styles.countBadge, { backgroundColor: withAlpha(activeColor, 0.14) }]}>
          <Text style={[styles.countText, { color: activeColor }]}>{filtered.length}</Text>
        </View>
      </View>

      {/* ── Tabs بـ animated indicator ── */}
      <View style={[styles.tabsWrap, { backgroundColor: theme.colors.surfaceVariant }]}>
        {/* indicator متحرك */}
        <Animated.View style={[
          styles.tabIndicator,
          { backgroundColor: activeColor, left: indicatorLeft },
        ]} />

        {(['expense', 'income'] as CategoryTab[]).map((tab) => {
          const isActive = activeTab === tab;
          const color    = tab === 'income' ? incomeColor : expenseColor;
          return (
            <Pressable key={tab} onPress={() => switchTab(tab)} style={styles.tabBtn}>
              <IconButton
                icon={tab === 'income' ? 'trending-up' : 'trending-down'}
                iconColor={isActive ? (tab === 'income' ? incomeOn : expenseOn) : theme.colors.onSurfaceVariant}
                size={16} style={styles.noMargin}
              />
              <Text style={[styles.tabText, {
                color: isActive ? (tab === 'income' ? incomeOn : expenseOn) : theme.colors.onSurfaceVariant,
              }]}>
                {tab === 'income'
                  ? (isAr ? 'دخل' : 'Income')
                  : (isAr ? 'مصروف' : 'Expense')}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ── فورم ── */}
      <View style={[styles.formCard, {
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.outlineVariant,
      }]}>
        <Text style={[styles.formTitle, { color: theme.colors.onSurface }]}>
          {editingCategory
            ? (isAr ? '✏ تعديل فئة' : '✏ Edit Category')
            : (isAr ? '+ فئة جديدة' : '+ New Category')}
        </Text>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={isAr ? 'اسم الفئة' : 'Category name'}
          placeholderTextColor={theme.colors.onSurfaceVariant}
          onFocus={() => setFocused('name')}
          onBlur={() => setFocused(null)}
          style={inputStyle(focused === 'name')}
        />

        <View style={styles.formBtns}>
          <Pressable
            onPress={submit}
            style={[styles.submitBtn, { backgroundColor: activeColor, flex: 1 }]}
          >
            <Text style={[styles.submitText, { color: activeOn }]}>
              {editingCategory ? (isAr ? 'حفظ' : 'Save') : (isAr ? 'إضافة' : 'Add')}
            </Text>
          </Pressable>

          {editingCategory && (
            <Pressable
              onPress={resetForm}
              style={[styles.cancelBtn, { backgroundColor: theme.colors.surfaceVariant }]}
            >
              <Text style={[styles.cancelText, { color: theme.colors.onSurfaceVariant }]}>
                {isAr ? 'إلغاء' : 'Cancel'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* ── القائمة ── */}
      <View style={styles.list}>
        {filtered.length === 0 ? (
          <EmptyState title={isAr ? 'لا توجد فئات بعد' : 'No categories yet'} />
        ) : (
          filtered.map((item) => (
            <CategoryCard
              key={item.id}
              item={item}
              locale={locale}
              activeColor={activeColor}
              onEdit={() => {
                const targetTab = item.type === 'income' ? 'income' : 'expense';
                if (targetTab !== activeTab) {
                  switchTab(targetTab, { reset: false });
                }
                setEditingCategory(item);
                setName(locale === 'ar' ? item.nameAr : item.nameEn);
              }}
              onDelete={async () => {
                const ok = await confirmAction({
                  title: isAr ? 'حذف الفئة؟' : 'Delete category?',
                  message: isAr ? 'سيتم حذف الفئة نهائيا.' : 'This will permanently delete the category.',
                  confirmText: isAr ? 'حذف' : 'Delete',
                  cancelText: isAr ? 'إلغاء' : 'Cancel',
                  destructive: true,
                });
                if (!ok) return;
                await categoryService.deleteCategory(item.id);
                await loadCategories();
              }}
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

  titleRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title:     { fontSize: 26, fontWeight: '900' },
  countBadge:{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  countText: { fontSize: 13, fontWeight: '800' },

  // tabs
  tabsWrap: {
    flexDirection: 'row', borderRadius: 16,
    padding: 4, position: 'relative', overflow: 'hidden',
  },
  tabIndicator: {
    position: 'absolute', top: 4, bottom: 4,
    width: '50%', borderRadius: 12,
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', paddingVertical: 10, gap: 4, zIndex: 1,
  },
  tabText: { fontSize: 14, fontWeight: '700' },

  // form
  formCard: { borderRadius: 24, padding: 18, borderWidth: 1, gap: 10 },
  formTitle: { fontSize: 15, fontWeight: '800' },
  input: {
    borderRadius: 14, paddingHorizontal: 16,
    paddingVertical: 13, fontSize: 14, borderWidth: 1.5,
  },
  formBtns:   { flexDirection: 'row', gap: 8, marginTop: 2 },
  submitBtn:  { borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  submitText: { fontWeight: '700', fontSize: 14 },
  cancelBtn:  { borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontWeight: '700', fontSize: 14 },
  noMargin:   { margin: 0 },

  // category card
  categoryCard: {
    borderRadius: 16, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center',
    overflow: 'hidden', paddingVertical: 12, paddingEnd: 8,
  },
  colorBar:     { width: 4, alignSelf: 'stretch', marginEnd: 12, borderRadius: 999 },
  categoryName: { fontSize: 15, fontWeight: '700' },
  cardActions:  { flexDirection: 'row', gap: 4 },
  actionBtn:    { borderRadius: 10, overflow: 'hidden' },

  // list
  list: { gap: 8, marginBottom: 32 },
});
