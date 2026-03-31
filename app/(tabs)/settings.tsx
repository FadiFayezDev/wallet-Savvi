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
import { notificationService } from '@/src/services/notificationService';
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

// ── قائمة منسدلة ────────────────────────────────────────────────
function SelectDropdown({
  valueLabel,
  options,
  selectedKey,
  isOpen,
  onToggle,
  onSelect,
}: {
  valueLabel: string;
  options: { key: string; label: string }[];
  selectedKey: string;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (key: string) => void;
}) {
  const theme = useTheme();
  return (
    <View>
      <Pressable
        onPress={onToggle}
        style={[
          styles.dropdownTrigger,
          { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.outlineVariant },
        ]}
      >
        <Text style={[styles.dropdownValue, { color: theme.colors.onSurface }]}>{valueLabel}</Text>
        <IconButton
          icon={isOpen ? 'chevron-up' : 'chevron-down'}
          iconColor={theme.colors.onSurfaceVariant}
          size={18}
          style={styles.noMargin}
        />
      </Pressable>
      {isOpen ? (
        <View
          style={[
            styles.dropdownList,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant },
          ]}
        >
          {options.map((opt) => {
            const active = opt.key === selectedKey;
            return (
              <Pressable
                key={opt.key}
                onPress={() => onSelect(opt.key)}
                style={[
                  styles.dropdownOption,
                  active && { backgroundColor: `${theme.colors.primary}18`, borderColor: theme.colors.primary },
                ]}
              >
                <Text style={[styles.dropdownOptionText, { color: theme.colors.onSurface }]}>
                  {opt.label}
                </Text>
                {active ? (
                  <IconButton
                    icon="check"
                    iconColor={theme.colors.primary}
                    size={16}
                    style={styles.noMargin}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

// ── الشاشة ───────────────────────────────────────────────────────
const lockMethods:  ('none' | 'pin' | 'biometric')[]    = ['none', 'pin', 'biometric'];
const themeModes:   ('light' | 'dark' | 'system')[]     = ['light', 'dark', 'system'];
const themeSources: ('material' | 'fixed' | 'mono')[]   = ['material', 'fixed', 'mono'];
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
  const [openSelect,      setOpenSelect]      = useState<null | 'locale' | 'theme' | 'themeSource' | 'timeFormat' | 'lockMethod'>(null);

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
  const selectedLocaleLabel = settings.locale === 'ar' ? 'العربية' : 'English';
  const selectedThemeLabel = t(`settings.${settings.themeMode}`);
  const selectedThemeSourceLabel = themeSourceValue === 'material'
    ? 'Material You'
    : themeSourceValue === 'mono'
      ? (isAr ? 'أبيض وأسود' : 'Black & White')
      : (isAr ? 'ثابت' : 'Fixed');
  const selectedTimeFormatLabel = timeFormatValue === '12h' ? (isAr ? '١٢ ساعة' : '12h') : (isAr ? '٢٤ ساعة' : '24h');
  const selectedLockLabel = t(`settings.${settings.lockMethod}`);

  const toggleSelect = (key: typeof openSelect) => {
    setOpenSelect((prev) => (prev === key ? null : key));
  };

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

  const toggleNotifyBills = async () => {
    await patchSettings({ notifyBillsEnabled: !settings.notifyBillsEnabled });
    notificationService.rescheduleAll().catch(() => undefined);
  };

  const toggleNotifyWork = async () => {
    await patchSettings({ notifyWorkEnabled: !settings.notifyWorkEnabled });
    notificationService.rescheduleAll().catch(() => undefined);
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
        <SelectDropdown
          valueLabel={selectedLocaleLabel}
          selectedKey={settings.locale}
          isOpen={openSelect === 'locale'}
          onToggle={() => toggleSelect('locale')}
          onSelect={async (locale) => {
            await patchSettings({ locale: locale as 'ar' | 'en' });
            await i18n.changeLanguage(locale);
            setOpenSelect(null);
          }}
          options={locales.map((locale) => ({
            key: locale,
            label: locale === 'ar' ? 'العربية' : 'English',
          }))}
        />
      </SettingSection>

      {/* ── الثيم ── */}
      <SettingSection icon="palette-outline" title={t('settings.theme')}>
        <SelectDropdown
          valueLabel={selectedThemeLabel}
          selectedKey={settings.themeMode}
          isOpen={openSelect === 'theme'}
          onToggle={() => toggleSelect('theme')}
          onSelect={(mode) => {
            patchSettings({ themeMode: mode as 'light' | 'dark' | 'system' }).catch(() => undefined);
            setOpenSelect(null);
          }}
          options={themeModes.map((mode) => ({
            key: mode,
            label: t(`settings.${mode}`),
          }))}
        />
      </SettingSection>

      {/* ── مصدر الثيم ── */}
      <SettingSection
        icon="cellphone-check"
        title={isAr ? 'مصدر الثيم' : 'Theme Source'}
        subtitle={isAr ? 'Material You أو ثيم ثابت' : 'Dynamic Material You or fixed theme'}
      >
        <SelectDropdown
          valueLabel={selectedThemeSourceLabel}
          selectedKey={themeSourceValue}
          isOpen={openSelect === 'themeSource'}
          onToggle={() => toggleSelect('themeSource')}
          onSelect={(source) => {
            patchSettings({ themeSource: source as 'material' | 'fixed' }).catch(() => undefined);
            setOpenSelect(null);
          }}
          options={themeSources.map((source) => ({
            key: source,
            label: source === 'material'
              ? 'Material You'
              : source === 'mono'
                ? (isAr ? 'أبيض وأسود' : 'Black & White')
                : (isAr ? 'ثابت' : 'Fixed'),
          }))}
        />
      </SettingSection>

      {/* ── تنسيق الوقت ── */}
      <SettingSection
        icon="clock-outline"
        title={isAr ? 'تنسيق الوقت' : 'Time Format'}
        subtitle={isAr ? '12 ساعة أو 24 ساعة' : '12-hour or 24-hour clock'}
      >
        <SelectDropdown
          valueLabel={selectedTimeFormatLabel}
          selectedKey={timeFormatValue}
          isOpen={openSelect === 'timeFormat'}
          onToggle={() => toggleSelect('timeFormat')}
          onSelect={(fmt) => {
            patchSettings({ timeFormat: fmt as '12h' | '24h' }).catch(() => undefined);
            setOpenSelect(null);
          }}
          options={timeFormats.map((fmt) => ({
            key: fmt,
            label: fmt === '12h' ? (isAr ? '١٢ ساعة' : '12h') : (isAr ? '٢٤ ساعة' : '24h'),
          }))}
        />
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
        <SelectDropdown
          valueLabel={selectedLockLabel}
          selectedKey={settings.lockMethod}
          isOpen={openSelect === 'lockMethod'}
          onToggle={() => toggleSelect('lockMethod')}
          onSelect={async (method) => {
            if (method === 'pin') {
              const hasPin = await securityService.hasPin();
              if (!hasPin) { Alert.alert(isAr ? 'احفظ الـ PIN أولاً' : 'Set a PIN first'); return; }
            }
            if (method === 'biometric') {
              const canUse = await securityService.canUseBiometric();
              if (!canUse) { Alert.alert(isAr ? 'البصمة غير متاحة' : 'Biometric unavailable'); return; }
            }
            await patchSettings({ lockMethod: method as 'none' | 'pin' | 'biometric' });
            setOpenSelect(null);
          }}
          options={lockMethods.map((method) => ({
            key: method,
            label: t(`settings.${method}`),
          }))}
        />

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
              await patchSettings({ lockMethod: 'none' });
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

      {/* ── التنبيهات ── */}
      <SettingSection
        icon="bell-outline"
        title={isAr ? 'التنبيهات' : 'Notifications'}
        subtitle={isAr ? 'تحكم بالتنبيهات الأساسية' : 'Control your reminders'}
      >
        <Pressable
          onPress={toggleNotifyBills}
          style={[styles.toggleRow, { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.outlineVariant }]}
        >
          <Text style={[styles.toggleLabel, { color: theme.colors.onSurface }]}>
            {isAr ? 'تنبيهات الفواتير' : 'Bill reminders'}
          </Text>
          <View style={[
            styles.togglePill,
            { backgroundColor: settings.notifyBillsEnabled ? theme.colors.primary : theme.colors.surface },
          ]}>
            <Text style={{ color: settings.notifyBillsEnabled ? theme.colors.onPrimary : theme.colors.onSurfaceVariant, fontWeight: '700' }}>
              {settings.notifyBillsEnabled ? (isAr ? 'مفعّل' : 'On') : (isAr ? 'متوقف' : 'Off')}
            </Text>
          </View>
        </Pressable>

        <Pressable
          onPress={toggleNotifyWork}
          style={[styles.toggleRow, { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.outlineVariant }]}
        >
          <Text style={[styles.toggleLabel, { color: theme.colors.onSurface }]}>
            {isAr ? 'تنبيهات الشغل' : 'Work reminders'}
          </Text>
          <View style={[
            styles.togglePill,
            { backgroundColor: settings.notifyWorkEnabled ? theme.colors.primary : theme.colors.surface },
          ]}>
            <Text style={{ color: settings.notifyWorkEnabled ? theme.colors.onPrimary : theme.colors.onSurfaceVariant, fontWeight: '700' }}>
              {settings.notifyWorkEnabled ? (isAr ? 'مفعّل' : 'On') : (isAr ? 'متوقف' : 'Off')}
            </Text>
          </View>
        </Pressable>

        <View style={styles.chips}>
          <ActionButton
            label={isAr ? 'اختبار تنبيه' : 'Test notification'}
            icon="bell-plus-outline"
            variant="secondary"
            onPress={() => {
              notificationService.scheduleTestNotification(5).catch(() => undefined);
              Alert.alert(isAr ? 'تم الإرسال' : 'Scheduled', isAr ? 'سيظهر التنبيه بعد 5 ثوانٍ.' : 'Notification will appear in 5 seconds.');
            }}
          />
          <ActionButton
            label={isAr ? 'مسح تنبيهات الاختبار' : 'Clear test notifications'}
            icon="bell-off-outline"
            variant="surface"
            onPress={() => {
              notificationService.cancelAllTestNotifications().catch(() => undefined);
              Alert.alert(isAr ? 'تم المسح' : 'Cleared', isAr ? 'تم حذف تنبيهات الاختبار.' : 'Test notifications cleared.');
            }}
          />
        </View>
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

  // toggles
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  toggleLabel: { fontSize: 14, fontWeight: '700' },
  togglePill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },

  // dropdown
  dropdownTrigger: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  dropdownValue: { fontSize: 14, fontWeight: '700' },
  dropdownList: {
    borderRadius: 14, borderWidth: 1,
    padding: 6, marginTop: 8, gap: 6,
  },
  dropdownOption: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1, borderColor: 'transparent',
  },
  dropdownOptionText: { fontSize: 13, fontWeight: '700' },
});
