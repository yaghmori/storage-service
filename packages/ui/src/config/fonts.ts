export const fonts = [
  'vazirmatn',
  'inter',
  'mulish',
  'instrument',
  'noto',
  'sora',
  'geist'
] as const;

export type FontKey = (typeof fonts)[number];

export function createFontVariables(variables: string[]): string {
  return variables.join(' ');
}

export function createFontUtils() {
  return {
    fonts,
    getFontClassFromCookie(font: string | undefined | null): string {
      const safeFont = font?.toLowerCase();
      
      if (safeFont && fonts.includes(safeFont as FontKey)) {
        return `font-${safeFont}`;
      }
      
      return 'font-geist'; // fallback default
    }
  };
}

// Font configuration that can be shared
export const fontConfig = {
  defaultFont: 'geist',
  availableFonts: fonts,
  cssVariables: {
    geist: '--font-geist',
    mono: '--font-mono',
    instrument: '--font-instrument',
    noto: '--font-noto-mono',
    mulish: '--font-mulish',
    inter: '--font-inter',
    vazirmatn: '--font-vazirmatn',
    sora: '--font-sora'
  }
} as const;
