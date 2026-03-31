import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { getAll, getFirst, runQuery } from '@/src/db/client';
import type { PaletteTheme, PaletteThemeColors } from '@/src/types/domain';
import { nowIso } from '@/src/utils/date';
import { normalizeHex } from '@/src/utils/colors';
import { assertRequired } from '@/src/utils/validation';

const PALETTE_EXPORT_VERSION = 1 as const;

interface PaletteRow {
  id: number;
  name: string;
  light_primary: string;
  light_on_primary: string;
  light_primary_container: string;
  light_on_primary_container: string;
  light_secondary: string;
  light_on_secondary: string;
  light_secondary_container: string;
  light_on_secondary_container: string;
  light_tertiary: string;
  light_on_tertiary: string;
  light_tertiary_container: string;
  light_on_tertiary_container: string;
  light_background: string;
  light_on_background: string;
  light_surface: string;
  light_on_surface: string;
  light_surface_variant: string;
  light_on_surface_variant: string;
  light_outline: string;
  light_outline_variant: string;
  light_error: string;
  light_on_error: string;
  light_error_container: string;
  light_on_error_container: string;
  light_success: string;
  light_on_success: string;
  light_success_container: string;
  light_on_success_container: string;
  light_warning: string;
  light_on_warning: string;
  light_warning_container: string;
  light_on_warning_container: string;
  light_info: string;
  light_on_info: string;
  light_info_container: string;
  light_on_info_container: string;
  light_header_gradient_start: string;
  light_header_gradient_mid: string;
  light_header_gradient_end: string;
  light_header_text: string;
  light_header_icon: string;
  light_icon_primary: string;
  light_icon_secondary: string;
  light_icon_muted: string;
  dark_primary: string;
  dark_on_primary: string;
  dark_primary_container: string;
  dark_on_primary_container: string;
  dark_secondary: string;
  dark_on_secondary: string;
  dark_secondary_container: string;
  dark_on_secondary_container: string;
  dark_tertiary: string;
  dark_on_tertiary: string;
  dark_tertiary_container: string;
  dark_on_tertiary_container: string;
  dark_background: string;
  dark_on_background: string;
  dark_surface: string;
  dark_on_surface: string;
  dark_surface_variant: string;
  dark_on_surface_variant: string;
  dark_outline: string;
  dark_outline_variant: string;
  dark_error: string;
  dark_on_error: string;
  dark_error_container: string;
  dark_on_error_container: string;
  dark_success: string;
  dark_on_success: string;
  dark_success_container: string;
  dark_on_success_container: string;
  dark_warning: string;
  dark_on_warning: string;
  dark_warning_container: string;
  dark_on_warning_container: string;
  dark_info: string;
  dark_on_info: string;
  dark_info_container: string;
  dark_on_info_container: string;
  dark_header_gradient_start: string;
  dark_header_gradient_mid: string;
  dark_header_gradient_end: string;
  dark_header_text: string;
  dark_header_icon: string;
  dark_icon_primary: string;
  dark_icon_secondary: string;
  dark_icon_muted: string;
  created_at: string;
  updated_at: string;
}

interface PaletteExportPayloadV1 {
  meta: {
    version: 1;
    exportedAt: string;
    appVersion: string;
  };
  theme: {
    name: string;
    light: PaletteThemeColors;
    dark: PaletteThemeColors;
  };
}

const normalizeColor = (value: string, label: string) => {
  const normalized = normalizeHex(value);
  if (!normalized) throw new Error(`${label} color is invalid.`);
  return normalized;
};

