/**
 * ColorWheelPicker
 * ─────────────────────────────────────────────────────────────────
 * Custom HSV color picker built with react-native-svg + PanResponder.
 * Uses a transparent View overlay on top of SVG to capture all touches
 * reliably on both Android and iOS (SVG swallows gestures otherwise).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Defs, LinearGradient, Stop, Svg, Circle, Path } from 'react-native-svg';
import { useTheme } from 'react-native-paper';

import { normalizeHex } from '@/src/utils/colors';

// ─── HSV ↔ RGB ↔ HEX ──────────────────────────────────────────────────────────

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s));
  v = Math.max(0, Math.min(1, v));
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60)       { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r)      h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else                h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return [h, max === 0 ? 0 : d / max, max];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function hexToRgb(hex: string): [number, number, number] | null {
  const n = normalizeHex(hex);
  if (!n) return null;
  const raw = n.slice(1);
  return [parseInt(raw.slice(0,2),16), parseInt(raw.slice(2,4),16), parseInt(raw.slice(4,6),16)];
}

function hexToHsv(hex: string): [number, number, number] {
  const rgb = hexToRgb(hex);
  if (!rgb) return [0, 1, 1];
  return rgbToHsv(rgb[0], rgb[1], rgb[2]);
}

function hsvToHex(h: number, s: number, v: number): string {
  const [r, g, b] = hsvToRgb(h, s, v);
  return rgbToHex(r, g, b);
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WHEEL_SIZE = 260;
const THUMB_R    = 9;
const CENTER     = WHEEL_SIZE / 2;
const RADIUS     = CENTER - THUMB_R - 4;
const HUE_STEPS  = 60; // fewer segments = better perf, still smooth

const SLIDER_W       = 260;
const SLIDER_H       = 26;
const SLIDER_THUMB_R = 13;

// ─── Coordinate helpers ───────────────────────────────────────────────────────

function hsToPolar(h: number, s: number): [number, number] {
  const rad = ((h - 90 + 360) % 360) * (Math.PI / 180);
  const d   = s * RADIUS;
  return [CENTER + d * Math.cos(rad), CENTER + d * Math.sin(rad)];
}

function polarToHs(x: number, y: number): [number, number] {
  const dx   = x - CENTER;
  const dy   = y - CENTER;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const s    = Math.min(dist / RADIUS, 1);
  let h      = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
  if (h < 0) h += 360;
  return [h, s];
}

// ─── Hue wheel paths (memoized at module level) ───────────────────────────────

const WHEEL_PATHS: { d: string; fill: string }[] = (() => {
  const out: { d: string; fill: string }[] = [];
  const step = 360 / HUE_STEPS;
  for (let i = 0; i < HUE_STEPS; i++) {
    const a1 = ((i * step - 90) * Math.PI) / 180;
    const a2 = (((i + 1) * step - 90) * Math.PI) / 180;
    const x1 = CENTER + RADIUS * Math.cos(a1);
    const y1 = CENTER + RADIUS * Math.sin(a1);
    const x2 = CENTER + RADIUS * Math.cos(a2);
    const y2 = CENTER + RADIUS * Math.sin(a2);
    const [r, g, b] = hsvToRgb(i * step, 1, 1);
    out.push({
      d: `M${CENTER},${CENTER} L${x1.toFixed(2)},${y1.toFixed(2)} A${RADIUS},${RADIUS} 0 0,1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`,
      fill: rgbToHex(r, g, b),
    });
  }
  return out;
})();

// Saturation overlay circles (pre-computed)
const SAT_CIRCLES = Array.from({ length: 20 }, (_, i) => {
  const frac    = (20 - i) / 20;
  const r2      = RADIUS * frac;
  const opacity = (1 - frac) * 0.95;
  return { r2, opacity };
});

// ─── ColorWheel ───────────────────────────────────────────────────────────────

function ColorWheel({
  hue, sat,
  onHueSatChange,
}: {
  hue: number;
  sat: number;
  onHueSatChange: (h: number, s: number) => void;
}) {
  const [thumb, setThumb] = useState<[number,number]>(() => hsToPolar(hue, sat));

  useEffect(() => {
    setThumb(hsToPolar(hue, sat));
  }, [hue, sat]);

  /** Wheel container offset so we can convert page coords → local */
  const offsetRef = useRef({ x: 0, y: 0 });
  const viewRef = useRef<View>(null);

  const measureOffset = useCallback(() => {
    viewRef.current?.measure?.((_x, _y, _w, _h, pageX, pageY) => {
      offsetRef.current = { x: pageX, y: pageY };
    });
  }, []);

  const handleMove = useCallback((pageX: number, pageY: number) => {
    const lx = pageX - offsetRef.current.x;
    const ly = pageY - offsetRef.current.y;
    const dx = lx - CENTER;
    const dy = ly - CENTER;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > RADIUS + THUMB_R + 10) return; // outside wheel + tolerance
    const [h, s] = polarToHs(lx, ly);
    setThumb(hsToPolar(h, s));
    onHueSatChange(h, s);
  }, [onHueSatChange]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (e) => {
        handleMove(e.nativeEvent.pageX, e.nativeEvent.pageY);
      },
      onPanResponderMove: (e) => {
        handleMove(e.nativeEvent.pageX, e.nativeEvent.pageY);
      },
    }),
  ).current;

  // We update the panResponder's handler when handleMove changes
  // PanResponder handlers are not automatically updated, so use ref trick:
  const handleMoveRef = useRef(handleMove);
  useEffect(() => { handleMoveRef.current = handleMove; }, [handleMove]);

  const panResponderLive = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (e) => handleMoveRef.current(e.nativeEvent.pageX, e.nativeEvent.pageY),
      onPanResponderMove: (e)  => handleMoveRef.current(e.nativeEvent.pageX, e.nativeEvent.pageY),
    }),
  ).current;

  const thumbColor = useMemo(() => hsvToHex(hue, sat, 1), [hue, sat]);

  return (
    <View
      ref={viewRef}
      style={{ width: WHEEL_SIZE, height: WHEEL_SIZE, alignSelf: 'center' }}
      onLayout={measureOffset}
    >
      {/* SVG layer — pure rendering, no touch handling */}
      <Svg
        width={WHEEL_SIZE}
        height={WHEEL_SIZE}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        {/* Hue slices */}
        {WHEEL_PATHS.map((p, i) => (
          <Path key={i} d={p.d} fill={p.fill} />
        ))}

        {/* White saturation overlay (radial fade from center) */}
        {SAT_CIRCLES.map((c, i) => (
          <Circle key={i} cx={CENTER} cy={CENTER} r={c.r2} fill="white" opacity={c.opacity} />
        ))}

        {/* Thumb shadow */}
        <Circle cx={thumb[0]} cy={thumb[1]} r={THUMB_R + 4} fill="white" opacity={0.7} />
        {/* Thumb fill */}
        <Circle cx={thumb[0]} cy={thumb[1]} r={THUMB_R} fill={thumbColor} />
        {/* Thumb border */}
        <Circle cx={thumb[0]} cy={thumb[1]} r={THUMB_R} fill="none" stroke="white" strokeWidth={2} />
      </Svg>

      {/* Touch capture overlay — transparent View on top */}
      <View
        style={StyleSheet.absoluteFill}
        {...panResponderLive.panHandlers}
      />
    </View>
  );
}

