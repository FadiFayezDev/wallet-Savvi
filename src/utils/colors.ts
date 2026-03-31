type Rgb = { r: number; g: number; b: number };

const clamp = (value: number, min = 0, max = 255) => Math.min(max, Math.max(min, value));

export const normalizeHex = (input: string): string | null => {
  const raw = input?.trim();
  if (!raw) return null;

  // Handle rgb() and rgba()
  if (raw.startsWith('rgb')) {
    const match = raw.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      const r = parseInt(match[1], 10);
      const g = parseInt(match[2], 10);
      const b = parseInt(match[3], 10);
      return rgbToHex({ r, g, b });
    }
  }

  const hex = raw.startsWith('#') ? raw.slice(1) : raw;
  if (hex.length === 3) {
    const expanded = hex.split('').map((c) => c + c).join('');
    return /^[0-9a-fA-F]{6}$/.test(expanded) ? `#${expanded.toUpperCase()}` : null;
  }
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  return `#${hex.toUpperCase()}`;
};

export const isValidHex = (input: string) => normalizeHex(input) !== null;

export const hexToRgb = (hex: string): Rgb | null => {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  const raw = normalized.slice(1);
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  };
};

export const rgbToHex = ({ r, g, b }: Rgb): string =>
  `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('')}`.toUpperCase();

export const mixColors = (colorA: string, colorB: string, ratio = 0.5): string | null => {
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);
  if (!a || !b) return null;
  const t = Math.min(1, Math.max(0, ratio));
  return rgbToHex({
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  });
};

export const lighten = (color: string, amount = 0.2): string | null => mixColors(color, '#FFFFFF', amount);
export const darken = (color: string, amount = 0.2): string | null => mixColors(color, '#000000', amount);

export const withAlpha = (color: string, alpha: number) => {
  if (color.startsWith('#')) {
    const rgb = hexToRgb(color);
    if (rgb) {
      return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
    }
  }
  if (color.startsWith('rgb(')) {
    return color.replace('rgb(', 'rgba(').replace(')', `,${alpha})`);
  }
  if (color.startsWith('rgba(')) {
    return color.replace(/rgba\(([^,]+),([^,]+),([^,]+),[^\)]+\)/, `rgba($1,$2,$3,${alpha})`);
  }
  return color;
};

export const getOnColor = (color: string, light = '#FFFFFF', dark = '#000000') => {
  const rgb = hexToRgb(color);
  if (!rgb) return light;
  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  return luminance > 0.6 ? dark : light;
};

export const deriveCustomThemeColors = (primary: string, secondary: string, isDark: boolean) => {
  const p = normalizeHex(primary) ?? '#6750A4';
  const s = normalizeHex(secondary) ?? '#625B71';
  const t = mixColors(p, s, 0.5) ?? p;

  const primaryContainer = isDark ? darken(p, 0.35) ?? p : lighten(p, 0.35) ?? p;
  const secondaryContainer = isDark ? darken(s, 0.35) ?? s : lighten(s, 0.35) ?? s;
  const tertiaryContainer = isDark ? darken(t, 0.35) ?? t : lighten(t, 0.35) ?? t;

  return {
    primary: p,
    onPrimary: getOnColor(p),
    primaryContainer,
    onPrimaryContainer: getOnColor(primaryContainer),
    secondary: s,
    onSecondary: getOnColor(s),
    secondaryContainer,
    onSecondaryContainer: getOnColor(secondaryContainer),
    tertiary: t,
    onTertiary: getOnColor(t),
    tertiaryContainer,
    onTertiaryContainer: getOnColor(tertiaryContainer),
  };
};
