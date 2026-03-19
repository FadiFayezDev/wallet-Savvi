import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationDefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import {
  MD3DarkTheme,
  MD3LightTheme,
  PaperProvider,
  adaptNavigationTheme,
} from "react-native-paper";

// حل مشكلة الـ Linking في Expo Go
let MaterialYouColors: any = null;
try {
  MaterialYouColors = require("react-native-material-you-colors").default;
} catch (e) {}

import { useColorScheme } from "@/hooks/use-color-scheme";
import { LockScreen } from "@/src/components/common/LockScreen";
import { useAppStore } from "@/src/stores/appStore";
import { useSettingsStore } from "@/src/stores/settingsStore";
import "react-native-reanimated";
import "./global.css";

const { LightTheme, DarkTheme } = adaptNavigationTheme({
  reactNavigationLight: NavigationDefaultTheme,
  reactNavigationDark: NavigationDarkTheme,
});

export default function RootLayout() {

  const systemScheme = useColorScheme();
  const settings = useSettingsStore((state) => state.settings);
  const loadSettings = useSettingsStore((state) => state.loadSettings);
  const [systemPalette, setSystemPalette] = useState<any | null>(null);
  const bootstrap = useAppStore((state) => state.bootstrap);
  const isReady = useAppStore((state) => state.isReady);
  const isLocked = useAppStore((state) => state.isLocked);
  const lock = useAppStore((state) => state.lock);
  const unlock = useAppStore((state) => state.unlock);
  const lockMethod = useSettingsStore((state) => state.settings?.lockMethod ?? "none");
  const autoLockSeconds = useSettingsStore((state) => state.settings?.autoLockSeconds ?? 30);
  const backgroundAt = useRef<number | null>(null);

  useEffect(() => {
    loadSettings().catch(() => undefined);
    bootstrap().catch(() => undefined);
    // محاولة سحب الألوان بأمان
    if (Platform.OS === "android" && MaterialYouColors) {
      try {
        const result = MaterialYouColors.getMaterialYouPalette();
        // بعض الإصدارات ترجع Promise وبعضها ترجع القيمة مباشرة
        if (result && typeof result.then === "function") {
          result
            .then((res: any) => {
              if (res && typeof res === "object") setSystemPalette(res);
            })
            .catch(() => null);
        } else if (result && typeof result === "object") {
          // القيمة مباشرة (sync)
          setSystemPalette(result);
        }
      } catch {
        // تجاهل أي خطأ بأمان
      }
    }
  }, []);

  useEffect(() => {
    if (lockMethod === "none") {
      unlock();
    } else {
      lock();
    }
  }, [lockMethod, lock, unlock]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive") {
        backgroundAt.current = Date.now();
        return;
      }
      if (state === "active") {
        if (lockMethod === "none") {
          unlock();
          return;
        }
        if (backgroundAt.current == null) return;
        const elapsedMs = Date.now() - backgroundAt.current;
        if (autoLockSeconds <= 0 || elapsedMs >= autoLockSeconds * 1000) {
          lock();
        }
      }
    });
    return () => sub.remove();
  }, [autoLockSeconds, lock, lockMethod, unlock]);

  const resolvedThemeMode = useMemo(() => {
    if (!settings) return "dark";
    return settings.themeMode === "system"
      ? (systemScheme ?? "dark")
      : settings.themeMode;
  }, [settings, systemScheme]);

  const themeSource = settings?.themeSource ?? "material";

  const applyFixedColors = (isDark: boolean) => {
    if (isDark) {
      return {
        primary: "#38BDF8",
        onPrimary: "#0F172A",
        secondary: "#34D399",
        onSecondary: "#064E3B",
        tertiary: "#FBBF24",
        onTertiary: "#1F2937",
        background: "#0B0F14",
        onBackground: "#E5E7EB",
        surface: "#0F141B",
        onSurface: "#E5E7EB",
        surfaceVariant: "#151B24",
        onSurfaceVariant: "#9CA3AF",
        outline: "#2A3340",
        outlineVariant: "#1F2937",
      };
    }
    return {
      primary: "#2563EB",
      onPrimary: "#F8FAFC",
      secondary: "#059669",
      onSecondary: "#ECFDF3",
      tertiary: "#F59E0B",
      onTertiary: "#1F2937",
      background: "#F8FAFC",
      onBackground: "#0F172A",
      surface: "#FFFFFF",
      onSurface: "#0F172A",
      surfaceVariant: "#EEF2F7",
      onSurfaceVariant: "#64748B",
      outline: "#CBD5E1",
      outlineVariant: "#E2E8F0",
    };
  };

  const finalTheme = useMemo(() => {
    const isDark = resolvedThemeMode === "dark";
    const basePaper = isDark ? MD3DarkTheme : MD3LightTheme;
    const baseNav = isDark ? DarkTheme : LightTheme;

    if (themeSource === "fixed") {
      const colors = {
        ...basePaper.colors,
        ...applyFixedColors(isDark),
      };
      return {
        paper: { ...basePaper, colors },
        nav: {
          ...baseNav,
          colors: {
            ...baseNav.colors,
            card: colors.surface,
            background: colors.background,
          },
        },
      };
    }

    if (!systemPalette) return { paper: basePaper, nav: baseNav };

    // استخراج الـ tones من الـ palettes المختلفة
    // system_accent1 = primary, system_accent2 = secondary, system_accent3 = tertiary
    const a1 = systemPalette.system_accent1 ?? [];
    const a2 = systemPalette.system_accent2 ?? [];
    const a3 = systemPalette.system_accent3 ?? [];
    const n1 = systemPalette.system_neutral1 ?? [];
    const n2 = systemPalette.system_neutral2 ?? [];

    // tone indices: [0]=0, [1]=10, [2]=50, [3]=100, [4]=200, [5]=300, [6]=400, [7]=500, [8]=600, [9]=700, [10]=800, [11]=900, [12]=950
    const colors = isDark
      ? {
          ...basePaper.colors,
          // Primary - tone 200 للـ dark
          primary: a1[4] ?? basePaper.colors.primary,
          onPrimary: a1[10] ?? basePaper.colors.onPrimary,
          primaryContainer: a1[9] ?? basePaper.colors.primaryContainer,
          onPrimaryContainer: a1[2] ?? basePaper.colors.onPrimaryContainer,
          // Secondary
          secondary: a2[4] ?? basePaper.colors.secondary,
          onSecondary: a2[10] ?? basePaper.colors.onSecondary,
          secondaryContainer: a2[9] ?? basePaper.colors.secondaryContainer,
          onSecondaryContainer: a2[2] ?? basePaper.colors.onSecondaryContainer,
          // Tertiary
          tertiary: a3[4] ?? basePaper.colors.tertiary,
          onTertiary: a3[10] ?? basePaper.colors.onTertiary,
          tertiaryContainer: a3[9] ?? basePaper.colors.tertiaryContainer,
          onTertiaryContainer: a3[2] ?? basePaper.colors.onTertiaryContainer,
          // Surface / Background - ألوان ثابتة غامقة مع lوكال تلوين خفيف من الـ palette
          background: n1[11] ?? "#0F1117",
          onBackground: n1[1] ?? basePaper.colors.onBackground,
          surface: n1[11] ?? "#0F1117",
          onSurface: n1[1] ?? basePaper.colors.onSurface,
          surfaceVariant: n2[9] ?? "#1A1C23",
          onSurfaceVariant: n2[3] ?? basePaper.colors.onSurfaceVariant,
          outline: n2[5] ?? basePaper.colors.outline,
          outlineVariant: n2[8] ?? basePaper.colors.outlineVariant,
          elevation: {
            ...basePaper.colors.elevation,
            level0: "transparent",
            level1: n1[10] ?? "#141720",
            level2: n1[10] ?? "#1A1D24",
            level3: n1[9] ?? "#1E2128",
          },
        }
      : {
          ...basePaper.colors,
          // Primary - tone 600 للـ light
          primary: a1[8] ?? basePaper.colors.primary,
          onPrimary: a1[1] ?? basePaper.colors.onPrimary,
          primaryContainer: a1[3] ?? basePaper.colors.primaryContainer,
          onPrimaryContainer: a1[10] ?? basePaper.colors.onPrimaryContainer,
          // Secondary
          secondary: a2[8] ?? basePaper.colors.secondary,
          onSecondary: a2[1] ?? basePaper.colors.onSecondary,
          secondaryContainer: a2[3] ?? basePaper.colors.secondaryContainer,
          onSecondaryContainer: a2[10] ?? basePaper.colors.onSecondaryContainer,
          // Tertiary
          tertiary: a3[8] ?? basePaper.colors.tertiary,
          onTertiary: a3[1] ?? basePaper.colors.onTertiary,
          tertiaryContainer: a3[3] ?? basePaper.colors.tertiaryContainer,
          onTertiaryContainer: a3[10] ?? basePaper.colors.onTertiaryContainer,
          // Surface
          background: n1[1] ?? basePaper.colors.background,
          onBackground: n1[11] ?? basePaper.colors.onBackground,
          surface: n1[1] ?? basePaper.colors.surface,
          onSurface: n1[11] ?? basePaper.colors.onSurface,
          surfaceVariant: n2[2] ?? basePaper.colors.surfaceVariant,
          onSurfaceVariant: n2[9] ?? basePaper.colors.onSurfaceVariant,
          outline: n2[6] ?? basePaper.colors.outline,
          outlineVariant: n2[3] ?? basePaper.colors.outlineVariant,
        };

    return {
      paper: { ...basePaper, colors },
      nav: {
        ...baseNav,
        colors: {
          ...baseNav.colors,
          card: colors.surface,
          background: colors.background,
        },
      },
    };
  }, [systemPalette, resolvedThemeMode, themeSource]);

  if (!isReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider theme={finalTheme.paper}>
          <ThemeProvider value={finalTheme.nav}>
            <SafeAreaView
              style={{ flex: 1, backgroundColor: finalTheme.paper.colors.background }}
              edges={["top", "bottom"]}
            >
              <Stack screenOptions={{ headerShown: false, }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="transactions/add-expense" />
                <Stack.Screen name="transactions/add-income" />
                <Stack.Screen name="categories/manage" />
                <Stack.Screen name="bills/index" />
                <Stack.Screen name="work/index" />
                <Stack.Screen name="reports/current" />
              </Stack>
              {isLocked && lockMethod !== "none" ? <LockScreen /> : null}
            </SafeAreaView>
            <StatusBar style={resolvedThemeMode === "dark" ? "light" : "dark"} />
          </ThemeProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
