"use client";

import { IMAGES } from "@/lib/constants/images";
import { cn } from "@/lib/utils";
import type { CSSProperties, ReactNode } from "react";

type ProfileMaskedAvatarProps = {
  src?: string | null;
  alt: string;
  className?: string;
  sizeClassName?: string;
};

const maskStyle: CSSProperties = {
  maskImage: `url(${IMAGES.profileShape})`,
  maskSize: "100%",
  maskRepeat: "no-repeat",
  maskPosition: "center",
  WebkitMaskImage: `url(${IMAGES.profileShape})`,
  WebkitMaskSize: "100%",
  WebkitMaskRepeat: "no-repeat",
  WebkitMaskPosition: "center",
  objectFit: "cover",
};

/** Same as eallyfe: empty / whitespace / broken URLs → `/default-avatar.svg`. */
export function resolveProfileAvatarSrc(src?: string | null): string {
  const trimmed = typeof src === "string" ? src.trim() : "";
  return trimmed || IMAGES.defaultAvatar;
}

export function ProfileMaskedAvatar({
  src,
  alt,
  className,
  sizeClassName = "size-20",
}: ProfileMaskedAvatarProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolveProfileAvatarSrc(src)}
      alt={alt}
      style={maskStyle}
      className={cn("bg-muted", sizeClassName, className)}
      onError={(e) => {
        if (e.currentTarget.src.endsWith(IMAGES.defaultAvatar)) return;
        e.currentTarget.src = IMAGES.defaultAvatar;
      }}
    />
  );
}

export function ProfileMaskedOverlay({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute inset-0 flex items-center justify-center bg-foreground/50 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100",
        className,
      )}
      style={maskStyle}
    >
      {children}
    </span>
  );
}
