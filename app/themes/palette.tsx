import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { paletteThemeService } from '@/src/services/paletteThemeService';
import { useSettingsStore } from '@/src/stores/settingsStore';
import type { PaletteTheme, PaletteThemeColors } from '@/src/types/domain';
import { confirmAction } from '@/src/utils/confirm';
import { normalizeHex, withAlpha } from '@/src/utils/colors';

type PaletteMode = 'light' | 'dark';

const PALETTE_FIELDS: { key: keyof PaletteThemeColors; label: string; section: string }[] = [
  { key: 'primary', label: 'Primary', section: 'Brand' },
  { key: 'onPrimary', label: 'On Primary', section: 'Brand' },
  { key: 'primaryContainer', label: 'Primary Container', section: 'Brand' },
  { key: 'onPrimaryContainer', label: 'On Primary Container', section: 'Brand' },
  { key: 'secondary', label: 'Secondary', section: 'Brand' },
  { key: 'onSecondary', label: 'On Secondary', section: 'Brand' },
  { key: 'secondaryContainer', label: 'Secondary Container', section: 'Brand' },
  { key: 'onSecondaryContainer', label: 'On Secondary Container', section: 'Brand' },
  { key: 'tertiary', label: 'Tertiary', section: 'Brand' },
  { key: 'onTertiary', label: 'On Tertiary', section: 'Brand' },
  { key: 'tertiaryContainer', label: 'Tertiary Container', section: 'Brand' },
  { key: 'onTertiaryContainer', label: 'On Tertiary Container', section: 'Brand' },

  { key: 'background', label: 'Background', section: 'Surfaces' },
  { key: 'onBackground', label: 'On Background', section: 'Surfaces' },
  { key: 'surface', label: 'Surface', section: 'Surfaces' },
  { key: 'onSurface', label: 'On Surface', section: 'Surfaces' },
  { key: 'surfaceVariant', label: 'Surface Variant', section: 'Surfaces' },
  { key: 'onSurfaceVariant', label: 'On Surface Variant', section: 'Surfaces' },
  { key: 'outline', label: 'Outline', section: 'Surfaces' },
  { key: 'outlineVariant', label: 'Outline Variant', section: 'Surfaces' },

  { key: 'error', label: 'Error', section: 'Semantic' },
  { key: 'onError', label: 'On Error', section: 'Semantic' },
  { key: 'errorContainer', label: 'Error Container', section: 'Semantic' },
  { key: 'onErrorContainer', label: 'On Error Container', section: 'Semantic' },
  { key: 'success', label: 'Success', section: 'Semantic' },
  { key: 'onSuccess', label: 'On Success', section: 'Semantic' },
  { key: 'successContainer', label: 'Success Container', section: 'Semantic' },
  { key: 'onSuccessContainer', label: 'On Success Container', section: 'Semantic' },
  { key: 'warning', label: 'Warning', section: 'Semantic' },
  { key: 'onWarning', label: 'On Warning', section: 'Semantic' },
  { key: 'warningContainer', label: 'Warning Container', section: 'Semantic' },
  { key: 'onWarningContainer', label: 'On Warning Container', section: 'Semantic' },
  { key: 'info', label: 'Info', section: 'Semantic' },
  { key: 'onInfo', label: 'On Info', section: 'Semantic' },
  { key: 'infoContainer', label: 'Info Container', section: 'Semantic' },
  { key: 'onInfoContainer', label: 'On Info Container', section: 'Semantic' },

  { key: 'headerGradientStart', label: 'Header Gradient Start', section: 'Header' },
  { key: 'headerGradientMid', label: 'Header Gradient Mid', section: 'Header' },
  { key: 'headerGradientEnd', label: 'Header Gradient End', section: 'Header' },
  { key: 'headerText', label: 'Header Text', section: 'Header' },
  { key: 'headerIcon', label: 'Header Icon', section: 'Header' },

  { key: 'iconPrimary', label: 'Icon Primary', section: 'Icons' },
  { key: 'iconSecondary', label: 'Icon Secondary', section: 'Icons' },
  { key: 'iconMuted', label: 'Icon Muted', section: 'Icons' },
];

const sectionOrder = ['Brand', 'Surfaces', 'Semantic', 'Header', 'Icons'] as const;

