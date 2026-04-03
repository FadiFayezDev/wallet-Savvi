import { useMemo, useState, type ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import type { StyleProp, TextStyle, ViewStyle } from "react-native";
import { IconButton, List, Menu, Text, useTheme } from "react-native-paper";

type ComboOption<T extends string | number> = {
  value: T;
  label: string;
};

export type ComboListRow = {
  title: string;
  description?: string;
  icon: string;
};

type ComboSelectProps<T extends string | number> = {
  label?: string;
  placeholder?: string;
  value: T | null;
  options: ComboOption<T>[];
  onChange: (value: T) => void;
  variant?: "filled" | "underline";
  /** صف قائمة MD3 (إعدادات Google): عنوان + قيمة + قائمة منسدلة */
  listRow?: ComboListRow;
  triggerStyle?: StyleProp<ViewStyle>;
  triggerTextStyle?: StyleProp<TextStyle>;
  menuStyle?: StyleProp<ViewStyle>;
};

export function ComboSelect<T extends string | number>({
  label,
  placeholder,
  value,
  options,
  onChange,
  variant = "filled",
  listRow,
  triggerStyle,
  triggerTextStyle,
  menuStyle,
}: ComboSelectProps<T>) {
  const theme = useTheme();
  const [visible, setVisible] = useState(false);

  const selectedLabel = useMemo(() => {
    const match = options.find((opt) => opt.value === value);
    return match?.label ?? "";
  }, [options, value]);

  const menuContent = (
    <ScrollView style={{ maxHeight: 300 }}>
      {options.map((option) => (
        <Menu.Item
          key={String(option.value)}
          title={option.label}
          onPress={() => {
            setVisible(false);
            onChange(option.value);
          }}
          titleStyle={{
            color: theme.colors.onSurface,
            fontWeight: option.value === value ? "800" : "600",
          }}
          trailingIcon={option.value === value ? "check" : undefined}
        />
      ))}
    </ScrollView>
  );

  const menuWrapper = (anchor: ReactNode) => (
    <Menu
      visible={visible}
      onDismiss={() => setVisible(false)}
      anchor={anchor}
      contentStyle={[
        {
          backgroundColor: theme.colors.surface,
          borderRadius: 16,
          paddingVertical: 6,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          maxHeight: 320,
        },
        menuStyle,
      ]}
    >
      {menuContent}
    </Menu>
  );

  if (listRow) {
    return menuWrapper(
      <List.Item
        title={listRow.title}
        description={listRow.description}
        onPress={() => setVisible(true)}
        left={(props) => <List.Icon {...props} icon={listRow.icon} />}
        right={(props) => (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              maxWidth: "52%",
            }}
          >
            <Text
              variant="bodyLarge"
              numberOfLines={1}
              style={{
                color: selectedLabel
                  ? theme.colors.onSurfaceVariant
                  : theme.colors.outline,
              }}
            >
              {selectedLabel || placeholder || ""}
            </Text>
            <List.Icon {...props} icon="menu-down" />
          </View>
        )}
      />,
    );
  }

  const baseTriggerStyle: ViewStyle =
    variant === "underline"
      ? {
          paddingVertical: 8,
          paddingHorizontal: 0,
          backgroundColor: "transparent",
          borderRadius: 0,
        }
      : {
          borderRadius: 14,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          backgroundColor: theme.colors.surface,
          paddingHorizontal: 16,
          paddingVertical: 14,
        };

  return (
    <View>
      {label ? (
        <>
          <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
            {label}
          </Text>
          <View style={{ height: 6 }} />
        </>
      ) : null}
      {menuWrapper(
        <Pressable
          onPress={() => setVisible(true)}
          style={[
            baseTriggerStyle,
            {
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            },
            triggerStyle,
          ]}
        >
          <Text
            variant="bodyLarge"
            style={[
              {
                color: selectedLabel ? theme.colors.onSurface : theme.colors.onSurfaceVariant,
                fontWeight: "600",
              },
              triggerTextStyle,
            ]}
          >
            {selectedLabel || placeholder || ""}
          </Text>
          <IconButton
            icon="chevron-down"
            size={20}
            iconColor={theme.colors.onSurfaceVariant}
            style={{ margin: 0 }}
          />
        </Pressable>,
      )}
    </View>
  );
}
