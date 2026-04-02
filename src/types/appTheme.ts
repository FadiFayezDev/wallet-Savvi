import type { MD3Theme } from "react-native-paper";
import type { MD3Colors } from "react-native-paper/lib/typescript/types";

/** ألوان إضافية من `_layout` (Material You / لوحات مخصصة) */
export type AppThemeColors = MD3Colors & {
  success?: string;
  onSuccess?: string;
  successContainer?: string;
  onSuccessContainer?: string;
  warning?: string;
  onWarning?: string;
  warningContainer?: string;
  onWarningContainer?: string;
  info?: string;
  onInfo?: string;
  infoContainer?: string;
  onInfoContainer?: string;
  headerGradientStart?: string;
  headerGradientMid?: string;
  headerGradientEnd?: string;
  headerText?: string;
  headerIcon?: string;
  iconPrimary?: string;
  iconSecondary?: string;
  iconMuted?: string;
};

export type AppTheme = Omit<MD3Theme, "colors"> & { colors: AppThemeColors };
