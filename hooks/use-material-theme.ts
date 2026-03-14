import { useTheme } from 'react-native-paper';

/**
 * Hook مركزي للـ Material You theme.
 * استخدامه في كل الشاشات بدلاً من الألوان الثابتة (hardcoded).
 *
 * المفاتيح المهمة:
 *  - theme.colors.background   → خلفية الشاشة
 *  - theme.colors.surface      → بطاقات / surfaces
 *  - theme.colors.surfaceVariant → حقول الإدخال
 *  - theme.colors.primary      → اللون الرئيسي / الأزرار النشطة
 *  - theme.colors.secondary    → الثانوي (palette المستخدم)
 *  - theme.colors.tertiary     → الثالثي
 *  - theme.colors.error        → الخطر / الحذف / المصروف
 *  - theme.colors.onSurface    → النص الرئيسي
 *  - theme.colors.onSurfaceVariant → النص الثانوي
 *  - theme.colors.outline      → حدود / فواصل
 *  - theme.colors.outlineVariant → حدود خفيفة
 *  - theme.colors.elevation.level2 → سطح مرتفع (كاروت مثلاً)
 */
export function useMaterialTheme() {
  return useTheme();
}
