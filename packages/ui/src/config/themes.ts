export const THEME_NAME_VALUES = [
  "default",
  "blue",
  "green",
  "amber",
] as const;

export type ThemeName = (typeof THEME_NAME_VALUES)[number];

export const DEFAULT_THEMES = [
  {
    name: "Default",
    value: "default",
    /** Sample swatch for the theme picker */
    swatch: "#171717",
  },
  {
    name: "Blue",
    value: "blue",
    swatch: "#3b82f6",
  },
  {
    name: "Green",
    value: "green",
    swatch: "#16a34a",
  },
  {
    name: "Amber",
    value: "amber",
    swatch: "#d97706",
  },
] as const satisfies ReadonlyArray<{
  name: string;
  value: ThemeName;
  swatch: string;
}>;

export const THEME_MODE_VALUES = ["light", "dark"] as const;
export type ThemeMode = (typeof THEME_MODE_VALUES)[number];

export const ACTIVE_THEME_COOKIE = "active_theme";
export const DEFAULT_THEME_NAME: ThemeName = "default";

export function isThemeName(value: unknown): value is ThemeName {
  return (
    typeof value === "string" &&
    (THEME_NAME_VALUES as readonly string[]).includes(value)
  );
}

/** Body class for a color theme. Default has no class. */
export function themeBodyClass(themeName: ThemeName | string): string | null {
  if (!themeName || themeName === "default") return null;
  return `theme-${themeName}`;
}

export function themeSwatch(themeName: ThemeName | string): string {
  const match = DEFAULT_THEMES.find((t) => t.value === themeName);
  return match?.swatch ?? "#171717";
}

export const SCALED_THEMES = [
  {
    name: "Default",
    value: "default-scaled",
  },
  {
    name: "Blue",
    value: "blue-scaled",
  },
];

export const MONO_THEMES = [
  {
    name: "Mono",
    value: "mono-scaled",
  },
];
