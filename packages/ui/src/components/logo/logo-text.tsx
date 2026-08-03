"use client";
import { BlurFade } from "../magicui/blur-fade";
import { cn } from "@workspace/ui/lib/utils";
import { AnimatePresence, motion } from "motion/react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

interface LogoProps {
  textClass?: string;
  className?: string;
  size?: number;
  imageClass?: string;
}

export default function LogoText({
  className,
  size = 24,
  textClass,
  imageClass = "size-4 shrink-0 aspect-square ",
}: LogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Show light theme logo by default during SSR
  const logoSrc = !mounted
    ? "/assets/logo/logo.png"
    : resolvedTheme === "dark"
      ? "/assets/logo/logo.dark.png"
      : "/assets/logo/logo.png";

  // Set direction based on locale
  const direction = -50;

  return (
    <BlurFade
      delay={0.3}
      className="flex flex-row gap-1 overflow-hidden text-lg"
    >
      <AnimatePresence mode="wait">
        <motion.img
          key={
            mounted
              ? resolvedTheme === "dark"
                ? "dark-logo"
                : "light-logo"
              : "default-logo"
          }
          src={logoSrc}
          alt="Allyfe Logo"
          initial={{ x: direction }}
          animate={{ x: 0 }}
          exit={{ x: direction }}
          className={cn("shrink-0", imageClass)}
          transition={{
            x: { duration: 0.4, ease: "easeOut" },
          }}
        />
      </AnimatePresence>

      <motion.span
        className={cn("flex items-center font-semibold", textClass)}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <p className="text-foreground">Pars</p>
        <p className={cn("pr-1", "font-bold text-violet-500")}>links</p>
      </motion.span>
    </BlurFade>
  );
}
