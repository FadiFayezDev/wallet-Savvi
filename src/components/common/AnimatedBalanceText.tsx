import { useEffect, useRef, useState } from 'react';
import type { TextStyle } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { formatMoney } from '@/src/utils/money';

type AnimatedBalanceTextProps = {
  value: number;
  locale: 'ar' | 'en';
  currency: string;
  durationMs?: number;
  startFromZeroOnFirst?: boolean;
  resetKey?: unknown;
  textStyle?: TextStyle | TextStyle[];
};

export function AnimatedBalanceText({
  value,
  locale,
  currency,
  durationMs = 900,
  startFromZeroOnFirst = true,
  resetKey,
  textStyle,
}: AnimatedBalanceTextProps) {
  const shared = useSharedValue(0);
  const [displayValue, setDisplayValue] = useState(0);
  const displayRef = useRef(0);
  const hasAnimatedRef = useRef(false);
  const lastResetRef = useRef<unknown>(undefined);

  const setDisplaySafe = (next: number) => {
    displayRef.current = next;
    setDisplayValue(next);
  };

  useAnimatedReaction(
    () => Math.round(shared.value),
    (current, prev) => {
      if (current !== prev) {
        runOnJS(setDisplaySafe)(current);
      }
    },
  );

  useEffect(() => {
    const resetChanged = resetKey !== lastResetRef.current;
    if (resetChanged) lastResetRef.current = resetKey;

    const shouldStartFromZero =
      (!hasAnimatedRef.current && startFromZeroOnFirst) || resetChanged;
    const startValue = shouldStartFromZero ? 0 : displayRef.current;

    shared.value = startValue;
    shared.value = withTiming(
      value,
      { duration: durationMs, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(setDisplaySafe)(value);
      },
    );
    hasAnimatedRef.current = true;
  }, [value, durationMs, startFromZeroOnFirst, resetKey, shared]);

  return (
    <Animated.Text style={textStyle}>
      {formatMoney(displayValue, locale, currency)}
    </Animated.Text>
  );
}
