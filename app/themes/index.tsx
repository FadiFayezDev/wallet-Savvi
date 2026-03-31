import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useFocusEffect } from 'expo-router';
import { IconButton, useTheme } from 'react-native-paper';

import { ColorPickerField } from '@/src/components/common/ColorPickerField';
import { themeService } from '@/src/services/themeService';
import { useSettingsStore } from '@/src/stores/settingsStore';
import type { CustomTheme } from '@/src/types/domain';
import { confirmAction } from '@/src/utils/confirm';
import { isValidHex, normalizeHex, withAlpha } from '@/src/utils/colors';

// ─── ThemeCard ────────────────────────────────────────────────────────────────

function ThemeCard({
  theme,
  isActive,
  labels,
  onApply,
  onEdit,
  onExport,
  onDelete,
}: {
  theme: CustomTheme;
  isActive: boolean;
  labels: {
    apply: string;
    edit: string;
    export: string;
    delete: string;
    active: string;
  };
  onApply: () => void;
  onEdit: () => void;
  onExport: () => void;
  onDelete: () => void;
}) {
  const paper = useTheme();
  return (
    <View
      style={[
        styles.themeCard,
        {
          backgroundColor: paper.colors.surface,
          borderColor: isActive ? paper.colors.primary : paper.colors.outlineVariant,
        },
      ]}
    >
      <View style={styles.themeRow}>
        <View style={styles.swatches}>
          <View style={[styles.swatch, { backgroundColor: theme.primary }]} />
          <View style={[styles.swatch, { backgroundColor: theme.secondary }]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.themeName, { color: paper.colors.onSurface }]} numberOfLines={1}>
            {theme.name}
          </Text>
          <Text style={[styles.themeMeta, { color: paper.colors.onSurfaceVariant }]}>
            {theme.primary} • {theme.secondary}
          </Text>
        </View>
        {isActive ? (
          <View style={[styles.activePill, { backgroundColor: withAlpha(paper.colors.primary, 0.18) }]}>
            <Text style={[styles.activeText, { color: paper.colors.primary }]}>
              {labels.active}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.cardActions}>
        <Pressable
          onPress={onApply}
          style={[styles.actionBtn, { backgroundColor: withAlpha(paper.colors.primary, 0.12) }]}
        >
          <IconButton icon="check" iconColor={paper.colors.primary} size={16} style={styles.noMargin} />
          <Text style={[styles.actionLabel, { color: paper.colors.primary }]}>{labels.apply}</Text>
        </Pressable>
        <Pressable
          onPress={onEdit}
          style={[styles.actionBtn, { backgroundColor: withAlpha(paper.colors.secondary, 0.12) }]}
        >
          <IconButton icon="pencil-outline" iconColor={paper.colors.secondary} size={16} style={styles.noMargin} />
          <Text style={[styles.actionLabel, { color: paper.colors.secondary }]}>{labels.edit}</Text>
        </Pressable>
        <Pressable
          onPress={onExport}
          style={[styles.actionBtn, { backgroundColor: withAlpha(paper.colors.tertiary, 0.12) }]}
        >
          <IconButton icon="upload-outline" iconColor={paper.colors.tertiary} size={16} style={styles.noMargin} />
          <Text style={[styles.actionLabel, { color: paper.colors.tertiary }]}>{labels.export}</Text>
        </Pressable>
        <Pressable
          onPress={onDelete}
          style={[styles.actionBtn, { backgroundColor: withAlpha(paper.colors.error, 0.12) }]}
        >
          <IconButton icon="trash-can-outline" iconColor={paper.colors.error} size={16} style={styles.noMargin} />
          <Text style={[styles.actionLabel, { color: paper.colors.error }]}>{labels.delete}</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ThemeLibraryScreen() {
  const theme = useTheme();
  const { settings, patchSettings } = useSettingsStore();
  const [themes, setThemes] = useState<CustomTheme[]>([]);
  const [editingTheme, setEditingTheme] = useState<CustomTheme | null>(null);
  const [name, setName] = useState('');
  const [primary, setPrimary] = useState('#2563EB');
  const [secondary, setSecondary] = useState('#059669');
  const [busy, setBusy] = useState(false);

  const isAr = settings?.locale ? settings.locale === 'ar' : true;
  const activeThemeId = settings?.activeThemeId ?? null;

  const loadThemes = useCallback(async () => {
    const rows = await themeService.listThemes();
    setThemes(rows);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadThemes().catch(() => setThemes([]));
    }, [loadThemes]),
  );

  useEffect(() => {
    if (!editingTheme) {
      const defaultPrimary = normalizeHex(theme.colors.primary) ?? '#2563EB';
      const defaultSecondary = normalizeHex(theme.colors.secondary) ?? '#059669';
      setPrimary(defaultPrimary);
      setSecondary(defaultSecondary);
    }
  }, [editingTheme, theme.colors.primary, theme.colors.secondary]);

  const resetForm = () => {
    setName('');
    setEditingTheme(null);
  };

  const submit = async () => {
    if (!name.trim()) {
      Alert.alert(isAr ? 'أدخل اسم الثيم' : 'Enter a theme name');
      return;
    }
    const normPrimary = normalizeHex(primary);
    const normSecondary = normalizeHex(secondary);
    if (!isValidHex(primary) || !normPrimary) {
      Alert.alert(isAr ? 'اللون الأساسي غير صالح' : 'Invalid primary color');
      return;
    }
    if (!isValidHex(secondary) || !normSecondary) {
      Alert.alert(isAr ? 'اللون الثانوي غير صالح' : 'Invalid secondary color');
      return;
    }
    setBusy(true);
    try {
      if (editingTheme) {
        await themeService.updateTheme(editingTheme.id, {
          name: name.trim(),
          primary: normPrimary,
          secondary: normSecondary,
        });
        if (settings?.themeSource === 'custom' && activeThemeId === editingTheme.id) {
          await patchSettings({ activeThemeId: editingTheme.id });
        }
      } else {
        await themeService.createTheme({
          name: name.trim(),
          primary: normPrimary,
          secondary: normSecondary,
        });
      }
      await loadThemes();
      resetForm();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const onImport = async () => {
    try {
      const imported = await themeService.importTheme();
      if (imported) {
        await loadThemes();
        Alert.alert(isAr ? 'تم الاستيراد' : 'Imported', imported.name);
      }
    } catch (err) {
      Alert.alert(
        isAr ? 'فشل الاستيراد' : 'Import failed',
        err instanceof Error ? err.message : 'Failed',
      );
    }
  };

  const onApplyTheme = async (themeId: number) => {
    try {
      await patchSettings({ themeSource: 'custom', activeThemeId: themeId });
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed');
    }
  };

  const onDeleteTheme = async (themeItem: CustomTheme) => {
    const ok = await confirmAction({
      title: isAr ? 'حذف الثيم؟' : 'Delete theme?',
      message: isAr ? 'سيتم حذف الثيم نهائيا.' : 'This will permanently delete the theme.',
      confirmText: isAr ? 'حذف' : 'Delete',
      cancelText: isAr ? 'إلغاء' : 'Cancel',
      destructive: true,
    });
    if (!ok) return;
    try {
      await themeService.deleteTheme(themeItem.id);
      if (activeThemeId === themeItem.id) {
        await patchSettings({ themeSource: 'material', activeThemeId: null });
      }
      await loadThemes();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed');
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={[styles.scroll, { paddingTop: 16 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ── */}
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: theme.colors.onSurface }]}>
          {isAr ? 'مكتبة الثيمات' : 'Theme Library'}
        </Text>
        <Pressable
          onPress={onImport}
          style={[styles.importBtn, { backgroundColor: withAlpha(theme.colors.primary, 0.14) }]}
        >
          <IconButton icon="download-outline" iconColor={theme.colors.primary} size={18} style={styles.noMargin} />
          <Text style={[styles.importText, { color: theme.colors.primary }]}>
            {isAr ? 'استيراد' : 'Import'}
          </Text>
        </Pressable>
      </View>

      {/* ── Editor form ── */}
      <View
        style={[
          styles.formCard,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant },
        ]}
      >
        <Text style={[styles.formTitle, { color: theme.colors.onSurface }]}>
          {editingTheme
            ? isAr ? 'تعديل ثيم' : 'Edit Theme'
            : isAr ? 'ثيم جديد' : 'New Theme'}
        </Text>

        {/* Name */}
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={isAr ? 'اسم الثيم' : 'Theme name'}
          placeholderTextColor={theme.colors.onSurfaceVariant}
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.surfaceVariant,
              color: theme.colors.onSurface,
              borderColor: theme.colors.outlineVariant,
            },
          ]}
        />

        {/* Color pickers — now with full color wheel */}
        <View style={styles.colorSection}>
          <ColorPickerField
            label={isAr ? 'اللون الأساسي' : 'Primary Color'}
            value={primary}
            onChange={(c) => {
              const n = normalizeHex(c);
              setPrimary(n ?? c);
            }}
          />
          <ColorPickerField
            label={isAr ? 'اللون الثانوي' : 'Secondary Color'}
            value={secondary}
            onChange={(c) => {
              const n = normalizeHex(c);
              setSecondary(n ?? c);
            }}
          />
        </View>

        {/* Preview strip */}
        <View style={styles.previewStrip}>
          <View style={[styles.previewBlock, { backgroundColor: normalizeHex(primary) ?? '#000', flex: 1 }]}>
            <Text style={[styles.previewLabel, { color: '#fff' }]}>
              {isAr ? 'الأساسي' : 'Primary'}
            </Text>
          </View>
          <View style={[styles.previewBlock, { backgroundColor: normalizeHex(secondary) ?? '#000', flex: 1 }]}>
            <Text style={[styles.previewLabel, { color: '#fff' }]}>
              {isAr ? 'الثانوي' : 'Secondary'}
            </Text>
          </View>
        </View>

        {/* Buttons */}
        <View style={styles.formBtns}>
          <Pressable
            onPress={submit}
            disabled={busy}
            style={[styles.submitBtn, { backgroundColor: theme.colors.primary, opacity: busy ? 0.6 : 1 }]}
          >
            <Text style={[styles.submitText, { color: theme.colors.onPrimary }]}>
              {editingTheme ? (isAr ? 'حفظ' : 'Save') : (isAr ? 'إضافة' : 'Create')}
            </Text>
          </Pressable>
          {editingTheme && (
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

      {/* ── List ── */}
      <View style={styles.list}>
        {themes.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
              {isAr ? 'لا توجد ثيمات بعد' : 'No themes yet'}
            </Text>
          </View>
        ) : (
          themes.map((item) => (
            <ThemeCard
              key={item.id}
              theme={item}
              isActive={settings?.themeSource === 'custom' && activeThemeId === item.id}
              labels={{
                apply: isAr ? 'تطبيق' : 'Apply',
                edit: isAr ? 'تعديل' : 'Edit',
                export: isAr ? 'تصدير' : 'Export',
                delete: isAr ? 'حذف' : 'Delete',
                active: isAr ? 'مفعّل' : 'Active',
              }}
              onApply={() => onApplyTheme(item.id)}
              onEdit={() => {
                setEditingTheme(item);
                setName(item.name);
                setPrimary(item.primary);
                setSecondary(item.secondary);
              }}
              onExport={async () => {
                try {
                  await themeService.exportTheme(item.id);
                } catch (err) {
                  Alert.alert(
                    isAr ? 'فشل التصدير' : 'Export failed',
                    err instanceof Error ? err.message : 'Failed',
                  );
                }
              }}
              onDelete={() => onDeleteTheme(item)}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 90, gap: 16 },
  noMargin: { margin: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 24, fontWeight: '900' },
  importBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  importText: { fontSize: 12, fontWeight: '800' },

  formCard: { borderRadius: 24, padding: 18, borderWidth: 1, gap: 14 },
  formTitle: { fontSize: 15, fontWeight: '800' },
  input: { borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, borderWidth: 1 },
  colorSection: { gap: 10 },
  previewStrip: { flexDirection: 'row', borderRadius: 14, overflow: 'hidden', height: 44 },
  previewBlock: { alignItems: 'center', justifyContent: 'center' },
  previewLabel: { fontSize: 11, fontWeight: '800', opacity: 0.9 },

  formBtns: { flexDirection: 'row', gap: 8, marginTop: 4 },
  submitBtn: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  submitText: { fontWeight: '700', fontSize: 14 },
  cancelBtn: { borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontWeight: '700', fontSize: 14 },

  list: { gap: 10 },
  themeCard: { borderRadius: 20, borderWidth: 1, padding: 14, gap: 12 },
  themeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  swatches: { flexDirection: 'row', gap: 6 },
  swatch: { width: 22, height: 22, borderRadius: 6 },
  themeName: { fontSize: 14, fontWeight: '800' },
  themeMeta: { fontSize: 11, fontWeight: '600' },
  activePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  activeText: { fontSize: 10, fontWeight: '800' },
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 },
  actionLabel: { fontSize: 12, fontWeight: '700' },
  emptyCard: { borderRadius: 16, padding: 16, alignItems: 'center' },
  emptyText: { fontSize: 13, fontWeight: '700' },
});
