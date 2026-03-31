import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, Text, View, useWindowDimensions } from "react-native";
import { useTheme } from "react-native-paper";

import type { TimeFormat } from "@/src/types/domain";
import { withAlpha } from "@/src/utils/colors";

const pad = (value: number) => String(value).padStart(2, "0");

const parseTime = (value?: string | null) => {
  if (!value) return { hour: 9, minute: 0 };
  const [h, m] = value.split(":").map((part) => Number(part));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return { hour: 9, minute: 0 };
  return {
    hour: Math.max(0, Math.min(23, h)),
    minute: Math.max(0, Math.min(59, m)),
  };
};

const toHour12 = (hour24: number) => {
  const mod = hour24 % 12;
  return mod === 0 ? 12 : mod;
};

const toHour24 = (hour12: number, isAm: boolean) => {
  if (isAm) return hour12 === 12 ? 0 : hour12;
  return hour12 === 12 ? 12 : hour12 + 12;
};

export const formatTimeLabel = (
  value: string | null,
  timeFormat: TimeFormat,
  locale: "ar" | "en",
) => {
  if (!value) return "";
  const { hour, minute } = parseTime(value);
  if (timeFormat === "24h") {
    return `${pad(hour)}:${pad(minute)}`;
  }
  const isAm = hour < 12;
  const suffix = locale === "ar" ? (isAm ? "ص" : "م") : isAm ? "AM" : "PM";
  return `${toHour12(hour)}:${pad(minute)} ${suffix}`;
};

type TimePickerFieldProps = {
  label: string;
  hint?: string;
  value: string | null;
  onChange: (value: string) => void;
  required?: boolean;
  locale?: "ar" | "en";
  timeFormat?: TimeFormat;
};

