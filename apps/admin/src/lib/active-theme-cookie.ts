import {
  ACTIVE_THEME_COOKIE,
  DEFAULT_THEME_NAME,
  isThemeName,
  type ThemeName,
} from "@workspace/ui/config/themes";

export function readActiveThemeCookie(): ThemeName {
  if (typeof document === "undefined") return DEFAULT_THEME_NAME;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${ACTIVE_THEME_COOKIE}=`));
  const value = match?.split("=")[1];
  return isThemeName(value) ? value : DEFAULT_THEME_NAME;
}
