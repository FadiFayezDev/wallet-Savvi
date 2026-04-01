import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { StyleProp, TextStyle, ViewStyle } from "react-native";
import { IconButton, Menu, useTheme } from "react-native-paper";

type ComboOption<T extends string | number> = {
  value: T;
  label: string;
};

type ComboSelectProps<T extends string | number> = {
  label?: string;
  placeholder?: string;
  value: T | null;
  options: ComboOption<T>[];
  onChange: (value: T) => void;
  variant?: "filled" | "underline";
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
    <View style={{ gap: 6 }}>
      {label ? (
        <Text style={{ fontSize: 13, color: theme.colors.onSurfaceVariant }}>
          {label}
        </Text>
      ) : null}
      <Menu
        visible={visible}
        onDismiss={() => setVisible(false)}
        anchor={
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
          </Pressable>
        }
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
      </Menu>
    </View>
  );
}
