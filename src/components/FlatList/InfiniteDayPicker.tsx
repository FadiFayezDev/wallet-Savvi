import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  I18nManager,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

/**
 * عرض كل item أصغر بحيث يظهر 7 أيام تقريبًا في نفس الوقت.
 * ده بيخلي الـ picker أكثر compact وأنيق.
 */
const ITEM_WIDTH = Math.floor(SCREEN_WIDTH / 7);
const INITIAL_INDEX = 365;
const TOTAL_DAYS = 730;

/**
 * اختصارات الشهور — 3 حروف ثابتة دايمًا.
 * ده هو قلب الحل: بغض النظر عن طول اسم الشهر (يناير vs سبتمبر)،
 * الـ label هيكون دايمًا نفس العرض.
 */
const MONTH_SHORT_AR = [
  "يَن", // يناير
  "فَب", // فبراير
  "مَر", // مارس
  "أَب", // أبريل
  "مَي", // مايو
  "يُو", // يونيو
  "يُل", // يوليو
  "أُغ", // أغسطس
  "سَب", // سبتمبر
  "أُك", // أكتوبر
  "نُو", // نوفمبر
  "دِي", // ديسمبر
];

const MONTH_SHORT_EN = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** أسماء الأيام المختصرة للـ tooltip / accessibility لو احتجناها مستقبلًا */
const DAY_NAMES_AR = ["أح", "إث", "ثل", "أر", "خم", "جم", "سب"];
const DAY_NAMES_EN = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// ── مكون اليوم الواحد ────────────────────────────────────────────────────────
interface DayItemProps {
  date: Date;
  isSelected: boolean;
  isToday: boolean;
  primaryColor: string;
  onPrimaryColor: string;
  surfaceVariant: string;
  outlineVariant: string;
  onSurfaceColor: string;
  monthShort: string[];
  onPress: (date: Date) => void;
  onLongPress?: () => void;
}

