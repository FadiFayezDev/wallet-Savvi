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
import * as Notifications from "expo-notifications";

// حل مشكلة الـ Linking في Expo Go
let MaterialYouColors: any = null;
try {
  MaterialYouColors = require("react-native-material-you-colors").default;
} catch (e) {}

import { useColorScheme } from "@/hooks/use-color-scheme";
import { LockScreen } from "@/src/components/common/LockScreen";
import { useAppStore } from "@/src/stores/appStore";
import { useSettingsStore } from "@/src/stores/settingsStore";
import { notificationService } from "@/src/services/notificationService";
import { themeService } from "@/src/services/themeService";
import { paletteThemeService } from "@/src/services/paletteThemeService";
import type { CustomTheme, PaletteTheme } from "@/src/types/domain";
import { deriveCustomThemeColors, mixColors } from "@/src/utils/colors";
import { useRouter } from "expo-router";
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
  const [customTheme, setCustomTheme] = useState<CustomTheme | null>(null);
  const [paletteTheme, setPaletteTheme] = useState<PaletteTheme | null>(null);
  const bootstrap = useAppStore((state) => state.bootstrap);
  const isReady = useAppStore((state) => state.isReady);
  const router = useRouter();
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
    notificationService.init()
      .then(() => notificationService.rescheduleAll())
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const handleResponse = (response: Notifications.NotificationResponse) => {
      const data = response?.notification?.request?.content?.data as any;
      if (!data?.type) return;
      if (data.type === "bill") router.push("/bills");
      if (data.type === "work") router.push("/work");
    };

    Notifications.getLastNotificationResponseAsync()
      .then((response) => { if (response) handleResponse(response); })
      .catch(() => undefined);

    const sub = Notifications.addNotificationResponseReceivedListener(handleResponse);
    return () => sub.remove();
  }, [router]);

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

  useEffect(() => {
    let isAlive = true;
    if (themeSource === "custom" && settings?.activeThemeId) {
      themeService.getTheme(settings.activeThemeId)
        .then((theme) => { if (isAlive) setCustomTheme(theme); })
        .catch(() => { if (isAlive) setCustomTheme(null); });
    } else {
      setCustomTheme(null);
    }
    return () => { isAlive = false; };
  }, [themeSource, settings?.activeThemeId, settings?.updatedAt]);

  useEffect(() => {
    let isAlive = true;
    if (themeSource === "palette" && settings?.activePaletteThemeId) {
      paletteThemeService.getTheme(settings.activePaletteThemeId)
        .then((theme) => { if (isAlive) setPaletteTheme(theme); })
        .catch(() => { if (isAlive) setPaletteTheme(null); });
    } else {
      setPaletteTheme(null);
    }
    return () => { isAlive = false; };
  }, [themeSource, settings?.activePaletteThemeId, settings?.updatedAt]);

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

  const applyMonoColors = (isDark: boolean) => {
    if (isDark) {
      return {
        primary: "#FFFFFF",
        onPrimary: "#000000",
        primaryContainer: "#1A1A1A",
        onPrimaryContainer: "#FFFFFF",
        secondary: "#E6E6E6",
        onSecondary: "#000000",
        secondaryContainer: "#222222",
        onSecondaryContainer: "#FFFFFF",
        tertiary: "#CCCCCC",
        onTertiary: "#000000",
        tertiaryContainer: "#262626",
        onTertiaryContainer: "#FFFFFF",
        background: "#000000",
        onBackground: "#FFFFFF",
        surface: "#0A0A0A",
        onSurface: "#FFFFFF",
        surfaceVariant: "#141414",
        onSurfaceVariant: "#BDBDBD",
        outline: "#2E2E2E",
        outlineVariant: "#3A3A3A",
        inverseSurface: "#FFFFFF",
        inverseOnSurface: "#000000",
        inversePrimary: "#000000",
        error: "#FCA5A5",
        onError: "#3F0A0A",
        errorContainer: "#4B0A0A",
        onErrorContainer: "#FEE2E2",
        surfaceDisabled: "#121212",
        onSurfaceDisabled: "#6B6B6B",
        backdrop: "#000000",
        shadow: "#000000",
        scrim: "#000000",
      };
    }
    return {
      primary: "#000000",
      onPrimary: "#FFFFFF",
      primaryContainer: "#E6E6E6",
      onPrimaryContainer: "#000000",
      secondary: "#1A1A1A",
      onSecondary: "#FFFFFF",
      secondaryContainer: "#E0E0E0",
      onSecondaryContainer: "#000000",
      tertiary: "#333333",
      onTertiary: "#FFFFFF",
      tertiaryContainer: "#D6D6D6",
      onTertiaryContainer: "#000000",
      background: "#FFFFFF",
      onBackground: "#000000",
      surface: "#FAFAFA",
      onSurface: "#000000",
      surfaceVariant: "#F0F0F0",
      onSurfaceVariant: "#4D4D4D",
      outline: "#BDBDBD",
      outlineVariant: "#D1D1D1",
      inverseSurface: "#000000",
      inverseOnSurface: "#FFFFFF",
      inversePrimary: "#FFFFFF",
      error: "#FCA5A5",
      onError: "#3F0A0A",
      errorContainer: "#FEE2E2",
      onErrorContainer: "#3F0A0A",
      surfaceDisabled: "#F2F2F2",
      onSurfaceDisabled: "#9E9E9E",
      backdrop: "#FFFFFF",
      shadow: "#000000",
      scrim: "#000000",
    };
  };

  const finalTheme = useMemo(() => {
    const isDark = resolvedThemeMode === "dark";
    const basePaper = isDark ? MD3DarkTheme : MD3LightTheme;
    const baseNav = isDark ? DarkTheme : LightTheme;

    const withAppExtras = (colors: any) => {
      const primary = colors.primary;
      const secondary = colors.secondary;
      const headerMid = mixColors(primary, secondary, 0.5) ?? primary;
      return {
        ...colors,
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
        headerGradientStart: colors.headerGradientStart ?? primary,
        headerGradientMid: colors.headerGradientMid ?? headerMid,
        headerGradientEnd: colors.headerGradientEnd ?? secondary,
        headerText: colors.headerText ?? colors.onPrimary,
        headerIcon: colors.headerIcon ?? colors.onPrimary,
        iconPrimary: colors.iconPrimary ?? colors.primary,
        iconSecondary: colors.iconSecondary ?? colors.secondary,
        iconMuted: colors.iconMuted ?? colors.onSurfaceVariant,
      };
    };

    if (themeSource === "fixed") {
      const colors = withAppExtras({
        ...basePaper.colors,
        ...applyFixedColors(isDark),
      });
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

    if (themeSource === "mono") {
      const colors = withAppExtras({
        ...basePaper.colors,
        ...applyMonoColors(isDark),
      });
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

    if (themeSource === "custom" && customTheme) {
      const colors = withAppExtras({
        ...basePaper.colors,
        ...deriveCustomThemeColors(customTheme.primary, customTheme.secondary, isDark),
      });
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

    const baseWithExtras = {
      ...basePaper,
      colors: withAppExtras(basePaper.colors),
    };

    if (themeSource === "custom" && !customTheme) {
      return {
        paper: baseWithExtras,
        nav: {
          ...baseNav,
          colors: {
            ...baseNav.colors,
            card: baseWithExtras.colors.surface,
            background: baseWithExtras.colors.background,
          },
        },
      };
    }

    if (themeSource === "palette" && paletteTheme) {
      const paletteColors = isDark ? paletteTheme.dark : paletteTheme.light;
      const colors = withAppExtras({
        ...basePaper.colors,
        primary: paletteColors.primary,
        onPrimary: paletteColors.onPrimary,
        primaryContainer: paletteColors.primaryContainer,
        onPrimaryContainer: paletteColors.onPrimaryContainer,
        secondary: paletteColors.secondary,
        onSecondary: paletteColors.onSecondary,
        secondaryContainer: paletteColors.secondaryContainer,
        onSecondaryContainer: paletteColors.onSecondaryContainer,
        tertiary: paletteColors.tertiary,
        onTertiary: paletteColors.onTertiary,
        tertiaryContainer: paletteColors.tertiaryContainer,
        onTertiaryContainer: paletteColors.onTertiaryContainer,
        background: paletteColors.background,
        onBackground: paletteColors.onBackground,
        surface: paletteColors.surface,
        onSurface: paletteColors.onSurface,
        surfaceVariant: paletteColors.surfaceVariant,
        onSurfaceVariant: paletteColors.onSurfaceVariant,
        outline: paletteColors.outline,
        outlineVariant: paletteColors.outlineVariant,
        error: paletteColors.error,
        onError: paletteColors.onError,
        errorContainer: paletteColors.errorContainer,
        onErrorContainer: paletteColors.onErrorContainer,
        success: paletteColors.success,
        onSuccess: paletteColors.onSuccess,
        successContainer: paletteColors.successContainer,
        onSuccessContainer: paletteColors.onSuccessContainer,
        warning: paletteColors.warning,
        onWarning: paletteColors.onWarning,
        warningContainer: paletteColors.warningContainer,
        onWarningContainer: paletteColors.onWarningContainer,
        info: paletteColors.info,
        onInfo: paletteColors.onInfo,
        infoContainer: paletteColors.infoContainer,
        onInfoContainer: paletteColors.onInfoContainer,
        headerGradientStart: paletteColors.headerGradientStart,
        headerGradientMid: paletteColors.headerGradientMid,
        headerGradientEnd: paletteColors.headerGradientEnd,
        headerText: paletteColors.headerText,
        headerIcon: paletteColors.headerIcon,
        iconPrimary: paletteColors.iconPrimary,
        iconSecondary: paletteColors.iconSecondary,
        iconMuted: paletteColors.iconMuted,
      });
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

    if (themeSource === "palette" && !paletteTheme) {
      return {
        paper: baseWithExtras,
        nav: {
          ...baseNav,
          colors: {
            ...baseNav.colors,
            card: baseWithExtras.colors.surface,
            background: baseWithExtras.colors.background,
          },
        },
      };
    }

    if (!systemPalette) {
      return {
        paper: baseWithExtras,
        nav: {
          ...baseNav,
          colors: {
            ...baseNav.colors,
            card: baseWithExtras.colors.surface,
            background: baseWithExtras.colors.background,
          },
        },
      };
    }

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
      paper: { ...basePaper, colors: withAppExtras(colors) },
      nav: {
        ...baseNav,
        colors: {
          ...baseNav.colors,
          card: colors.surface,
          background: colors.background,
        },
      },
    };
  }, [systemPalette, resolvedThemeMode, themeSource, customTheme, paletteTheme]);

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
                <Stack.Screen name="themes/index" />
                <Stack.Screen name="themes/palette" />
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