const normalizePalette = (palette: PaletteThemeColors) => ({
  primary: normalizeColor(palette.primary, 'primary'),
  onPrimary: normalizeColor(palette.onPrimary, 'onPrimary'),
  primaryContainer: normalizeColor(palette.primaryContainer, 'primaryContainer'),
  onPrimaryContainer: normalizeColor(palette.onPrimaryContainer, 'onPrimaryContainer'),
  secondary: normalizeColor(palette.secondary, 'secondary'),
  onSecondary: normalizeColor(palette.onSecondary, 'onSecondary'),
  secondaryContainer: normalizeColor(palette.secondaryContainer, 'secondaryContainer'),
  onSecondaryContainer: normalizeColor(palette.onSecondaryContainer, 'onSecondaryContainer'),
  tertiary: normalizeColor(palette.tertiary, 'tertiary'),
  onTertiary: normalizeColor(palette.onTertiary, 'onTertiary'),
  tertiaryContainer: normalizeColor(palette.tertiaryContainer, 'tertiaryContainer'),
  onTertiaryContainer: normalizeColor(palette.onTertiaryContainer, 'onTertiaryContainer'),
  background: normalizeColor(palette.background, 'background'),
  onBackground: normalizeColor(palette.onBackground, 'onBackground'),
  surface: normalizeColor(palette.surface, 'surface'),
  onSurface: normalizeColor(palette.onSurface, 'onSurface'),
  surfaceVariant: normalizeColor(palette.surfaceVariant, 'surfaceVariant'),
  onSurfaceVariant: normalizeColor(palette.onSurfaceVariant, 'onSurfaceVariant'),
  outline: normalizeColor(palette.outline, 'outline'),
  outlineVariant: normalizeColor(palette.outlineVariant, 'outlineVariant'),
  error: normalizeColor(palette.error, 'error'),
  onError: normalizeColor(palette.onError, 'onError'),
  errorContainer: normalizeColor(palette.errorContainer, 'errorContainer'),
  onErrorContainer: normalizeColor(palette.onErrorContainer, 'onErrorContainer'),
  success: normalizeColor(palette.success, 'success'),
  onSuccess: normalizeColor(palette.onSuccess, 'onSuccess'),
  successContainer: normalizeColor(palette.successContainer, 'successContainer'),
  onSuccessContainer: normalizeColor(palette.onSuccessContainer, 'onSuccessContainer'),
  warning: normalizeColor(palette.warning, 'warning'),
  onWarning: normalizeColor(palette.onWarning, 'onWarning'),
  warningContainer: normalizeColor(palette.warningContainer, 'warningContainer'),
  onWarningContainer: normalizeColor(palette.onWarningContainer, 'onWarningContainer'),
  info: normalizeColor(palette.info, 'info'),
  onInfo: normalizeColor(palette.onInfo, 'onInfo'),
  infoContainer: normalizeColor(palette.infoContainer, 'infoContainer'),
  onInfoContainer: normalizeColor(palette.onInfoContainer, 'onInfoContainer'),
  headerGradientStart: normalizeColor(palette.headerGradientStart, 'headerGradientStart'),
  headerGradientMid: normalizeColor(palette.headerGradientMid, 'headerGradientMid'),
  headerGradientEnd: normalizeColor(palette.headerGradientEnd, 'headerGradientEnd'),
  headerText: normalizeColor(palette.headerText, 'headerText'),
  headerIcon: normalizeColor(palette.headerIcon, 'headerIcon'),
  iconPrimary: normalizeColor(palette.iconPrimary, 'iconPrimary'),
  iconSecondary: normalizeColor(palette.iconSecondary, 'iconSecondary'),
  iconMuted: normalizeColor(palette.iconMuted, 'iconMuted'),
});

