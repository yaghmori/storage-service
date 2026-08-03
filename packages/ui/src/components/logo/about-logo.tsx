"use client";
import { BlurFade } from "../magicui/blur-fade";
import { useTheme } from "next-themes";
interface LogoProps {
  className?: string;
  width: number;
}

export default function AboutLogo({ className, width = 300 }: LogoProps) {
  const theme = useTheme();

  return (
    <BlurFade delay={0.3} className={className}>
      {theme.theme === "dark" ? (
        <img
          src="/assets/logo/logo.en.dark.png"
          alt="Allyfe Logo"
          width={width}
        />
      ) : (
        <img
          src="/assets/logo/logo.en.png"
          alt="Allyfe Logo"
          width={width}
        />
      )}
    </BlurFade>
  );
}
