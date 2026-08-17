"use client";

import { IMAGES } from "@/lib/constants/images";
import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

type OrgMaskedAvatarProps = {
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

/** Parslinks-style org fallback: empty / whitespace / broken → `/placeholder.png`. */
export function resolveOrgAvatarSrc(src?: string | null): string {
  const trimmed = typeof src === "string" ? src.trim() : "";
  return trimmed || IMAGES.orgPlaceholder;
}

export function OrgMaskedAvatar({
  src,
  alt,
  className,
  sizeClassName = "size-8",
}: OrgMaskedAvatarProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolveOrgAvatarSrc(src)}
      alt={alt}
      style={maskStyle}
      className={cn("bg-muted", sizeClassName, className)}
      onError={(e) => {
        if (e.currentTarget.src.endsWith(IMAGES.orgPlaceholder)) return;
        e.currentTarget.src = IMAGES.orgPlaceholder;
      }}
    />
  );
}
