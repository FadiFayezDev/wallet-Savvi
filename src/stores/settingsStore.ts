import { create } from 'zustand';

import { settingsService } from '@/src/services/settingsService';
import type { AppSettings, LockMethod, ThemeMode } from '@/src/types/domain';

interface SettingsState {
  settings: AppSettings | null;
  isLoading: boolean;
  error: string | null;
  loadSettings: () => Promise<void>;
  patchSettings: (patch: Partial<AppSettings>) => Promise<void>;
  setLockMethod: (method: LockMethod) => Promise<void>;
  setLocale: (locale: 'ar' | 'en') => Promise<void>;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  isLoading: false,
  error: null,

  loadSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      const settings = await settingsService.getSettings();
      set({ settings, isLoading: false });
    } catch (error) {
      set({ isLoading: false, error: error instanceof Error ? error.message : 'Failed to load settings' });
    }
  },

  patchSettings: async (patch) => {
    set({ isLoading: true, error: null });
    try {
      const settings = await settingsService.updateSettings(patch);
      set({ settings, isLoading: false });
    } catch (error) {
      set({ isLoading: false, error: error instanceof Error ? error.message : 'Failed to update settings' });
      throw error;
    }
  },

  setLockMethod: async (method) => {
    await useSettingsStore.getState().patchSettings({ lockMethod: method });
  },

  setLocale: async (locale) => {
    await useSettingsStore.getState().patchSettings({ locale });
  },

  setThemeMode: async (mode) => {
    await useSettingsStore.getState().patchSettings({ themeMode: mode });
  },
}));
