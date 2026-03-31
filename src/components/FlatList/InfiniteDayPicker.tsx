import React, { useRef, useCallback, useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  Animated,
  StyleSheet,
  Dimensions,
  I18nManager,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ITEM_WIDTH    = Math.floor(SCREEN_WIDTH / 6); // 4 أيام ظاهرين في نفس الوقت
const INITIAL_INDEX = 365;
const TOTAL_DAYS    = 730;

const MONTH_NAMES_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const MONTH_NAMES_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate()
  );
}

// ── مكون اليوم الواحد ────────────────────────────────────────────────────────
interface DayItemProps {
  date:           Date;
  isSelected:     boolean;
  isToday:        boolean;
  primaryColor:   string;
  onPrimaryColor: string;
  surfaceVariant: string;
  outlineVariant: string;
  onSurfaceColor: string;
  monthNames:     string[];
  onPress:        (date: Date) => void;
  onLongPress?:   () => void;
}

const DayItem = React.memo(
  ({ date, isSelected, isToday, primaryColor, onPrimaryColor, surfaceVariant, outlineVariant, onSurfaceColor, monthNames, onPress, onLongPress }: DayItemProps) => {
    const scaleAnim   = useRef(new Animated.Value(isSelected ? 1 : 0.88)).current;
    const opacityAnim = useRef(new Animated.Value(isSelected ? 1 : 0.45)).current;

    useEffect(() => {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: isSelected ? 1 : 0.88,
          useNativeDriver: true,
          tension: 200,
          friction: 14,
        }),
        Animated.timing(opacityAnim, {
          toValue: isSelected ? 1 : 0.45,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }, [isSelected]);

    const label = `${date.getDate()} ${monthNames[date.getMonth()]}`;

    return (
      <Pressable
        onPress={() => onPress(date)}
        onLongPress={onLongPress}
        style={styles.dayWrapper}
        hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
      >
        <Animated.View
          style={[
            styles.dayInner,
            isSelected && [{ backgroundColor: primaryColor, shadowColor: primaryColor }, styles.selectedInner],
            isToday && !isSelected && [styles.todayInner, { backgroundColor: surfaceVariant, borderColor: outlineVariant }],
            { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
          ]}
        >
          <Text
            style={[
              styles.dayLabel,
              { color: onSurfaceColor },
              isSelected && { color: onPrimaryColor, fontWeight: '800' },
              isToday && !isSelected && { color: primaryColor, opacity: 1 },
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {label}
          </Text>

          {isToday && !isSelected && (
            <View style={[styles.todayDot, { backgroundColor: primaryColor }]} />
          )}
        </Animated.View>
      </Pressable>
    );
  },
  (prev, next) =>
    prev.isSelected     === next.isSelected     &&
    prev.isToday        === next.isToday        &&
    prev.primaryColor   === next.primaryColor   &&
    prev.onPrimaryColor === next.onPrimaryColor &&
    prev.surfaceVariant === next.surfaceVariant &&
    prev.onSurfaceColor === next.onSurfaceColor,
);

// ── المكون الرئيسي ───────────────────────────────────────────────────────────
interface InfiniteDayPickerProps {
  isArabic?:    boolean;
  theme?:       any; // MD3Theme من react-native-paper
  onDayChange?: (date: Date) => void;
  initialDate?: Date;
}

const InfiniteDayPicker: React.FC<InfiniteDayPickerProps> = ({
  isArabic    = false,
  theme,
  onDayChange,
  initialDate,
}) => {
  const primaryColor    = theme?.colors?.primary        ?? '#4593f2';
  const onPrimaryColor  = theme?.colors?.onPrimary      ?? '#ffffff';
  const surfaceVariant  = theme?.colors?.surfaceVariant ?? '#1F2937';
  const outlineVariant  = theme?.colors?.outlineVariant ?? '#374151';
  const onSurfaceColor  = theme?.colors?.onSurface      ?? '#ffffff';
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

  const dates = useMemo<Date[]>(() =>
    Array.from({ length: TOTAL_DAYS }, (_, i) => addDays(baseDate, i - INITIAL_INDEX)),
  [baseDate]);

  const [selectedDate, setSelectedDate] = useState<Date>(baseDate);
  const flatListRef = useRef<FlatList>(null);
  const monthNames  = isArabic ? MONTH_NAMES_AR : MONTH_NAMES_EN;

  useEffect(() => {
    const diff      = Math.round((selectedDate.getTime() - baseDate.getTime()) / 86400000);
    const idx       = INITIAL_INDEX + diff;
    const centerIdx = Math.max(0, idx - 1);
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({ index: centerIdx, animated: false });
    }, 0);
  }, []);

  const resetToToday = useCallback(() => {
    setSelectedDate(today);
    onDayChange?.(today);
    const diff      = Math.round((today.getTime() - baseDate.getTime()) / 86400000);
    const idx       = INITIAL_INDEX + diff;
    const centerIdx = Math.max(0, idx - 1);
    flatListRef.current?.scrollToIndex({ index: centerIdx, animated: true });
  }, [baseDate, onDayChange, today]);

  const handleDayPress = useCallback(
    (date: Date) => {
      setSelectedDate(date);
      onDayChange?.(date);
      const diff      = Math.round((date.getTime() - baseDate.getTime()) / 86400000);
      const idx       = INITIAL_INDEX + diff;
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
        monthNames={monthNames}
        onPress={handleDayPress}
        onLongPress={resetToToday}
      />
    ),
    [selectedDate, today, primaryColor, onPrimaryColor, surfaceVariant, outlineVariant, onSurfaceColor, monthNames, handleDayPress, resetToToday],
  );

  const keyExtractor  = useCallback((_: Date, i: number) => String(i), []);
  const getItemLayout = useCallback(
    (_: any, index: number) => ({ length: ITEM_WIDTH, offset: ITEM_WIDTH * index, index }),
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
        initialNumToRender={8}
        maxToRenderPerBatch={8}
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
    height: 56,
    marginTop: 10,
    marginBottom: 4,
  },
  listContent: {
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  dayWrapper: {
    width: ITEM_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  dayInner: {
    width: '100%',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedInner: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  todayInner: {
    borderWidth: 1,
    borderRadius: 20,
  },
  dayLabel: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 3,
  },
});

export default InfiniteDayPicker;
