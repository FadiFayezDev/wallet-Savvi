import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { getAll, getFirst, runQuery } from '@/src/db/client';
import type { CustomTheme } from '@/src/types/domain';
import { nowIso } from '@/src/utils/date';
import { normalizeHex } from '@/src/utils/colors';
import { assertRequired } from '@/src/utils/validation';

const THEME_EXPORT_VERSION = 1 as const;

interface ThemeRow {
  id: number;
  name: string;
  primary_color: string;
  secondary_color: string;
  created_at: string;
  updated_at: string;
}

interface ThemeExportPayloadV1 {
  meta: {
    version: 1;
    exportedAt: string;
    appVersion: string;
  };
  theme: {
    name: string;
    primary: string;
    secondary: string;
  };
}

const mapTheme = (row: ThemeRow): CustomTheme => ({
  id: row.id,
  name: row.name,
  primary: row.primary_color,
  secondary: row.secondary_color,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const validateThemePayload = (value: unknown): value is ThemeExportPayloadV1 => {
  if (!value || typeof value !== 'object') return false;
  const payload = value as ThemeExportPayloadV1;
  if (payload.meta?.version !== THEME_EXPORT_VERSION) return false;
  if (!payload.theme) return false;
  return (
    typeof payload.theme.name === 'string' &&
    typeof payload.theme.primary === 'string' &&
    typeof payload.theme.secondary === 'string'
  );
};

const normalizeColor = (value: string, label: string) => {
  const normalized = normalizeHex(value);
  if (!normalized) throw new Error(`${label} color is invalid.`);
  return normalized;
};

export const themeService = {
  async listThemes(): Promise<CustomTheme[]> {
    const rows = await getAll<ThemeRow>('SELECT * FROM custom_themes ORDER BY created_at DESC;');
    return rows.map(mapTheme);
  },

  async getTheme(id: number): Promise<CustomTheme | null> {
    const row = await getFirst<ThemeRow>('SELECT * FROM custom_themes WHERE id = ? LIMIT 1;', [id]);
    return row ? mapTheme(row) : null;
  },

  async createTheme(input: { name: string; primary: string; secondary: string }): Promise<CustomTheme> {
    assertRequired(input.name, 'Theme name');
    const now = nowIso();
    const primary = normalizeColor(input.primary, 'Primary');
    const secondary = normalizeColor(input.secondary, 'Secondary');
    await runQuery(
      `INSERT INTO custom_themes (name, primary_color, secondary_color, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?);`,
      [input.name.trim(), primary, secondary, now, now],
    );
    const row = await getFirst<ThemeRow>('SELECT * FROM custom_themes ORDER BY id DESC LIMIT 1;');
    if (!row) throw new Error('Failed to create theme.');
    return mapTheme(row);
  },

  async updateTheme(
    id: number,
    patch: Partial<Pick<CustomTheme, 'name' | 'primary' | 'secondary'>>,
  ): Promise<CustomTheme> {
    const row = await getFirst<ThemeRow>('SELECT * FROM custom_themes WHERE id = ? LIMIT 1;', [id]);
    if (!row) throw new Error('Theme not found.');
    const now = nowIso();
    const name = patch.name?.trim() || row.name;
    const primary = patch.primary ? normalizeColor(patch.primary, 'Primary') : row.primary_color;
    const secondary = patch.secondary ? normalizeColor(patch.secondary, 'Secondary') : row.secondary_color;
    await runQuery(
      `UPDATE custom_themes
       SET name = ?, primary_color = ?, secondary_color = ?, updated_at = ?
       WHERE id = ?;`,
      [name, primary, secondary, now, id],
    );
    return {
      id,
      name,
      primary,
      secondary,
      createdAt: row.created_at,
      updatedAt: now,
    };
  },

  async deleteTheme(id: number) {
    await runQuery('DELETE FROM custom_themes WHERE id = ?;', [id]);
  },

  async exportTheme(id: number): Promise<string> {
    const theme = await themeService.getTheme(id);
    if (!theme) throw new Error('Theme not found.');
    const payload: ThemeExportPayloadV1 = {
      meta: {
        version: THEME_EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        appVersion: Constants.expoConfig?.version ?? '1.0.0',
      },
      theme: {
        name: theme.name,
        primary: theme.primary,
        secondary: theme.secondary,
      },
    };

    const dir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
    if (!dir) throw new Error('No writable directory found on this device');
    const safeName = theme.name.replace(/[^a-zA-Z0-9-_]+/g, '-').slice(0, 24) || 'theme';
    const fileUri = `${dir}Savvi-theme-${safeName}-${Date.now()}.json`;
    await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(payload), {
      encoding: FileSystem.EncodingType.UTF8,
    });
    await Sharing.shareAsync(fileUri);
    return fileUri;
  },

  async importTheme(): Promise<CustomTheme | null> {
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

    let themeData: { name: string; primary: string; secondary: string } | null = null;
    if (validateThemePayload(parsed)) {
      themeData = parsed.theme;
    } else if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as any).name === 'string' &&
      typeof (parsed as any).primary === 'string' &&
      typeof (parsed as any).secondary === 'string'
    ) {
      themeData = parsed as { name: string; primary: string; secondary: string };
    }

    if (!themeData) {
      throw new Error('Invalid theme file');
    }

    return await themeService.createTheme({
      name: themeData.name,
      primary: themeData.primary,
      secondary: themeData.secondary,
    });
  },
};
