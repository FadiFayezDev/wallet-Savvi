import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { Calendar } from "react-native-calendars";
import { useTheme } from "react-native-paper";
import { withAlpha } from "@/src/utils/colors";

type DatePickerFieldProps = {
  label: string;
  hint?: string;
  value: string | null;
  onChange: (value: string) => void;
  required?: boolean;
  locale?: "ar" | "en";
};

export function DatePickerField({
  label,
  hint,
  value,
  onChange,
  required = false,
  locale = "ar",
}: DatePickerFieldProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12, fontWeight: "700" }}>
        {label} {required ? (locale === "ar" ? "(مطلوب)" : "(Required)") : null}
      </Text>
      {hint ? <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 11 }}>{hint}</Text> : null}
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
          {value || (locale === "ar" ? "اضغط لاختيار التاريخ" : "Tap to pick a date")}
        </Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View
          style={{
            flex: 1,
            backgroundColor: withAlpha(theme.colors.backdrop ?? theme.colors.scrim ?? theme.colors.onBackground, 0.6),
            justifyContent: "center",
            padding: 16,
          }}
        >
          <View style={{ backgroundColor: theme.colors.surface, borderRadius: 16, padding: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <Text style={{ color: theme.colors.onSurface, fontWeight: "800" }}>{label}</Text>
              <Pressable onPress={() => setOpen(false)}>
                <Text style={{ color: theme.colors.onSurfaceVariant }}>{locale === "ar" ? "إغلاق" : "Close"}</Text>
              </Pressable>
            </View>
            <Calendar
              current={value || undefined}
              markedDates={value ? { [value]: { selected: true } } : undefined}
              onDayPress={(day) => {
                onChange(day.dateString);
                setOpen(false);
              }}
              theme={{
                calendarBackground: theme.colors.surface,
                dayTextColor: theme.colors.onSurface,
                monthTextColor: theme.colors.onSurface,
                selectedDayBackgroundColor: theme.colors.primary,
                selectedDayTextColor: theme.colors.onPrimary,
                arrowColor: theme.colors.onSurface,
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
