import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useTheme } from "react-native-paper";

import { CalculatorKeyboard, evaluateExpression } from "./CalculatorKeyboard";
import { withAlpha } from "@/src/utils/colors";

type CalculatorFieldProps = {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  locale?: "ar" | "en";
};

export function CalculatorField({
  label,
  hint,
  value,
  onChange,
  required = false,
  locale = "ar",
}: CalculatorFieldProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [expression, setExpression] = useState(value || "");

  useEffect(() => {
    if (!open) return;
    setExpression(value || "");
  }, [open, value]);

  const preview = useMemo(() => evaluateExpression(expression), [expression]);

  return (
    <View>
      <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12, fontWeight: "700" }}>
        {label} {required ? (locale === "ar" ? "(مطلوب)" : "(Required)") : null}
      </Text>
      {hint ? (
        <>
          <View style={{ height: 6 }} />
          <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 11 }}>{hint}</Text>
        </>
      ) : null}
      <Pressable
        onPress={() => setOpen(true)}
        style={{
          borderRadius: 12,
          backgroundColor: theme.colors.surfaceVariant,
          paddingHorizontal: 12,
          paddingVertical: 12,
        }}
      >
        <Text style={{ color: theme.colors.onSurface, fontSize: 16 }}>
          {value || (locale === "ar" ? "اضغط لإدخال المبلغ" : "Tap to enter amount")}
        </Text>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View
          style={{
            flex: 1,
            backgroundColor: withAlpha(theme.colors.backdrop ?? theme.colors.scrim ?? theme.colors.onBackground, 0.6),
            justifyContent: "flex-end",
          }}
        >
          <View style={{ backgroundColor: theme.colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={{ color: theme.colors.onSurface, fontWeight: "800" }}>{label}</Text>
              <Pressable onPress={() => setOpen(false)}>
                <Text style={{ color: theme.colors.onSurfaceVariant }}>{locale === "ar" ? "إغلاق" : "Close"}</Text>
              </Pressable>
            </View>
            <CalculatorKeyboard
              expression={expression}
              onChange={setExpression}
              onSubmit={(result) => {
                onChange(String(result));
                setOpen(false);
              }}
              locale={locale}
            />
            <Pressable
              onPress={() => {
                if (preview == null) return;
                onChange(String(preview));
                setOpen(false);
              }}
              style={{
                marginTop: 10,
                borderRadius: 10,
                paddingVertical: 12,
                backgroundColor: theme.colors.surfaceVariant,
                alignItems: "center",
              }}
            >
              <Text style={{ color: theme.colors.onSurface, fontWeight: "700" }}>
                {locale === "ar" ? "إدراج الناتج" : "Insert result"}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