// ─── BrightnessSlider ─────────────────────────────────────────────────────────

function BrightnessSlider({
  hue, sat, brightness,
  onChange,
}: {
  hue: number;
  sat: number;
  brightness: number;
  onChange: (v: number) => void;
}) {
  const [thumbX, setThumbX] = useState(() =>
    brightness * (SLIDER_W - SLIDER_THUMB_R * 2) + SLIDER_THUMB_R,
  );

  useEffect(() => {
    setThumbX(brightness * (SLIDER_W - SLIDER_THUMB_R * 2) + SLIDER_THUMB_R);
  }, [brightness]);

  const offsetX = useRef(0);

  const thumbFill  = useMemo(() => hsvToHex(hue, sat, brightness), [hue, sat, brightness]);
  const fullColor  = useMemo(() => hsvToHex(hue, sat, 1),          [hue, sat]);

  const viewRef = useRef<View>(null);
  const measureOffset = useCallback(() => {
    viewRef.current?.measure?.((_x, _y, _w, _h, pageX) => {
      offsetX.current = pageX;
    });
  }, []);

  const handleX = useCallback((pageX: number) => {
    const lx      = pageX - offsetX.current;
    const clamped = Math.max(SLIDER_THUMB_R, Math.min(SLIDER_W - SLIDER_THUMB_R, lx));
    const v       = (clamped - SLIDER_THUMB_R) / (SLIDER_W - SLIDER_THUMB_R * 2);
    setThumbX(clamped);
    onChange(v);
  }, [onChange]);

  const handleXRef = useRef(handleX);
  useEffect(() => { handleXRef.current = handleX; }, [handleX]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (e) => handleXRef.current(e.nativeEvent.pageX),
      onPanResponderMove:  (e) => handleXRef.current(e.nativeEvent.pageX),
    }),
  ).current;

  return (
    <View
      ref={viewRef}
      style={{ width: SLIDER_W, alignSelf: 'center', height: SLIDER_THUMB_R * 2 + 4, justifyContent: 'center' }}
      onLayout={measureOffset}
    >
      {/* Track (SVG, no touch) */}
      <Svg
        width={SLIDER_W}
        height={SLIDER_H}
        style={{ borderRadius: SLIDER_H / 2, alignSelf: 'center' }}
        pointerEvents="none"
      >
        <Defs>
          <LinearGradient id="bgrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#000000" />
            <Stop offset="1" stopColor={fullColor} />
          </LinearGradient>
        </Defs>
        <Path
          d={`M${SLIDER_H/2},0 H${SLIDER_W - SLIDER_H/2} A${SLIDER_H/2},${SLIDER_H/2} 0 0,1 ${SLIDER_W - SLIDER_H/2},${SLIDER_H} H${SLIDER_H/2} A${SLIDER_H/2},${SLIDER_H/2} 0 0,1 ${SLIDER_H/2},0 Z`}
          fill="url(#bgrad)"
        />
      </Svg>

      {/* Thumb */}
      <View
        style={[
          styles.sliderThumb,
          {
            left: thumbX - SLIDER_THUMB_R,
            backgroundColor: thumbFill,
          },
        ]}
        pointerEvents="none"
      />

      {/* Touch capture */}
      <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers} />
    </View>
  );
}

