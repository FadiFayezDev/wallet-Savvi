import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Animated, Pressable,
  StyleSheet, View,
} from 'react-native';

import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  Button,
  IconButton,
  Surface,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';

import { EmptyState } from '@/src/components/common/EmptyState';
import { MaterialScreen } from '@/src/components/layout/MaterialScreen';
import { categoryService } from '@/src/services/categoryService';
import { useSettingsStore } from '@/src/stores/settingsStore';
import type { AppTheme } from '@/src/types/appTheme';
import type { Category } from '@/src/types/domain';
import { confirmAction } from '@/src/utils/confirm';
import { withAlpha } from '@/src/utils/colors';

type CategoryTab = 'expense' | 'income';

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
  const theme  = useTheme<AppTheme>();

  return (
    <View>
      <Surface
        elevation={0}
        style={[styles.categoryCard, {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.outlineVariant,
        }]}
      >
        {/* شريط اللون الجانبي */}
        <View style={[styles.colorBar, { backgroundColor: activeColor }]} />

        <View style={{ flex: 1 }}>
          <Text variant="titleSmall" style={[styles.categoryName, { color: theme.colors.onSurface }]}>
            {locale === 'ar' ? item.nameAr : item.nameEn}
          </Text>
        </View>

        {/* أزرار */}
        <View style={styles.cardActions}>
          <IconButton
            icon="pencil-outline"
            iconColor={theme.colors.primary}
            size={20}
            mode="contained-tonal"
            containerColor={withAlpha(theme.colors.primary, 0.14)}
            style={styles.actionBtn}
            onPress={onEdit}
          />
          <IconButton
            icon="trash-can-outline"
            iconColor={theme.colors.error}
            size={20}
            mode="contained-tonal"
            containerColor={withAlpha(theme.colors.error, 0.14)}
            style={styles.actionBtn}
            onPress={onDelete}
          />
        </View>
      </Surface>
    </View>
  );
}

// ── الشاشة الرئيسية ──────────────────────────────────────────────
export default function CategoriesTabScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const settings = useSettingsStore((s) => s.settings);
  const locale   = settings?.locale ?? 'ar';
  const theme    = useTheme<AppTheme>();
  const isAr     = locale === 'ar';

  const [categories,      setCategories]      = useState<Category[]>([]);
  const [activeTab,       setActiveTab]       = useState<CategoryTab>('expense');
  const [name,            setName]            = useState('');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [focused,         setFocused]         = useState<'name' | null>(null);

  const tabAnim = useRef(new Animated.Value(0)).current; // 0=expense, 1=income
  const didInitFromParam = useRef(false);

  const expenseColor = theme.colors.error;
  const incomeColor  = theme.colors.success ?? theme.colors.secondary;
  const expenseOn    = theme.colors.onError;
  const incomeOn     = theme.colors.onSuccess ?? theme.colors.onSecondary;
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
    <MaterialScreen layout="tab">
      <View style={styles.titleRow}>
        <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onSurface }]}>
          {isAr ? 'الفئات' : 'Categories'}
        </Text>
        <Surface
          elevation={0}
          style={[styles.countBadge, { backgroundColor: withAlpha(activeColor, 0.14) }]}
        >
          <Text variant="labelLarge" style={[styles.countText, { color: activeColor }]}>{filtered.length}</Text>
        </Surface>
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
                size={16} style={{ margin: 0 }}
              />
              <Text variant="labelLarge" style={[styles.tabText, {
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
      <Surface
        elevation={0}
        style={[styles.formCard, {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.outlineVariant,
        }]}
      >
        <Text variant="titleMedium" style={[styles.formTitle, { color: theme.colors.onSurface }]}>
          {editingCategory
            ? (isAr ? '✏ تعديل فئة' : '✏ Edit Category')
            : (isAr ? '+ فئة جديدة' : '+ New Category')}
        </Text>

        <TextInput
          mode="outlined"
          value={name}
          onChangeText={setName}
          placeholder={isAr ? 'اسم الفئة' : 'Category name'}
          onFocus={() => setFocused('name')}
          onBlur={() => setFocused(null)}
          outlineColor={focused === 'name' ? activeColor : theme.colors.outline}
          activeOutlineColor={activeColor}
          style={styles.paperInput}
        />

        <View style={styles.formBtns}>
          <Button
            mode="contained"
            buttonColor={activeColor}
            textColor={activeOn}
            onPress={submit}
            style={[styles.submitBtn, { flex: 1 }]}
          >
            {editingCategory ? (isAr ? 'حفظ' : 'Save') : (isAr ? 'إضافة' : 'Add')}
          </Button>

          {editingCategory && (
            <Button mode="outlined" onPress={resetForm} style={styles.cancelBtn}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </Button>
          )}
        </View>
      </Surface>

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
    </MaterialScreen>
  );
}

// ── Styles ───────────────────────────────────────────────────────
const styles = StyleSheet.create({
  titleRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  title:     {},
  countBadge:{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  countText: { fontWeight: '800' },

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
  tabText: { fontWeight: '700' },

  // form
  formCard: { borderRadius: 24, padding: 18, borderWidth: 1, gap: 10 },
  formTitle: {},
  paperInput: { backgroundColor: 'transparent' },
  formBtns:   { flexDirection: 'row', gap: 8, marginTop: 2 },
  submitBtn:  { borderRadius: 14 },
  cancelBtn:  { borderRadius: 14, justifyContent: 'center' },

  // category card
  categoryCard: {
    borderRadius: 16, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center',
    overflow: 'hidden', paddingVertical: 12, paddingEnd: 8,
  },
  colorBar:     { width: 4, alignSelf: 'stretch', marginEnd: 12, borderRadius: 999 },
  categoryName: { fontWeight: '700' },
  cardActions:  { flexDirection: 'row', gap: 4 },
  actionBtn:    { margin: 0 },

  // list
  list: { gap: 8, marginBottom: 32 },
});