const DayItem = React.memo(
  ({
    date,
    isSelected,
    isToday,
    primaryColor,
    onPrimaryColor,
    surfaceVariant,
    outlineVariant,
    onSurfaceColor,
    monthShort,
    onPress,
    onLongPress,
  }: DayItemProps) => {
    const scaleAnim = useRef(new Animated.Value(isSelected ? 1 : 0.85)).current;
    const opacityAnim = useRef(
      new Animated.Value(isSelected ? 1 : 0.5),
    ).current;

    useEffect(() => {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: isSelected ? 1 : 0.85,
          useNativeDriver: true,
          tension: 220,
          friction: 14,
        }),
        Animated.timing(opacityAnim, {
          toValue: isSelected ? 1 : 0.5,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start();
    }, [isSelected]);

    /**
     * Layout المحتوى:
     * ┌──────────┐
     * │    15    │  ← رقم اليوم كبير
     * │   Sep    │  ← اختصار الشهر صغير ثابت (3 حروف دايمًا)
     * └──────────┘
     *
     * بكده:
     * - الـ item عنده عرض ثابت (ITEM_WIDTH)
     * - الرقم دايمًا في المنتصف
     * - الشهر دايمًا نفس الحجم، مش بيأثر على المحاذاة
     */
    const dayNum = date.getDate();
    const monthLabel = monthShort[date.getMonth()];

    return (
      <Pressable
        onPress={() => onPress(date)}
        onLongPress={onLongPress}
        style={styles.dayWrapper}
        hitSlop={{ top: 8, bottom: 8, left: 2, right: 2 }}
      >
        <Animated.View
          style={[
            styles.dayInner,
            isSelected && [
              { backgroundColor: primaryColor, shadowColor: primaryColor },
              styles.selectedInner,
            ],
            isToday &&
              !isSelected && {
                backgroundColor: surfaceVariant,
                borderColor: outlineVariant,
                borderWidth: 1,
                borderRadius: 16,
              },
            { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
          ]}
        >
          {/* رقم اليوم */}
          <Text
            style={[
              styles.dayNum,
              { color: onSurfaceColor },
              isSelected && { color: onPrimaryColor },
              isToday && !isSelected && { color: primaryColor },
            ]}
          >
            {dayNum}
          </Text>

          {/* اختصار الشهر — ثابت 3 حروف */}
          <Text
            style={[
              styles.monthLabel,
              { color: onSurfaceColor },
              isSelected && { color: onPrimaryColor, opacity: 0.85 },
              isToday && !isSelected && { color: primaryColor, opacity: 0.8 },
            ]}
          >
            {monthLabel}
          </Text>

          {/* نقطة اليوم الحالي */}
          {isToday && !isSelected && (
            <View style={[styles.todayDot, { backgroundColor: primaryColor }]} />
          )}
        </Animated.View>
      </Pressable>
    );
  },
  (prev, next) =>
    prev.isSelected === next.isSelected &&
    prev.isToday === next.isToday &&
    prev.primaryColor === next.primaryColor &&
    prev.onPrimaryColor === next.onPrimaryColor &&
    prev.surfaceVariant === next.surfaceVariant &&
    prev.onSurfaceColor === next.onSurfaceColor,
);

DayItem.displayName = "DayItem";

// ── المكون الرئيسي ───────────────────────────────────────────────────────────
interface InfiniteDayPickerProps {
  isArabic?: boolean;
  theme?: any;
  onDayChange?: (date: Date) => void;
  initialDate?: Date;
}

const InfiniteDayPicker: React.FC<InfiniteDayPickerProps> = ({
  isArabic = false,
  theme,
  onDayChange,
  initialDate,
}) => {
  const primaryColor = theme?.colors?.primary ?? "#4593f2";
  const onPrimaryColor = theme?.colors?.onPrimary ?? "#ffffff";
  const surfaceVariant = theme?.colors?.surfaceVariant ?? "#1F2937";
  const outlineVariant = theme?.colors?.outlineVariant ?? "#374151";
  const onSurfaceColor = theme?.colors?.onSurface ?? "#ffffff";

  const monthShort = isArabic ? MONTH_SHORT_AR : MONTH_SHORT_EN;

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const baseDate = useMemo(() => {
    const d = initialDate ? new Date(initialDate) : new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const dates = useMemo<Date[]>(
    () =>
      Array.from({ length: TOTAL_DAYS }, (_, i) =>
        addDays(baseDate, i - INITIAL_INDEX),
      ),
    [baseDate],
  );

  const [selectedDate, setSelectedDate] = useState<Date>(baseDate);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const diff = Math.round(
      (selectedDate.getTime() - baseDate.getTime()) / 86400000,
    );
    const idx = INITIAL_INDEX + diff;
    const centerIdx = Math.max(0, idx - 1);
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({ index: centerIdx, animated: false });
    }, 0);
  }, []);

  const resetToToday = useCallback(() => {
    setSelectedDate(today);
    onDayChange?.(today);
    const diff = Math.round((today.getTime() - baseDate.getTime()) / 86400000);
    const idx = INITIAL_INDEX + diff;
    const centerIdx = Math.max(0, idx - 1);
    flatListRef.current?.scrollToIndex({ index: centerIdx, animated: true });
  }, [baseDate, onDayChange, today]);

  const handleDayPress = useCallback(
    (date: Date) => {
      setSelectedDate(date);
      onDayChange?.(date);
      const diff = Math.round(
        (date.getTime() - baseDate.getTime()) / 86400000,
      );
      const idx = INITIAL_INDEX + diff;
      const centerIdx = Math.max(0, idx - 1);
      flatListRef.current?.scrollToIndex({ index: centerIdx, animated: true });
    },
    [baseDate, onDayChange],
  );

  const renderItem = useCallback(
    ({ item }: { item: Date }) => (
      <DayItem
        date={item}
        isSelected={isSameDay(item, selectedDate)}
        isToday={isSameDay(item, today)}
        primaryColor={primaryColor}
        onPrimaryColor={onPrimaryColor}
        surfaceVariant={surfaceVariant}
        outlineVariant={outlineVariant}
        onSurfaceColor={onSurfaceColor}
        monthShort={monthShort}
        onPress={handleDayPress}
        onLongPress={resetToToday}
      />
    ),
    [
      selectedDate,
      today,
      primaryColor,
      onPrimaryColor,
      surfaceVariant,
      outlineVariant,
      onSurfaceColor,
      monthShort,
      handleDayPress,
      resetToToday,
    ],
  );

  const keyExtractor = useCallback((_: Date, i: number) => String(i), []);
  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: ITEM_WIDTH,
      offset: ITEM_WIDTH * index,
      index,
    }),
    [],
  );

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={dates}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={ITEM_WIDTH}
        snapToAlignment="start"
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews
        inverted={isArabic && I18nManager.isRTL}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

// ── الأنماط ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    /**
     * أعلى قليلًا من النسخة القديمة (64 بدل 56) عشان نستوعب الـ stacked layout
     * (رقم + شهر) بدون ضغط.
     */
    height: 64,
    marginTop: 8,
    marginBottom: 4,
  },
  listContent: {
    alignItems: "center",
    paddingHorizontal: 4,
  },
  dayWrapper: {
    width: ITEM_WIDTH,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  dayInner: {
    width: "100%",
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
  },
  selectedInner: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },

  /** رقم اليوم — كبير وواضح */
  dayNum: {
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 20,
    textAlign: "center",
  },

  /**
   * اختصار الشهر — صغير تحت الرقم.
   * ثابت 3 حروف دايمًا، ده بيمنع أي تفاوت في العرض بين الأشهر.
   */
  monthLabel: {
    fontSize: 10,
    fontWeight: "600",
    lineHeight: 13,
    textAlign: "center",
    letterSpacing: 0.3,
  },

  todayDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    marginTop: 2,
  },
});

export default InfiniteDayPicker;