const buildDefaults = (colors: any): PaletteThemeColors => ({
  primary: colors.primary,
  onPrimary: colors.onPrimary,
  primaryContainer: colors.primaryContainer,
  onPrimaryContainer: colors.onPrimaryContainer,
  secondary: colors.secondary,
  onSecondary: colors.onSecondary,
  secondaryContainer: colors.secondaryContainer,
  onSecondaryContainer: colors.onSecondaryContainer,
  tertiary: colors.tertiary,
  onTertiary: colors.onTertiary,
  tertiaryContainer: colors.tertiaryContainer,
  onTertiaryContainer: colors.onTertiaryContainer,
  background: colors.background,
  onBackground: colors.onBackground,
  surface: colors.surface,
  onSurface: colors.onSurface,
  surfaceVariant: colors.surfaceVariant,
  onSurfaceVariant: colors.onSurfaceVariant,
  outline: colors.outline,
  outlineVariant: colors.outlineVariant,
  error: colors.error,
  onError: colors.onError,
  errorContainer: colors.errorContainer,
  onErrorContainer: colors.onErrorContainer,
  success: colors.success ?? colors.secondary,
  onSuccess: colors.onSuccess ?? colors.onSecondary,
  successContainer: colors.successContainer ?? colors.secondaryContainer,
  onSuccessContainer: colors.onSuccessContainer ?? colors.onSecondaryContainer,
  warning: colors.warning ?? colors.tertiary,
  onWarning: colors.onWarning ?? colors.onTertiary,
  warningContainer: colors.warningContainer ?? colors.tertiaryContainer,
  onWarningContainer: colors.onWarningContainer ?? colors.onTertiaryContainer,
  info: colors.info ?? colors.primary,
  onInfo: colors.onInfo ?? colors.onPrimary,
  infoContainer: colors.infoContainer ?? colors.primaryContainer,
  onInfoContainer: colors.onInfoContainer ?? colors.onPrimaryContainer,
  headerGradientStart: colors.headerGradientStart ?? colors.primary,
  headerGradientMid: colors.headerGradientMid ?? colors.primary,
  headerGradientEnd: colors.headerGradientEnd ?? colors.secondary,
  headerText: colors.headerText ?? colors.onPrimary,
  headerIcon: colors.headerIcon ?? colors.onPrimary,
  iconPrimary: colors.iconPrimary ?? colors.primary,
  iconSecondary: colors.iconSecondary ?? colors.secondary,
  iconMuted: colors.iconMuted ?? colors.onSurfaceVariant,
});