const mapPalette = (row: PaletteRow): PaletteTheme => ({
  id: row.id,
  name: row.name,
  light: {
    primary: row.light_primary,
    onPrimary: row.light_on_primary,
    primaryContainer: row.light_primary_container,
    onPrimaryContainer: row.light_on_primary_container,
    secondary: row.light_secondary,
    onSecondary: row.light_on_secondary,
    secondaryContainer: row.light_secondary_container,
    onSecondaryContainer: row.light_on_secondary_container,
    tertiary: row.light_tertiary,
    onTertiary: row.light_on_tertiary,
    tertiaryContainer: row.light_tertiary_container,
    onTertiaryContainer: row.light_on_tertiary_container,
    background: row.light_background,
    onBackground: row.light_on_background,
    surface: row.light_surface,
    onSurface: row.light_on_surface,
    surfaceVariant: row.light_surface_variant,
    onSurfaceVariant: row.light_on_surface_variant,
    outline: row.light_outline,
    outlineVariant: row.light_outline_variant,
    error: row.light_error,
    onError: row.light_on_error,
    errorContainer: row.light_error_container,
    onErrorContainer: row.light_on_error_container,
    success: row.light_success,
    onSuccess: row.light_on_success,
    successContainer: row.light_success_container,
    onSuccessContainer: row.light_on_success_container,
    warning: row.light_warning,
    onWarning: row.light_on_warning,
    warningContainer: row.light_warning_container,
    onWarningContainer: row.light_on_warning_container,
    info: row.light_info,
    onInfo: row.light_on_info,
    infoContainer: row.light_info_container,
    onInfoContainer: row.light_on_info_container,
    headerGradientStart: row.light_header_gradient_start,
    headerGradientMid: row.light_header_gradient_mid,
    headerGradientEnd: row.light_header_gradient_end,
    headerText: row.light_header_text,
    headerIcon: row.light_header_icon,
    iconPrimary: row.light_icon_primary,
    iconSecondary: row.light_icon_secondary,
    iconMuted: row.light_icon_muted,
  },
  dark: {
    primary: row.dark_primary,
    onPrimary: row.dark_on_primary,
    primaryContainer: row.dark_primary_container,
    onPrimaryContainer: row.dark_on_primary_container,
    secondary: row.dark_secondary,
    onSecondary: row.dark_on_secondary,
    secondaryContainer: row.dark_secondary_container,
    onSecondaryContainer: row.dark_on_secondary_container,
    tertiary: row.dark_tertiary,
    onTertiary: row.dark_on_tertiary,
    tertiaryContainer: row.dark_tertiary_container,
    onTertiaryContainer: row.dark_on_tertiary_container,
    background: row.dark_background,
    onBackground: row.dark_on_background,
    surface: row.dark_surface,
    onSurface: row.dark_on_surface,
    surfaceVariant: row.dark_surface_variant,
    onSurfaceVariant: row.dark_on_surface_variant,
    outline: row.dark_outline,
    outlineVariant: row.dark_outline_variant,
    error: row.dark_error,
    onError: row.dark_on_error,
    errorContainer: row.dark_error_container,
    onErrorContainer: row.dark_on_error_container,
    success: row.dark_success,
    onSuccess: row.dark_on_success,
    successContainer: row.dark_success_container,
    onSuccessContainer: row.dark_on_success_container,
    warning: row.dark_warning,
    onWarning: row.dark_on_warning,
    warningContainer: row.dark_warning_container,
    onWarningContainer: row.dark_on_warning_container,
    info: row.dark_info,
    onInfo: row.dark_on_info,
    infoContainer: row.dark_info_container,
    onInfoContainer: row.dark_on_info_container,
    headerGradientStart: row.dark_header_gradient_start,
    headerGradientMid: row.dark_header_gradient_mid,
    headerGradientEnd: row.dark_header_gradient_end,
    headerText: row.dark_header_text,
    headerIcon: row.dark_header_icon,
    iconPrimary: row.dark_icon_primary,
    iconSecondary: row.dark_icon_secondary,
    iconMuted: row.dark_icon_muted,
  },
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const validatePalettePayload = (value: unknown): value is PaletteExportPayloadV1 => {
  if (!value || typeof value !== 'object') return false;
  const payload = value as PaletteExportPayloadV1;
  if (payload.meta?.version !== PALETTE_EXPORT_VERSION) return false;
  if (!payload.theme) return false;
  return (
    typeof payload.theme.name === 'string' &&
    typeof payload.theme.light === 'object' &&
    typeof payload.theme.dark === 'object'
  );
};

export const paletteThemeService = {
  async listThemes(): Promise<PaletteTheme[]> {
    const rows = await getAll<PaletteRow>('SELECT * FROM palette_themes ORDER BY created_at DESC;');
    return rows.map(mapPalette);
  },

  async getTheme(id: number): Promise<PaletteTheme | null> {
    const row = await getFirst<PaletteRow>('SELECT * FROM palette_themes WHERE id = ? LIMIT 1;', [id]);
    return row ? mapPalette(row) : null;
  },

  async createTheme(input: { name: string; light: PaletteThemeColors; dark: PaletteThemeColors }): Promise<PaletteTheme> {
    assertRequired(input.name, 'Theme name');
    const now = nowIso();
    const light = normalizePalette(input.light);
    const dark = normalizePalette(input.dark);
    await runQuery(
      `INSERT INTO palette_themes
       (name,
        light_primary, light_on_primary, light_primary_container, light_on_primary_container,
        light_secondary, light_on_secondary, light_secondary_container, light_on_secondary_container,
        light_tertiary, light_on_tertiary, light_tertiary_container, light_on_tertiary_container,
        light_background, light_on_background, light_surface, light_on_surface,
        light_surface_variant, light_on_surface_variant, light_outline, light_outline_variant,
        light_error, light_on_error, light_error_container, light_on_error_container,
        light_success, light_on_success, light_success_container, light_on_success_container,
        light_warning, light_on_warning, light_warning_container, light_on_warning_container,
        light_info, light_on_info, light_info_container, light_on_info_container,
        light_header_gradient_start, light_header_gradient_mid, light_header_gradient_end,
        light_header_text, light_header_icon,
        light_icon_primary, light_icon_secondary, light_icon_muted,
        dark_primary, dark_on_primary, dark_primary_container, dark_on_primary_container,
        dark_secondary, dark_on_secondary, dark_secondary_container, dark_on_secondary_container,
        dark_tertiary, dark_on_tertiary, dark_tertiary_container, dark_on_tertiary_container,
        dark_background, dark_on_background, dark_surface, dark_on_surface,
        dark_surface_variant, dark_on_surface_variant, dark_outline, dark_outline_variant,
        dark_error, dark_on_error, dark_error_container, dark_on_error_container,
        dark_success, dark_on_success, dark_success_container, dark_on_success_container,
        dark_warning, dark_on_warning, dark_warning_container, dark_on_warning_container,
        dark_info, dark_on_info, dark_info_container, dark_on_info_container,
        dark_header_gradient_start, dark_header_gradient_mid, dark_header_gradient_end,
        dark_header_text, dark_header_icon,
        dark_icon_primary, dark_icon_secondary, dark_icon_muted,
        created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?);`,
      [
        input.name.trim(),
        light.primary, light.onPrimary, light.primaryContainer, light.onPrimaryContainer,
        light.secondary, light.onSecondary, light.secondaryContainer, light.onSecondaryContainer,
        light.tertiary, light.onTertiary, light.tertiaryContainer, light.onTertiaryContainer,
        light.background, light.onBackground, light.surface, light.onSurface,
        light.surfaceVariant, light.onSurfaceVariant, light.outline, light.outlineVariant,
        light.error, light.onError, light.errorContainer, light.onErrorContainer,
        light.success, light.onSuccess, light.successContainer, light.onSuccessContainer,
        light.warning, light.onWarning, light.warningContainer, light.onWarningContainer,
        light.info, light.onInfo, light.infoContainer, light.onInfoContainer,
        light.headerGradientStart, light.headerGradientMid, light.headerGradientEnd,
        light.headerText, light.headerIcon,
        light.iconPrimary, light.iconSecondary, light.iconMuted,
        dark.primary, dark.onPrimary, dark.primaryContainer, dark.onPrimaryContainer,
        dark.secondary, dark.onSecondary, dark.secondaryContainer, dark.onSecondaryContainer,
        dark.tertiary, dark.onTertiary, dark.tertiaryContainer, dark.onTertiaryContainer,
        dark.background, dark.onBackground, dark.surface, dark.onSurface,
        dark.surfaceVariant, dark.onSurfaceVariant, dark.outline, dark.outlineVariant,
        dark.error, dark.onError, dark.errorContainer, dark.onErrorContainer,
        dark.success, dark.onSuccess, dark.successContainer, dark.onSuccessContainer,
        dark.warning, dark.onWarning, dark.warningContainer, dark.onWarningContainer,
        dark.info, dark.onInfo, dark.infoContainer, dark.onInfoContainer,
        dark.headerGradientStart, dark.headerGradientMid, dark.headerGradientEnd,
        dark.headerText, dark.headerIcon,
        dark.iconPrimary, dark.iconSecondary, dark.iconMuted,
        now, now,
      ],
    );
    const row = await getFirst<PaletteRow>('SELECT * FROM palette_themes ORDER BY id DESC LIMIT 1;');
    if (!row) throw new Error('Failed to create theme.');
    return mapPalette(row);
  },

  async updateTheme(
    id: number,
    patch: Partial<Pick<PaletteTheme, 'name' | 'light' | 'dark'>>,
  ): Promise<PaletteTheme> {
    const row = await getFirst<PaletteRow>('SELECT * FROM palette_themes WHERE id = ? LIMIT 1;', [id]);
    if (!row) throw new Error('Theme not found.');
    const now = nowIso();
    const light = patch.light ? normalizePalette(patch.light) : mapPalette(row).light;
    const dark = patch.dark ? normalizePalette(patch.dark) : mapPalette(row).dark;
    const name = patch.name?.trim() || row.name;
    await runQuery(
      `UPDATE palette_themes SET
        name = ?,
        light_primary = ?, light_on_primary = ?, light_primary_container = ?, light_on_primary_container = ?,
        light_secondary = ?, light_on_secondary = ?, light_secondary_container = ?, light_on_secondary_container = ?,
        light_tertiary = ?, light_on_tertiary = ?, light_tertiary_container = ?, light_on_tertiary_container = ?,
        light_background = ?, light_on_background = ?, light_surface = ?, light_on_surface = ?,
        light_surface_variant = ?, light_on_surface_variant = ?, light_outline = ?, light_outline_variant = ?,
        light_error = ?, light_on_error = ?, light_error_container = ?, light_on_error_container = ?,
        light_success = ?, light_on_success = ?, light_success_container = ?, light_on_success_container = ?,
        light_warning = ?, light_on_warning = ?, light_warning_container = ?, light_on_warning_container = ?,
        light_info = ?, light_on_info = ?, light_info_container = ?, light_on_info_container = ?,
        light_header_gradient_start = ?, light_header_gradient_mid = ?, light_header_gradient_end = ?,
        light_header_text = ?, light_header_icon = ?,
        light_icon_primary = ?, light_icon_secondary = ?, light_icon_muted = ?,
        dark_primary = ?, dark_on_primary = ?, dark_primary_container = ?, dark_on_primary_container = ?,
        dark_secondary = ?, dark_on_secondary = ?, dark_secondary_container = ?, dark_on_secondary_container = ?,
        dark_tertiary = ?, dark_on_tertiary = ?, dark_tertiary_container = ?, dark_on_tertiary_container = ?,
        dark_background = ?, dark_on_background = ?, dark_surface = ?, dark_on_surface = ?,
        dark_surface_variant = ?, dark_on_surface_variant = ?, dark_outline = ?, dark_outline_variant = ?,
        dark_error = ?, dark_on_error = ?, dark_error_container = ?, dark_on_error_container = ?,
        dark_success = ?, dark_on_success = ?, dark_success_container = ?, dark_on_success_container = ?,
        dark_warning = ?, dark_on_warning = ?, dark_warning_container = ?, dark_on_warning_container = ?,
        dark_info = ?, dark_on_info = ?, dark_info_container = ?, dark_on_info_container = ?,
        dark_header_gradient_start = ?, dark_header_gradient_mid = ?, dark_header_gradient_end = ?,
        dark_header_text = ?, dark_header_icon = ?,
        dark_icon_primary = ?, dark_icon_secondary = ?, dark_icon_muted = ?,
        updated_at = ?
       WHERE id = ?;`,
      [
        name,
        light.primary, light.onPrimary, light.primaryContainer, light.onPrimaryContainer,
        light.secondary, light.onSecondary, light.secondaryContainer, light.onSecondaryContainer,
        light.tertiary, light.onTertiary, light.tertiaryContainer, light.onTertiaryContainer,
        light.background, light.onBackground, light.surface, light.onSurface,
        light.surfaceVariant, light.onSurfaceVariant, light.outline, light.outlineVariant,
        light.error, light.onError, light.errorContainer, light.onErrorContainer,
        light.success, light.onSuccess, light.successContainer, light.onSuccessContainer,
        light.warning, light.onWarning, light.warningContainer, light.onWarningContainer,
        light.info, light.onInfo, light.infoContainer, light.onInfoContainer,
        light.headerGradientStart, light.headerGradientMid, light.headerGradientEnd,
        light.headerText, light.headerIcon,
        light.iconPrimary, light.iconSecondary, light.iconMuted,
        dark.primary, dark.onPrimary, dark.primaryContainer, dark.onPrimaryContainer,
        dark.secondary, dark.onSecondary, dark.secondaryContainer, dark.onSecondaryContainer,
        dark.tertiary, dark.onTertiary, dark.tertiaryContainer, dark.onTertiaryContainer,
        dark.background, dark.onBackground, dark.surface, dark.onSurface,
        dark.surfaceVariant, dark.onSurfaceVariant, dark.outline, dark.outlineVariant,
        dark.error, dark.onError, dark.errorContainer, dark.onErrorContainer,
        dark.success, dark.onSuccess, dark.successContainer, dark.onSuccessContainer,
        dark.warning, dark.onWarning, dark.warningContainer, dark.onWarningContainer,
        dark.info, dark.onInfo, dark.infoContainer, dark.onInfoContainer,
        dark.headerGradientStart, dark.headerGradientMid, dark.headerGradientEnd,
        dark.headerText, dark.headerIcon,
        dark.iconPrimary, dark.iconSecondary, dark.iconMuted,
        now,
        id,
      ],
    );
    return { id, name, light, dark, createdAt: row.created_at, updatedAt: now };
  },

  async deleteTheme(id: number) {
    await runQuery('DELETE FROM palette_themes WHERE id = ?;', [id]);
  },

  async exportTheme(id: number): Promise<string> {
    const theme = await paletteThemeService.getTheme(id);
    if (!theme) throw new Error('Theme not found.');
    const payload: PaletteExportPayloadV1 = {
      meta: {
        version: PALETTE_EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        appVersion: Constants.expoConfig?.version ?? '1.0.0',
      },
      theme: {
        name: theme.name,
        light: theme.light,
        dark: theme.dark,
      },
    };

    const dir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
    if (!dir) throw new Error('No writable directory found on this device');
    const safeName = theme.name.replace(/[^a-zA-Z0-9-_]+/g, '-').slice(0, 24) || 'theme';
    const fileUri = `${dir}Savvi-palette-${safeName}-${Date.now()}.json`;
    await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(payload), {
      encoding: FileSystem.EncodingType.UTF8,
    });
    await Sharing.shareAsync(fileUri);
    return fileUri;
  },

  async importTheme(): Promise<PaletteTheme | null> {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || result.assets.length === 0) return null;

    const raw = await FileSystem.readAsStringAsync(result.assets[0].uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    const parsed = JSON.parse(raw) as unknown;

    let themeData: { name: string; light: PaletteThemeColors; dark: PaletteThemeColors } | null = null;
    if (validatePalettePayload(parsed)) {
      themeData = parsed.theme;
    } else if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as any).name === 'string' &&
      typeof (parsed as any).light === 'object' &&
      typeof (parsed as any).dark === 'object'
    ) {
      themeData = parsed as { name: string; light: PaletteThemeColors; dark: PaletteThemeColors };
    }

    if (!themeData) {
      throw new Error('Invalid theme file');
    }

    return await paletteThemeService.createTheme({
      name: themeData.name,
      light: themeData.light,
      dark: themeData.dark,
    });
  },
};
