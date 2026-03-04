export type VisualImage = {
  id: string;
  kind: "image";
  mime: string;
  blob: Blob;
  createdAt: number;
};

export type ThemeColorPreset = {
  name: string;
  value: string;
};

export const DEFAULT_THEME_COLOR = "#2563EB";
export const DEFAULT_SURFACE_COLOR = "#0F172A";
export const MAX_CUSTOM_THEME_COLORS = 5;

export const THEME_COLOR_PRESETS: readonly ThemeColorPreset[] = [
  { name: "Blue", value: DEFAULT_THEME_COLOR }
];

export type VisualPrefs = {
  selectedKind: "none" | "image" | "video";
  selectedImageId?: string;
  youtubeUrl?: string;
  overlayDarkness: number;
  backgroundBlurPx: number;
  themeColor: string;
  customThemeColors: string[];
  surfaceColor: string;
  customSurfaceColors: string[];
  updatedAt: number;
};

export const VISUAL_PREFS_KEY = "visualPrefs";
export const MAX_VISUAL_IMAGES = 4;

export const DEFAULT_VISUAL_PREFS: VisualPrefs = {
  selectedKind: "none",
  overlayDarkness: 0.32,
  backgroundBlurPx: 0,
  themeColor: DEFAULT_THEME_COLOR,
  customThemeColors: Array(MAX_CUSTOM_THEME_COLORS).fill(""),
  surfaceColor: DEFAULT_SURFACE_COLOR,
  customSurfaceColors: Array(MAX_CUSTOM_THEME_COLORS).fill(""),
  updatedAt: 0
};

const LEGACY_THEME_ALIASES: Record<string, string> = {
  blue: "#2563EB",
  violet: "#7C3AED",
  emerald: "#10B981",
  amber: "#F59E0B",
  rose: "#FB7185"
};

const LEGACY_SURFACE_ALIASES: Record<string, string> = {
  navy: "#0F172A",
  slate: "#1E293B",
  charcoal: "#111827",
  dusk: "#1F2937",
  ocean: "#0B1E3A"
};

const clamp = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
};

const expandShortHex = (hex: string): string => {
  if (hex.length !== 4) {
    return hex;
  }
  return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
};

const parseHexColor = (value: string): { r: number; g: number; b: number } | null => {
  const normalized = expandShortHex(value.trim());
  if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) {
    return null;
  }
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16)
  };
};

const toHex = ({ r, g, b }: { r: number; g: number; b: number }): string => {
  const channel = (value: number) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`.toUpperCase();
};

const mixRgb = (
  color: { r: number; g: number; b: number },
  target: { r: number; g: number; b: number },
  ratio: number
): { r: number; g: number; b: number } => {
  const t = clamp(ratio, 0, 1);
  return {
    r: color.r + (target.r - color.r) * t,
    g: color.g + (target.g - color.g) * t,
    b: color.b + (target.b - color.b) * t
  };
};

const toLinear = (channel: number): number => {
  const normalized = channel / 255;
  if (normalized <= 0.04045) {
    return normalized / 12.92;
  }
  return ((normalized + 0.055) / 1.055) ** 2.4;
};

const normalizeHexColor = (
  value: unknown,
  fallback: string,
  aliases?: Record<string, string>
): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fallback;
  }
  const raw = value.trim();
  const aliasValue = aliases?.[raw.toLowerCase()];
  if (aliasValue) {
    return aliasValue;
  }
  const parsed = parseHexColor(raw);
  if (!parsed) {
    return fallback;
  }
  return toHex(parsed);
};

export const normalizeThemeColor = (value: unknown): string => {
  return normalizeHexColor(value, DEFAULT_THEME_COLOR, LEGACY_THEME_ALIASES);
};

export const normalizeSurfaceColor = (value: unknown): string => {
  return normalizeHexColor(value, DEFAULT_SURFACE_COLOR, LEGACY_SURFACE_ALIASES);
};

export const sanitizeCustomColorSlots = (
  value: unknown,
  kind: "theme" | "surface"
): string[] => {
  const normalize = kind === "theme" ? normalizeThemeColor : normalizeSurfaceColor;
  const slots = Array(MAX_CUSTOM_THEME_COLORS).fill("");
  if (!Array.isArray(value)) {
    return slots;
  }
  for (let index = 0; index < MAX_CUSTOM_THEME_COLORS; index += 1) {
    const entry = value[index];
    if (typeof entry !== "string" || entry.trim().length === 0) {
      continue;
    }
    slots[index] = normalize(entry);
  }
  return slots;
};

export const getRelativeLuminance = (hexColor: string): number => {
  const parsed = parseHexColor(hexColor);
  if (!parsed) {
    return 0;
  }
  const r = toLinear(parsed.r);
  const g = toLinear(parsed.g);
  const b = toLinear(parsed.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const isLightThemeColor = (hexColor: string): boolean => {
  return getRelativeLuminance(hexColor) >= 0.42;
};

export const deriveThemeVars = (hexColor: string) => {
  const normalized = normalizeThemeColor(hexColor);
  const parsed = parseHexColor(normalized);
  const base = parsed ?? { r: 37, g: 99, b: 235 };
  const light = isLightThemeColor(normalized);
  const hover = light
    ? mixRgb(base, { r: 0, g: 0, b: 0 }, 0.14)
    : mixRgb(base, { r: 255, g: 255, b: 255 }, 0.14);

  return {
    primary: toHex(base),
    primaryHover: toHex(hover),
    focusRing: `rgba(${base.r}, ${base.g}, ${base.b}, 0.5)`,
    primaryRgb: `${base.r}, ${base.g}, ${base.b}`,
    onPrimary: light ? "#0F172A" : "#FFFFFF"
  };
};

export const deriveSurfaceVars = (hexColor: string) => {
  const normalized = normalizeSurfaceColor(hexColor);
  const parsed = parseHexColor(normalized);
  const base = parsed ?? { r: 15, g: 23, b: 42 };
  const deep = mixRgb(base, { r: 2, g: 6, b: 23 }, 0.55);
  const card = mixRgb(base, { r: 30, g: 41, b: 59 }, 0.25);
  const cardHover = mixRgb(base, { r: 51, g: 65, b: 85 }, 0.35);
  const light = getRelativeLuminance(normalized) >= 0.35;

  return {
    bgPage: toHex(base),
    bgPageRgb: `${base.r}, ${base.g}, ${base.b}`,
    bgPageDeepRgb: `${Math.round(deep.r)}, ${Math.round(deep.g)}, ${Math.round(deep.b)}`,
    surfaceRgb: `${Math.round(card.r)}, ${Math.round(card.g)}, ${Math.round(card.b)}`,
    bgCard: `rgba(${Math.round(card.r)}, ${Math.round(card.g)}, ${Math.round(card.b)}, 0.7)`,
    bgCardHover: `rgba(${Math.round(cardHover.r)}, ${Math.round(cardHover.g)}, ${Math.round(cardHover.b)}, 0.82)`,
    borderCard: light ? "rgba(15, 23, 42, 0.22)" : "rgba(255, 255, 255, 0.08)",
    shellFog: light ? "rgba(15, 23, 42, 0.08)" : "rgba(148, 163, 184, 0.12)"
  };
};