export default function PaletteThemesScreen() {
  const theme = useTheme();
  const { settings, patchSettings } = useSettingsStore();
  const [themes, setThemes] = useState<PaletteTheme[]>([]);
  const [editingTheme, setEditingTheme] = useState<PaletteTheme | null>(null);
  const [name, setName] = useState('');
  const [mode, setMode] = useState<PaletteMode>('light');
  const [lightColors, setLightColors] = useState<PaletteThemeColors>(() => buildDefaults(theme.colors));
  const [darkColors, setDarkColors] = useState<PaletteThemeColors>(() => buildDefaults(theme.colors));
  const [busy, setBusy] = useState(false);

  const isAr = settings?.locale ? settings.locale === 'ar' : true;
  const activeThemeId = settings?.activePaletteThemeId ?? null;

  const loadThemes = useCallback(async () => {
    const rows = await paletteThemeService.listThemes();
    setThemes(rows);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadThemes().catch(() => setThemes([]));
    }, [loadThemes]),
  );

  useEffect(() => {
    if (!editingTheme) {
      setLightColors(buildDefaults(theme.colors));
      setDarkColors(buildDefaults(theme.colors));
    }
  }, [editingTheme, theme.colors]);

  const resetForm = () => {
    setName('');
    setEditingTheme(null);
    setMode('light');
  };

  const updateColor = (key: keyof PaletteThemeColors, value: string) => {
    if (mode === 'light') {
      setLightColors((prev) => ({ ...prev, [key]: value }));
    } else {
      setDarkColors((prev) => ({ ...prev, [key]: value }));
    }
  };

  const normalizePalette = (palette: PaletteThemeColors) => {
    const next = { ...palette } as Record<keyof PaletteThemeColors, string>;
    for (const field of PALETTE_FIELDS) {
      const normalized = normalizeHex(next[field.key]);
      if (!normalized) {
        throw new Error(`${field.label} is invalid`);
      }
      next[field.key] = normalized;
    }
    return next as PaletteThemeColors;
  };

  const submit = async () => {
    if (!name.trim()) {
      Alert.alert(isAr ? 'أدخل اسم الثيم' : 'Enter a theme name');
      return;
    }
    setBusy(true);
    try {
      const normalizedLight = normalizePalette(lightColors);
      const normalizedDark = normalizePalette(darkColors);
      if (editingTheme) {
        await paletteThemeService.updateTheme(editingTheme.id, {
          name: name.trim(),
          light: normalizedLight,
          dark: normalizedDark,
        });
        if (settings?.themeSource === 'palette' && activeThemeId === editingTheme.id) {
          await patchSettings({ activePaletteThemeId: editingTheme.id });
        }
      } else {
        await paletteThemeService.createTheme({
          name: name.trim(),
          light: normalizedLight,
          dark: normalizedDark,
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
      const imported = await paletteThemeService.importTheme();
      if (imported) {
        await loadThemes();
        Alert.alert(isAr ? 'تم الاستيراد' : 'Imported', imported.name);
      }
    } catch (err) {
      Alert.alert(isAr ? 'فشل الاستيراد' : 'Import failed', err instanceof Error ? err.message : 'Failed');
    }
  };

  const onApplyTheme = async (themeId: number) => {
    try {
      await patchSettings({ themeSource: 'palette', activePaletteThemeId: themeId });
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed');
    }
  };

  const onDeleteTheme = async (themeItem: PaletteTheme) => {
    const ok = await confirmAction({
      title: isAr ? 'حذف الثيم؟' : 'Delete theme?',
      message: isAr ? 'سيتم حذف الثيم نهائيا.' : 'This will permanently delete the theme.',
      confirmText: isAr ? 'حذف' : 'Delete',
      cancelText: isAr ? 'إلغاء' : 'Cancel',
      destructive: true,
    });
    if (!ok) return;
    try {
      await paletteThemeService.deleteTheme(themeItem.id);
      if (activeThemeId === themeItem.id) {
        await patchSettings({ themeSource: 'material', activePaletteThemeId: null });
      }
      await loadThemes();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed');
    }
  };

  const sections = useMemo(() => {
    return sectionOrder.map((section) => ({
      name: section,
      fields: PALETTE_FIELDS.filter((f) => f.section === section),
    }));
  }, []);

  const currentColors = mode === 'light' ? lightColors : darkColors;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={[styles.scroll, { paddingTop: 16 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: theme.colors.onSurface }]}>
          {isAr ? 'لوحات الألوان' : 'Palette Themes'}
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

      <View style={[styles.formCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
        <Text style={[styles.formTitle, { color: theme.colors.onSurface }]}>
          {editingTheme ? (isAr ? 'تعديل لوحة ألوان' : 'Edit Palette') : (isAr ? 'لوحة جديدة' : 'New Palette')}
        </Text>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={isAr ? 'اسم اللوحة' : 'Palette name'}
          placeholderTextColor={theme.colors.onSurfaceVariant}
          style={[styles.input, { backgroundColor: theme.colors.surfaceVariant, color: theme.colors.onSurface, borderColor: theme.colors.outlineVariant }]}
        />

        <View style={styles.modeRow}>
          {(['light', 'dark'] as PaletteMode[]).map((m) => {
            const active = mode === m;
            return (
              <Pressable
                key={m}
                onPress={() => setMode(m)}
                style={[
                  styles.modeBtn,
                  { backgroundColor: active ? theme.colors.primary : theme.colors.surfaceVariant },
                ]}
              >
                <Text style={{ color: active ? theme.colors.onPrimary : theme.colors.onSurfaceVariant, fontWeight: '700' }}>
                  {m === 'light' ? (isAr ? 'فاتح' : 'Light') : (isAr ? 'داكن' : 'Dark')}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {sections.map((section) => (
          <View key={section.name} style={[styles.sectionCard, { borderColor: theme.colors.outlineVariant }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>{section.name}</Text>
            <View style={styles.sectionBody}>
              {section.fields.map((field) => (
                <ColorPickerField
                  key={`${mode}-${field.key}`}
                  label={field.label}
                  value={currentColors[field.key]}
                  onChange={(value) => updateColor(field.key, value)}
                />
              ))}
            </View>
          </View>
        ))}

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

      <View style={styles.list}>
        {themes.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
              {isAr ? 'لا توجد لوحات بعد' : 'No palettes yet'}
            </Text>
          </View>
        ) : (
          themes.map((item) => (
            <View
              key={item.id}
              style={[
                styles.themeCard,
                { backgroundColor: theme.colors.surface, borderColor: item.id === activeThemeId ? theme.colors.primary : theme.colors.outlineVariant },
              ]}
            >
              <View style={styles.themeRow}>
                <View style={styles.swatches}>
                  <View style={[styles.swatch, { backgroundColor: item.light.primary }]} />
                  <View style={[styles.swatch, { backgroundColor: item.light.secondary }]} />
                  <View style={[styles.swatch, { backgroundColor: item.dark.primary }]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.themeName, { color: theme.colors.onSurface }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={[styles.themeMeta, { color: theme.colors.onSurfaceVariant }]}>
                    {item.light.primary} • {item.dark.primary}
                  </Text>
                </View>
                {item.id === activeThemeId ? (
                  <View style={[styles.activePill, { backgroundColor: withAlpha(theme.colors.primary, 0.18) }]}>
                    <Text style={[styles.activeText, { color: theme.colors.primary }]}>
                      {isAr ? 'مفعّل' : 'Active'}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.cardActions}>
                <Pressable
                  onPress={() => onApplyTheme(item.id)}
                  style={[styles.actionBtn, { backgroundColor: withAlpha(theme.colors.primary, 0.12) }]}
                >
                  <IconButton icon="check" iconColor={theme.colors.primary} size={16} style={styles.noMargin} />
                  <Text style={[styles.actionLabel, { color: theme.colors.primary }]}>{isAr ? 'تطبيق' : 'Apply'}</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setEditingTheme(item);
                    setName(item.name);
                    setLightColors(item.light);
                    setDarkColors(item.dark);
                  }}
                  style={[styles.actionBtn, { backgroundColor: withAlpha(theme.colors.secondary, 0.12) }]}
                >
                  <IconButton icon="pencil-outline" iconColor={theme.colors.secondary} size={16} style={styles.noMargin} />
                  <Text style={[styles.actionLabel, { color: theme.colors.secondary }]}>{isAr ? 'تعديل' : 'Edit'}</Text>
                </Pressable>
                <Pressable
                  onPress={async () => {
                    try {
                      await paletteThemeService.exportTheme(item.id);
                    } catch (err) {
                      Alert.alert(isAr ? 'فشل التصدير' : 'Export failed', err instanceof Error ? err.message : 'Failed');
                    }
                  }}
                  style={[styles.actionBtn, { backgroundColor: withAlpha(theme.colors.tertiary, 0.12) }]}
                >
                  <IconButton icon="upload-outline" iconColor={theme.colors.tertiary} size={16} style={styles.noMargin} />
                  <Text style={[styles.actionLabel, { color: theme.colors.tertiary }]}>{isAr ? 'تصدير' : 'Export'}</Text>
                </Pressable>
                <Pressable
                  onPress={() => onDeleteTheme(item)}
                  style={[styles.actionBtn, { backgroundColor: withAlpha(theme.colors.error, 0.12) }]}
                >
                  <IconButton icon="trash-can-outline" iconColor={theme.colors.error} size={16} style={styles.noMargin} />
                  <Text style={[styles.actionLabel, { color: theme.colors.error }]}>{isAr ? 'حذف' : 'Delete'}</Text>
                </Pressable>
              </View>
            </View>
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

  formCard: { borderRadius: 24, padding: 18, borderWidth: 1, gap: 12 },
  formTitle: { fontSize: 15, fontWeight: '800' },
  input: { borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, borderWidth: 1 },
  modeRow: { flexDirection: 'row', gap: 8 },
  modeBtn: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  sectionCard: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '800' },
  sectionBody: { gap: 10 },
  formBtns: { flexDirection: 'row', gap: 8, marginTop: 6 },
  submitBtn: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  submitText: { fontWeight: '700', fontSize: 14 },
  cancelBtn: { borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontWeight: '700', fontSize: 14 },

  list: { gap: 10 },
  themeCard: { borderRadius: 20, borderWidth: 1, padding: 14, gap: 12 },
  themeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  swatches: { flexDirection: 'row', gap: 6 },
  swatch: { width: 18, height: 18, borderRadius: 6 },
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
