/** Normalize `#RGB` / `#RRGGBB` (any case) to uppercase `#RRGGBB`, or null. */
export function normalizeServiceColor(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const short = /^#([0-9A-Fa-f]{3})$/.exec(trimmed);
  if (short) {
    const hex = short[1] ?? "";
    const r = hex.charAt(0);
    const g = hex.charAt(1);
    const b = hex.charAt(2);
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  return null;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeServiceColor(hex);
  if (!normalized) return null;
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

/** Relative luminance 0–1 (sRGB). */
function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel(rgb.r) +
    0.7152 * channel(rgb.g) +
    0.0722 * channel(rgb.b)
  );
}

export type ServiceColorCardStyle = {
  background: string;
  borderColor: string;
  color: string;
};

/**
 * Inline styles for calendar event cards painted from a service hex color.
 * Picks light or dark text for contrast.
 */
export function serviceColorToCardStyle(
  hex?: string | null,
): ServiceColorCardStyle | null {
  const color = normalizeServiceColor(hex);
  if (!color) return null;
  const rgb = hexToRgb(color);
  if (!rgb) return null;

  const darkText = relativeLuminance(color) > 0.55;
  const text = darkText ? "#1A1A1A" : "#FFFFFF";
  const border = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.65)`;

  return {
    background: `linear-gradient(to bottom, ${color}, ${shadeHex(color, -8)})`,
    borderColor: border,
    color: text,
  };
}

function shadeHex(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const clamp = (n: number) => Math.max(0, Math.min(255, n));
  const to = (n: number) => clamp(n + amount).toString(16).padStart(2, "0");
  return `#${to(rgb.r)}${to(rgb.g)}${to(rgb.b)}`.toUpperCase();
}

/** Curated palette for admin service color picker. */
export const SERVICE_COLOR_PALETTE = [
  "#F97316",
  "#EAB308",
  "#22C55E",
  "#14B8A6",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#EF4444",
  "#64748B",
  "#0F766E",
] as const;
