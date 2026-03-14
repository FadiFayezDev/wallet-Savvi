import { useEffect, useState } from 'react';
import {
  Alert, Pressable, ScrollView, StyleSheet,
  Text, TextInput, View,
} from 'react-native';

import { useTranslation } from 'react-i18next';
import { IconButton, useTheme } from 'react-native-paper';

import { CalculatorField } from '@/src/components/common/CalculatorField';
import { backupService } from '@/src/services/backupService';
import { dailySummaryService } from '@/src/services/dailySummaryService';
import { securityService } from '@/src/services/securityService';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { confirmAction } from '@/src/utils/confirm';

// ── مكوّن قسم إعدادات ────────────────────────────────────────────
function SettingSection({
  icon, title, subtitle, children,
}: {
  icon: string; title: string; subtitle?: string; children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.section, {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.outlineVariant,
    }]}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIcon, { backgroundColor: `${theme.colors.primary}15` }]}>
          <IconButton icon={icon} iconColor={theme.colors.primary} size={18} style={styles.noMargin} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>{title}</Text>
          {subtitle && (
            <Text style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>{subtitle}</Text>
          )}
        </View>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

// ── Chip اختيار ──────────────────────────────────────────────────
function OptionChip({
  label, active, onPress, danger,
}: {
  label: string; active: boolean; onPress: () => void; danger?: boolean;
}) {
  const theme = useTheme();
  const bg    = active
    ? (danger ? theme.colors.error : theme.colors.primary)
    : theme.colors.surfaceVariant;
  const fg    = active
    ? (danger ? theme.colors.onError : theme.colors.onPrimary)
    : theme.colors.onSurfaceVariant;
  return (
    <Pressable onPress={onPress} style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={[styles.chipText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

// ── زر أكشن ─────────────────────────────────────────────────────
function ActionButton({
  label, icon, onPress, disabled, variant = 'primary',
}: {
  label: string; icon?: string; onPress: () => void;
  disabled?: boolean; variant?: 'primary' | 'secondary' | 'tertiary' | 'error' | 'surface';
}) {
  const theme = useTheme();
  const bgMap = {
    primary:   theme.colors.primary,
    secondary: theme.colors.secondary,
    tertiary:  theme.colors.tertiary,
    error:     theme.colors.error,
    surface:   theme.colors.surfaceVariant,
  };
  const fgMap = {
    primary:   theme.colors.onPrimary,
    secondary: theme.colors.onSecondary,
    tertiary:  theme.colors.onTertiary,
    error:     theme.colors.onError,
    surface:   theme.colors.onSurfaceVariant,
  };
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.actionBtn, { backgroundColor: bgMap[variant], opacity: disabled ? 0.55 : 1 }]}
    >
      {icon && <IconButton icon={icon} iconColor={fgMap[variant]} size={16} style={styles.noMargin} />}
      <Text style={[styles.actionBtnText, { color: fgMap[variant] }]}>{label}</Text>
    </Pressable>
  );
}

// ── الشاشة ───────────────────────────────────────────────────────
const lockMethods:  ('none' | 'pin' | 'biometric')[]    = ['none', 'pin', 'biometric'];
const themeModes:   ('light' | 'dark' | 'system')[]     = ['light', 'dark', 'system'];
const themeSources: ('material' | 'fixed')[]            = ['material', 'fixed'];
const timeFormats:  ('12h' | '24h')[]                   = ['12h', '24h'];
const locales:      ('ar' | 'en')[]                     = ['ar', 'en'];

export default function SettingsTab() {
  const { t, i18n }                        = useTranslation();
  const { settings, loadSettings, patchSettings } = useSettingsStore();
  const theme                              = useTheme();
  const [pin,             setPin]             = useState('');
  const [busy,            setBusy]            = useState(false);
  const [dailyLimitInput, setDailyLimitInput] = useState('');
  const [savingLimit,     setSavingLimit]     = useState(false);

  useEffect(() => {
    if (!settings) loadSettings().catch(() => undefined);
  }, [loadSettings, settings]);

  useEffect(() => {
    if (!settings) return;
    setDailyLimitInput(settings.dailyLimit == null ? '' : String(settings.dailyLimit));
  }, [settings?.dailyLimit]);

  if (!settings) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.onSurfaceVariant }}>{t('common.loading')}</Text>
      </View>
    );
  }

  const isAr             = settings.locale === 'ar';
  const themeSourceValue = settings.themeSource ?? 'material';
  const timeFormatValue  = settings.timeFormat  ?? '24h';

  const saveLimit = async (clear = false) => {
    if (!clear) {
      const trimmed = dailyLimitInput.trim();
      const limit   = trimmed.length === 0 ? null : Number(trimmed);
      if (trimmed.length > 0 && (!Number.isFinite(limit) || (limit as number) <= 0)) {
        Alert.alert(isAr ? 'قيمة غير صحيحة' : 'Invalid limit');
        return;
      }
      setSavingLimit(true);
      try { await patchSettings({ dailyLimit: limit }); dailySummaryService.recomputeAllSummaries().catch(() => undefined); }
      finally { setSavingLimit(false); }
    } else {
      setDailyLimitInput('');
      setSavingLimit(true);
      try { await patchSettings({ dailyLimit: null }); dailySummaryService.recomputeAllSummaries().catch(() => undefined); }
      finally { setSavingLimit(false); }
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={[styles.scroll, { paddingTop: 16 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* عنوان */}
      <Text style={[styles.pageTitle, { color: theme.colors.onSurface }]}>
        {isAr ? 'الإعدادات' : 'Settings'}
      </Text>

      {/* ── اللغة ── */}
      <SettingSection icon="translate" title={t('settings.language')}>
        <View style={styles.chips}>
          {locales.map((locale) => (
            <OptionChip
              key={locale}
              label={locale === 'ar' ? 'العربية' : 'English'}
              active={settings.locale === locale}
              onPress={async () => { await patchSettings({ locale }); await i18n.changeLanguage(locale); }}
            />
          ))}
        </View>
      </SettingSection>

      {/* ── الثيم ── */}
      <SettingSection icon="palette-outline" title={t('settings.theme')}>
        <View style={styles.chips}>
          {themeModes.map((mode) => (
            <OptionChip
              key={mode}
              label={t(`settings.${mode}`)}
              active={settings.themeMode === mode}
              onPress={() => patchSettings({ themeMode: mode })}
            />
          ))}
        </View>
      </SettingSection>

      {/* ── مصدر الثيم ── */}
      <SettingSection
        icon="cellphone-check"
        title={isAr ? 'مصدر الثيم' : 'Theme Source'}
        subtitle={isAr ? 'Material You أو ثيم ثابت' : 'Dynamic Material You or fixed theme'}
      >
        <View style={styles.chips}>
          {themeSources.map((source) => (
            <OptionChip
              key={source}
              label={source === 'material' ? 'Material You' : (isAr ? 'ثابت' : 'Fixed')}
              active={themeSourceValue === source}
              onPress={() => patchSettings({ themeSource: source })}
            />
          ))}
        </View>
      </SettingSection>

      {/* ── تنسيق الوقت ── */}
      <SettingSection
        icon="clock-outline"
        title={isAr ? 'تنسيق الوقت' : 'Time Format'}
        subtitle={isAr ? '12 ساعة أو 24 ساعة' : '12-hour or 24-hour clock'}
      >
        <View style={styles.chips}>
          {timeFormats.map((fmt) => (
            <OptionChip
              key={fmt}
              label={fmt === '12h' ? (isAr ? '١٢ ساعة' : '12h') : (isAr ? '٢٤ ساعة' : '24h')}
              active={timeFormatValue === fmt}
              onPress={() => patchSettings({ timeFormat: fmt })}
            />
          ))}
        </View>
      </SettingSection>

      {/* ── حد المصروف ── */}
      <SettingSection
        icon="speedometer-slow"
        title={isAr ? 'حد المصروف اليومي' : 'Daily Spending Limit'}
        subtitle={isAr ? 'تنبيه عند التجاوز، لا حجب' : 'You get alerted, not blocked'}
      >
        <CalculatorField
          label={isAr ? 'قيمة الحد' : 'Limit amount'}
          hint={isAr ? 'اختياري — فارغة لإلغاء الحد' : 'Optional — leave empty to remove'}
          value={dailyLimitInput}
          onChange={setDailyLimitInput}
          locale={settings.locale}
        />
        <View style={[styles.chips, { marginTop: 10 }]}>
          <ActionButton
            label={isAr ? 'حفظ' : 'Save'}
            icon="content-save-outline"
            onPress={() => saveLimit(false)}
            disabled={savingLimit}
            variant="primary"
          />
          <ActionButton
            label={isAr ? 'إلغاء الحد' : 'Clear'}
            icon="close-circle-outline"
            onPress={() => saveLimit(true)}
            disabled={savingLimit}
            variant="surface"
          />
        </View>
      </SettingSection>

      {/* ── الأمان ── */}
      <SettingSection icon="shield-lock-outline" title={t('settings.lockMethod')}>
        <View style={styles.chips}>
          {lockMethods.map((method) => (
            <OptionChip
              key={method}
              label={t(`settings.${method}`)}
              active={settings.lockMethod === method}
              onPress={async () => {
                if (method === 'pin') {
                  const hasPin = await securityService.hasPin();
                  if (!hasPin) { Alert.alert(isAr ? 'احفظ الـ PIN أولاً' : 'Set a PIN first'); return; }
                }
                if (method === 'biometric') {
                  const canUse = await securityService.canUseBiometric();
                  if (!canUse) { Alert.alert(isAr ? 'البصمة غير متاحة' : 'Biometric unavailable'); return; }
                }
                await patchSettings({ lockMethod: method });
              }}
            />
          ))}
        </View>

        {/* PIN */}
        <View style={[styles.pinWrap, { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.outlineVariant }]}>
          <IconButton icon="lock-outline" iconColor={theme.colors.onSurfaceVariant} size={18} style={styles.noMargin} />
          <TextInput
            value={pin}
            onChangeText={setPin}
            secureTextEntry
            keyboardType="number-pad"
            placeholder={isAr ? 'أدخل الـ PIN' : 'Enter PIN'}
            placeholderTextColor={theme.colors.onSurfaceVariant}
            style={[styles.pinInput, { color: theme.colors.onSurface }]}
          />
        </View>
        <View style={styles.chips}>
          <ActionButton
            label={t('settings.setPin')}
            icon="lock-check-outline"
            variant="primary"
            onPress={async () => {
              try { await securityService.setPin(pin); setPin(''); Alert.alert(isAr ? 'تم حفظ الـ PIN' : 'PIN saved'); }
              catch (err) { Alert.alert('Error', err instanceof Error ? err.message : 'Failed'); }
            }}
          />
          <ActionButton
            label={t('settings.resetPin')}
            icon="lock-remove-outline"
            variant="error"
            onPress={async () => {
              const ok = await confirmAction({
                title: isAr ? 'حذف الـ PIN؟' : 'Remove PIN?',
                message: isAr ? 'سيتم تعطيل الحماية بالـ PIN.' : 'PIN protection will be disabled.',
                confirmText: isAr ? 'حذف' : 'Remove',
                cancelText: isAr ? 'إلغاء' : 'Cancel',
                destructive: true,
              });
              if (!ok) return;
              await securityService.clearPin();
              setPin('');
              Alert.alert(isAr ? 'تم حذف الـ PIN' : 'PIN removed');
            }}
          />
        </View>
      </SettingSection>

      {/* ── النسخ الاحتياطي ── */}
      <SettingSection icon="database-export-outline" title={t('settings.backup')}>
        <ActionButton
          label={t('common.export')}
          icon="upload-outline"
          variant="secondary"
          disabled={busy}
          onPress={async () => {
            setBusy(true);
            try { await backupService.exportBackup(); }
            catch (err) { Alert.alert('Export failed', err instanceof Error ? err.message : 'Failed'); }
            finally { setBusy(false); }
          }}
        />
        <ActionButton
          label={t('settings.importReplace')}
          icon="download-outline"
          variant="tertiary"
          disabled={busy}
          onPress={async () => {
            const ok = await confirmAction({
              title: isAr ? 'استيراد واستبدال؟' : 'Import and replace?',
              message: isAr
                ? 'سيتم استبدال كل البيانات الحالية.'
                : 'All current data will be replaced.',
              confirmText: isAr ? 'استيراد' : 'Import',
              cancelText: isAr ? 'إلغاء' : 'Cancel',
              destructive: true,
            });
            if (!ok) return;
            setBusy(true);
            try {
              const imported = await backupService.importBackupReplaceAll();
              if (imported) { await loadSettings(); Alert.alert(isAr ? 'تم الاستيراد' : 'Import completed'); }
            }
            catch (err) { Alert.alert('Import failed', err instanceof Error ? err.message : 'Failed'); }
            finally { setBusy(false); }
          }}
        />
      </SettingSection>
    </ScrollView>
  );
}

// ── Styles ───────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scroll:    { padding: 16, paddingBottom: 80, gap: 14 },
  loading:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pageTitle: { fontSize: 26, fontWeight: '900', marginBottom: 4 },
  noMargin:  { margin: 0 },

  // section
  section: {
    borderRadius: 24, padding: 16,
    borderWidth: 1, gap: 0,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  sectionIcon:   { borderRadius: 12, overflow: 'hidden' },
  sectionTitle:  { fontSize: 15, fontWeight: '800', marginTop: 4 },
  sectionSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2, lineHeight: 16 },
  sectionBody:   { gap: 8 },

  // chips row
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:  { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 13, fontWeight: '700' },

  // action button
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', borderRadius: 14,
    paddingVertical: 11, gap: 4,
  },
  actionBtnText: { fontSize: 13, fontWeight: '700' },

  // pin
  pinWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, borderWidth: 1,
    paddingHorizontal: 10, gap: 4,
  },
  pinInput: { flex: 1, paddingVertical: 12, fontSize: 14 },
});