export function TimePickerField({
  label,
  hint,
  value,
  onChange,
  required = false,
  locale = "ar",
  timeFormat = "24h",
}: TimePickerFieldProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const clockSize = Math.min(width - 80, 280);
  const center = clockSize / 2;
  const outerRadius = center - 16;
  const innerRadius = outerRadius * 0.62;
  const itemSize = 36;

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"hour" | "minute">("hour");
  const [tempHour, setTempHour] = useState(9);
  const [tempMinute, setTempMinute] = useState(0);
  const [isAm, setIsAm] = useState(true);

  useEffect(() => {
    if (!open) return;
    const parsed = parseTime(value);
    const snappedMinute = Math.round(parsed.minute / 5) * 5;
    const safeMinute = snappedMinute >= 60 ? 55 : snappedMinute;
    if (timeFormat === "12h") {
      setTempHour(toHour12(parsed.hour));
      setIsAm(parsed.hour < 12);
    } else {
      setTempHour(parsed.hour);
    }
    setTempMinute(safeMinute);
    setMode("hour");
  }, [open, value, timeFormat]);

  const displayValue = useMemo(() => {
    if (!value) return "";
    return formatTimeLabel(value, timeFormat, locale);
  }, [value, timeFormat, locale]);

  const hourValuesOuter = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const hourValuesInner = useMemo(() => [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0], []);
  const minuteValues = useMemo(() => Array.from({ length: 12 }, (_, i) => i * 5), []);

  const buildPositions = (values: number[], radius: number) =>
    values.map((value, index) => {
      const angle = Math.PI / 2 - (index * Math.PI * 2) / values.length;
      const x = center + radius * Math.cos(angle) - itemSize / 2;
      const y = center - radius * Math.sin(angle) - itemSize / 2;
      return { value, x, y };
    });

  const hourPositionsOuter = useMemo(
    () => buildPositions(hourValuesOuter, outerRadius),
    [outerRadius],
  );
  const hourPositionsInner = useMemo(
    () => buildPositions(hourValuesInner, innerRadius),
    [innerRadius],
  );
  const minutePositions = useMemo(
    () => buildPositions(minuteValues, outerRadius),
    [outerRadius],
  );

  const tempHour24 =
    timeFormat === "12h" ? toHour24(tempHour, isAm) : tempHour;

  const onConfirm = () => {
    const hour24 = timeFormat === "12h" ? toHour24(tempHour, isAm) : tempHour;
    const finalValue = `${pad(hour24)}:${pad(tempMinute)}`;
    onChange(finalValue);
    setOpen(false);
  };

  const renderOption = (
    optionValue: number,
    x: number,
    y: number,
    selected: boolean,
    onPress: () => void,
    labelOverride?: string,
  ) => (
    <Pressable
      key={`${optionValue}-${x}-${y}`}
      onPress={onPress}
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: itemSize,
        height: itemSize,
        borderRadius: itemSize / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: selected ? theme.colors.primary : "transparent",
      }}
    >
      <Text
        style={{
          color: selected ? theme.colors.onPrimary : theme.colors.onSurface,
          fontWeight: "700",
        }}
      >
        {labelOverride ?? optionValue}
      </Text>
    </Pressable>
  );

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
          {displayValue || (locale === "ar" ? "اضغط لاختيار الوقت" : "Tap to pick time")}
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
          <View style={{ backgroundColor: theme.colors.surface, borderRadius: 20, padding: 16 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={{ color: theme.colors.onSurface, fontWeight: "800" }}>{label}</Text>
              <Pressable onPress={() => setOpen(false)}>
                <Text style={{ color: theme.colors.onSurfaceVariant }}>{locale === "ar" ? "إغلاق" : "Close"}</Text>
              </Pressable>
            </View>

            <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "baseline", gap: 4 }}>
              <Pressable onPress={() => setMode("hour")}>
                <Text
                  style={{
                    color: mode === "hour" ? theme.colors.primary : theme.colors.onSurface,
                    fontSize: 28,
                    fontWeight: "800",
                  }}
                >
                  {timeFormat === "12h" ? pad(tempHour) : pad(tempHour24)}
                </Text>
              </Pressable>
              <Text style={{ color: theme.colors.onSurface, fontSize: 28, fontWeight: "800" }}>:</Text>
              <Pressable onPress={() => setMode("minute")}>
                <Text
                  style={{
                    color: mode === "minute" ? theme.colors.primary : theme.colors.onSurface,
                    fontSize: 28,
                    fontWeight: "800",
                  }}
                >
                  {pad(tempMinute)}
                </Text>
              </Pressable>
              {timeFormat === "12h" ? (
                <View style={{ flexDirection: "row", marginLeft: 12, gap: 6 }}>
                  {(["AM", "PM"] as const).map((label, index) => {
                    const active = (index === 0) === isAm;
                    const display = locale === "ar" ? (label === "AM" ? "ص" : "م") : label;
                    return (
                      <Pressable
                        key={label}
                        onPress={() => setIsAm(index === 0)}
                        style={{
                          borderRadius: 10,
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          backgroundColor: active ? theme.colors.primary : theme.colors.surfaceVariant,
                        }}
                      >
                        <Text style={{ color: active ? theme.colors.onPrimary : theme.colors.onSurfaceVariant }}>
                          {display}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>

            <View
              style={{
                marginTop: 16,
                width: clockSize,
                height: clockSize,
                borderRadius: clockSize / 2,
                backgroundColor: theme.colors.surfaceVariant,
                alignSelf: "center",
              }}
            >
              {mode === "hour" ? (
                <>
                  {hourPositionsOuter.map((pos) =>
                    renderOption(
                      pos.value,
                      pos.x,
                      pos.y,
                      (timeFormat === "12h" ? tempHour : tempHour24) === pos.value,
                      () => {
                        setTempHour(pos.value);
                        if (timeFormat === "24h") {
                          if (pos.value === 0) setTempHour(0);
                        }
                        setMode("minute");
                      },
                      timeFormat === "24h" ? pad(pos.value) : String(pos.value),
                    ),
                  )}
                  {timeFormat === "24h"
                    ? hourPositionsInner.map((pos) =>
                        renderOption(
                          pos.value,
                          pos.x,
                          pos.y,
                          tempHour24 === pos.value,
                          () => {
                            setTempHour(pos.value);
                            setMode("minute");
                          },
                          pad(pos.value),
                        ),
                      )
                    : null}
                </>
              ) : (
                <>
                  {minutePositions.map((pos) =>
                    renderOption(
                      pos.value,
                      pos.x,
                      pos.y,
                      tempMinute === pos.value,
                      () => setTempMinute(pos.value),
                      pad(pos.value),
                    ),
                  )}
                </>
              )}
            </View>

            <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
              <Pressable
                onPress={() => setOpen(false)}
                style={{
                  flex: 1,
                  borderRadius: 10,
                  paddingVertical: 10,
                  backgroundColor: theme.colors.surfaceVariant,
                }}
              >
                <Text style={{ textAlign: "center", color: theme.colors.onSurfaceVariant }}>
                  {locale === "ar" ? "إلغاء" : "Cancel"}
                </Text>
              </Pressable>
              <Pressable
                onPress={onConfirm}
                style={{
                  flex: 1,
                  borderRadius: 10,
                  paddingVertical: 10,
                  backgroundColor: theme.colors.primary,
                }}
              >
                <Text style={{ textAlign: "center", color: theme.colors.onPrimary, fontWeight: "700" }}>
                  {locale === "ar" ? "حفظ" : "Save"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