// ─── Main ColorWheelPicker ────────────────────────────────────────────────────

interface ColorWheelPickerProps {
  color: string;
  onChange: (hex: string) => void;
}

export function ColorWheelPicker({ color, onChange }: ColorWheelPickerProps) {
  const theme = useTheme();

  const [hsv, setHsv]           = useState<[number,number,number]>(() => hexToHsv(color));
  const [hexInput, setHexInput] = useState(normalizeHex(color) ?? '#FF0000');
  const hsvRef = useRef(hsv);
  useEffect(() => { hsvRef.current = hsv; }, [hsv]);

  // Sync when `color` prop changes from outside
  const prevColor = useRef(color);
  useEffect(() => {
    if (prevColor.current === color) return;
    prevColor.current = color;
    const n = normalizeHex(color);
    if (!n) return;
    setHsv(hexToHsv(n));
    setHexInput(n);
  }, [color]);

  const currentHex = useMemo(() => hsvToHex(hsv[0], hsv[1], hsv[2]), [hsv]);

  const onHueSatChange = useCallback((h: number, s: number) => {
    const cur = hsvRef.current;
    const newHsv: [number,number,number] = [h, s, cur[2]];
    setHsv(newHsv);
    const hex = hsvToHex(h, s, cur[2]);
    setHexInput(hex);
    onChange(hex);
  }, [onChange]);

  const onBrightnessChange = useCallback((v: number) => {
    const cur = hsvRef.current;
    const newHsv: [number,number,number] = [cur[0], cur[1], v];
    setHsv(newHsv);
    const hex = hsvToHex(cur[0], cur[1], v);
    setHexInput(hex);
    onChange(hex);
  }, [onChange]);

  const onHexType = useCallback((text: string) => {
    const upper = text.toUpperCase().replace(/[^0-9A-F#]/g, '');
    setHexInput(upper);
    const n = normalizeHex(upper);
    if (n) {
      const newHsv = hexToHsv(n);
      setHsv(newHsv);
      onChange(n);
    }
  }, [onChange]);

  return (
    <View style={styles.container}>
      <ColorWheel hue={hsv[0]} sat={hsv[1]} onHueSatChange={onHueSatChange} />

      <View style={styles.sliderRow}>
        <Text style={{ fontSize: 14 }}>◐</Text>
        <BrightnessSlider
          hue={hsv[0]} sat={hsv[1]} brightness={hsv[2]}
          onChange={onBrightnessChange}
        />
      </View>

      <View style={styles.hexRow}>
        <View style={[styles.swatch, { backgroundColor: currentHex }]} />
        <TextInput
          value={hexInput}
          onChangeText={onHexType}
          autoCapitalize="characters"
          maxLength={7}
          style={[
            styles.hexInput,
            {
              color: theme.colors.onSurface,
              backgroundColor: theme.colors.surfaceVariant,
              borderColor: theme.colors.outline,
            },
          ]}
          placeholder="#FFFFFF"
          placeholderTextColor={theme.colors.onSurfaceVariant}
        />
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:   { gap: 16, alignItems: 'center', paddingVertical: 8 },
  sliderRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hexRow:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  swatch:      { width: 38, height: 38, borderRadius: 10, borderWidth: 1, borderColor: '#00000020' },
  hexInput:    {
    width: 140,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 1.5,
  },
  sliderThumb: {
    position: 'absolute',
    width:  SLIDER_THUMB_R * 2,
    height: SLIDER_THUMB_R * 2,
    borderRadius: SLIDER_THUMB_R,
    borderWidth: 3,
    borderColor: 'white',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
});
