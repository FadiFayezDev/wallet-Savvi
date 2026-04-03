import type { ReactNode } from "react";
import { ScrollView, View, type StyleProp, type ViewStyle } from "react-native";

// استيراد الـ Hook ده زي ما هو
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Text, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const MATERIAL_H = 20;
export const MATERIAL_SECTION_GAP = 16;

export function cardRadius(theme: { roundness: number }) {
  return theme.roundness * 2;
}

type LayoutMode = "tab" | "stack";

type Props = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  header?: ReactNode;
  layout?: LayoutMode;
  scroll?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

// مكون داخلي صغير عشان نهندل الـ Error بتاع الـ Hook
const SafeTabBarHeight = () => {
  try {
    return useBottomTabBarHeight();
  } catch (e) {
    // لو الشاشة مش جوه Tab Navigator هيرجع 0 بدل ما يضرب Error
    return 0;
  }
};

export function MaterialScreen({
  children,
  title,
  subtitle,
  header,
  layout = "tab",
  scroll = true,
  contentContainerStyle,
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // eslint-disable-next-line react-hooks/rules-of-hooks
  let tabBarH = 0;
  try {
    if (layout === "tab") {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      tabBarH = useBottomTabBarHeight();
    }
  } catch (error) {
    tabBarH = 0;
  }

  const bottomPad =
    layout === "stack"
      ? insets.bottom + 24
      : insets.bottom + Math.max(tabBarH, 52) + 8;

  const topPad = Math.max(12, insets.top > 0 ? 0 : 8);

  const titleBlock = header ?? (
    <>
      {title ? (
        <Text
          variant="headlineSmall"
          style={{
            color: theme.colors.onSurface,
            marginBottom: subtitle ? 6 : MATERIAL_SECTION_GAP,
          }}
        >
          {title}
        </Text>
      ) : null}
      {subtitle ? (
        <Text
          variant="bodyMedium"
          style={{
            color: theme.colors.onSurfaceVariant,
            marginBottom: MATERIAL_SECTION_GAP,
          }}
        >
          {subtitle}
        </Text>
      ) : null}
    </>
  );

  const innerContent = (
    <View>
      {titleBlock}
      {children}
    </View>
  );

  if (scroll) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        contentContainerStyle={{
          paddingHorizontal: MATERIAL_H,
          paddingTop: topPad,
          paddingBottom: bottomPad,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {innerContent}
      </ScrollView>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
        paddingHorizontal: MATERIAL_H,
        paddingTop: topPad,
        paddingBottom: bottomPad,
      }}
    >
      {innerContent}
    </View>
  );
}
