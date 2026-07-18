"use client";
import { gsap } from "gsap";
import React, { useCallback, useLayoutEffect, useRef, useState } from "react";

export interface StaggeredMenuItem {
  label: string;
  ariaLabel: string;
  link: string;
}
export interface StaggeredMenuSocialItem {
  label: string;
  link: string;
}
export interface StaggeredMenuProps {
  position?: "left" | "right";
  colors?: string[];
  items?: StaggeredMenuItem[];
  socialItems?: StaggeredMenuSocialItem[];
  displaySocials?: boolean;
  displayItemNumbering?: boolean;
  className?: string;
  logoUrl?: string;
  menuButtonColor?: string;
  openMenuButtonColor?: string;
  accentColor?: string;
  isFixed: boolean;
  changeMenuColorOnOpen?: boolean;
  closeOnClickAway?: boolean;
  onMenuOpen?: () => void;
  onMenuClose?: () => void;
  onItemClick?: (
    item: StaggeredMenuItem,
    event: React.MouseEvent
  ) => void | false;
  menuTextColor?: "black" | "white" | "auto";
  heroSectionId?: string;
  headerLeftContent?: React.ReactNode;
  headerRightContent?: React.ReactNode;
  panelHeaderContent?: React.ReactNode;
  controlledOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onItemsExitComplete?: () => void;
  triggerItemsExit?: boolean;
}

export const StaggeredMenu: React.FC<StaggeredMenuProps> = ({
  className,
  position = "right",
  colors = ["#B19EEF", "#5227FF"],
  items = [],
  socialItems = [],
  displaySocials = true,
  displayItemNumbering = false,
  logoUrl = "/src/assets/logos/reactbits-gh-white.svg",
  menuButtonColor = "#fff",
  openMenuButtonColor = "#fff",
  changeMenuColorOnOpen = true,
  accentColor = "#5227FF",
  isFixed = false,
  closeOnClickAway = true,
  onMenuOpen,
  onMenuClose,
  onItemClick,
  menuTextColor = "auto",
  heroSectionId,
  headerLeftContent,
  headerRightContent,
  panelHeaderContent,
  controlledOpen,
  onOpenChange,
  onItemsExitComplete,
  triggerItemsExit,
}: StaggeredMenuProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const openRef = useRef(false);
  const [isOnHeroSection, setIsOnHeroSection] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const preLayersRef = useRef<HTMLDivElement | null>(null);
  const preLayerElsRef = useRef<HTMLElement[]>([]);

  const hamburgerTopRef = useRef<HTMLSpanElement | null>(null);
  const hamburgerMidRef = useRef<HTMLSpanElement | null>(null);
  const hamburgerBottomRef = useRef<HTMLSpanElement | null>(null);
  const iconRef = useRef<HTMLSpanElement | null>(null);

  const textInnerRef = useRef<HTMLSpanElement | null>(null);
  const textWrapRef = useRef<HTMLSpanElement | null>(null);
  const [textLines, setTextLines] = useState<string[]>(["MENU", "CLOSE"]);

  const openTlRef = useRef<gsap.core.Timeline | null>(null);
  const closeTweenRef = useRef<gsap.core.Tween | null>(null);
  const spinTweenRef = useRef<gsap.core.Timeline | null>(null);
  const textCycleAnimRef = useRef<gsap.core.Tween | null>(null);
  const colorTweenRef = useRef<gsap.core.Tween | null>(null);

  const toggleBtnRef = useRef<HTMLButtonElement | null>(null);
  const busyRef = useRef(false);

  const itemEntranceTweenRef = useRef<gsap.core.Tween | null>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const panel = panelRef.current;
      const preContainer = preLayersRef.current;

      const hamburgerTop = hamburgerTopRef.current;
      const hamburgerMid = hamburgerMidRef.current;
      const hamburgerBottom = hamburgerBottomRef.current;
      const icon = iconRef.current;
      const textInner = textInnerRef.current;

      if (
        !panel ||
        !hamburgerTop ||
        !hamburgerMid ||
        !hamburgerBottom ||
        !icon ||
        !textInner
      )
        return;

      let preLayers: HTMLElement[] = [];
      if (preContainer) {
        preLayers = Array.from(
          preContainer.querySelectorAll(".sm-prelayer")
        ) as HTMLElement[];
      }
      preLayerElsRef.current = preLayers;

      const offscreen = position === "left" ? -100 : 100;
      // Always start offscreen - the useEffect will handle opening with proper animations
      gsap.set([panel, ...preLayers], { xPercent: offscreen });

      gsap.set(hamburgerTop, {
        transformOrigin: "50% 50%",
        rotate: 0,
        xPercent: -50,
        yPercent: -50,
        y: -6.5,
      });
      gsap.set(hamburgerMid, {
        transformOrigin: "50% 50%",
        opacity: 1,
        scale: 1,
        xPercent: -50,
        yPercent: -50,
        y: 0,
      });
      gsap.set(hamburgerBottom, {
        transformOrigin: "50% 50%",
        rotate: 0,
        xPercent: -50,
        yPercent: -50,
        y: 6.5,
      });
      gsap.set(icon, { rotate: 0, transformOrigin: "50% 50%" });

      gsap.set(textInner, { yPercent: 0 });

      if (toggleBtnRef.current) {
        gsap.set(toggleBtnRef.current, { color: menuButtonColor });
      }
    });
    return () => ctx.revert();
  }, [menuButtonColor, position, controlledOpen, openMenuButtonColor]);

  const buildOpenTimeline = useCallback(() => {
    const panel = panelRef.current;
    const layers = preLayerElsRef.current;
    if (!panel) return null;

    openTlRef.current?.kill();
    if (closeTweenRef.current) {
      closeTweenRef.current.kill();
      closeTweenRef.current = null;
    }
    itemEntranceTweenRef.current?.kill();

    const itemEls = Array.from(
      panel.querySelectorAll(".sm-panel-itemLabel")
    ) as HTMLElement[];
    const numberEls = Array.from(
      panel.querySelectorAll(".sm-panel-list[data-numbering] .sm-panel-item")
    ) as HTMLElement[];
    const socialTitle = panel.querySelector(
      ".sm-socials-title"
    ) as HTMLElement | null;
    const socialLinks = Array.from(
      panel.querySelectorAll(".sm-socials-link")
    ) as HTMLElement[];

    const layerStates = layers.map((el) => ({
      el,
      start: Number(gsap.getProperty(el, "xPercent")),
    }));
    const panelStart = Number(gsap.getProperty(panel, "xPercent"));

    if (itemEls.length) gsap.set(itemEls, { yPercent: 140, rotate: 10 });
    if (numberEls.length)
      gsap.set(numberEls, { ["--sm-num-opacity" as any]: 0 });
    if (socialTitle) gsap.set(socialTitle, { opacity: 0 });
    if (socialLinks.length) gsap.set(socialLinks, { y: 25, opacity: 0 });

    const tl = gsap.timeline({ paused: true });

    layerStates.forEach((ls, i) => {
      tl.fromTo(
        ls.el,
        { xPercent: ls.start },
        { xPercent: 0, duration: 0.5, ease: "power4.out" },
        i * 0.07
      );
    });

    const lastTime = layerStates.length ? (layerStates.length - 1) * 0.07 : 0;
    const panelInsertTime = lastTime + (layerStates.length ? 0.08 : 0);
    const panelDuration = 0.65;

    tl.fromTo(
      panel,
      { xPercent: panelStart },
      { xPercent: 0, duration: panelDuration, ease: "power4.out" },
      panelInsertTime
    );

    if (itemEls.length) {
      const itemsStartRatio = 0.15;
      const itemsStart = panelInsertTime + panelDuration * itemsStartRatio;

      tl.to(
        itemEls,
        {
          yPercent: 0,
          rotate: 0,
          duration: 1,
          ease: "power4.out",
          stagger: { each: 0.1, from: "start" },
        },
        itemsStart
      );

      if (numberEls.length) {
        tl.to(
          numberEls,
          {
            duration: 0.6,
            ease: "power2.out",
            ["--sm-num-opacity" as any]: 1,
            stagger: { each: 0.08, from: "start" },
          },
          itemsStart + 0.1
        );
      }
    }

    if (socialTitle || socialLinks.length) {
      const socialsStart = panelInsertTime + panelDuration * 0.4;

      if (socialTitle)
        tl.to(
          socialTitle,
          { opacity: 1, duration: 0.5, ease: "power2.out" },
          socialsStart
        );
      if (socialLinks.length) {
        tl.to(
          socialLinks,
          {
            y: 0,
            opacity: 1,
            duration: 0.55,
            ease: "power3.out",
            stagger: { each: 0.08, from: "start" },
            onComplete: () => {
              gsap.set(socialLinks, { clearProps: "opacity" });
            },
          },
          socialsStart + 0.04
        );
      }
    }

    openTlRef.current = tl;
    return tl;
  }, [position]);

  // Function to animate items entrance (for when items change while menu is open)
  const animateItemsEntrance = useCallback(() => {
    const panel = panelRef.current;
    if (!panel || !openRef.current) return;

    itemEntranceTweenRef.current?.kill();

    // Use useLayoutEffect timing - set initial state immediately before paint
    const itemEls = Array.from(
      panel.querySelectorAll(".sm-panel-itemLabel")
    ) as HTMLElement[];
    const numberEls = Array.from(
      panel.querySelectorAll(".sm-panel-list[data-numbering] .sm-panel-item")
    ) as HTMLElement[];

    if (!itemEls.length) return;

    // Set initial state IMMEDIATELY to prevent flash
    gsap.set(itemEls, {
      yPercent: 140,
      rotate: 10,
      opacity: 1,
    });

    if (numberEls.length) {
      gsap.set(numberEls, { ["--sm-num-opacity" as any]: 0 });
    }

    // Small delay to ensure state is set, then animate
    requestAnimationFrame(() => {
      // Animate new items entrance with the EXACT same animation as initial open
      itemEntranceTweenRef.current = gsap.to(itemEls, {
        yPercent: 0,
        rotate: 0,
        duration: 1,
        ease: "power4.out",
        stagger: { each: 0.1, from: "start" },
        onComplete: () => {
          // Ensure items remain visible after animation
          gsap.set(itemEls, { clearProps: "transform" });
        },
      });

      if (numberEls.length) {
        gsap.to(numberEls, {
          duration: 0.6,
          ease: "power2.out",
          ["--sm-num-opacity" as any]: 1,
          stagger: { each: 0.08, from: "start" },
        });
      }
    });
  }, []);

  const playOpen = useCallback(() => {
    if (busyRef.current) return;
    busyRef.current = true;
    const tl = buildOpenTimeline();
    if (tl) {
      tl.eventCallback("onComplete", () => {
        busyRef.current = false;
      });
      tl.play(0);
    } else {
      busyRef.current = false;
    }
  }, [buildOpenTimeline]);

  const playClose = useCallback(() => {
    openTlRef.current?.kill();
    openTlRef.current = null;
    itemEntranceTweenRef.current?.kill();

    const panel = panelRef.current;
    const layers = preLayerElsRef.current;
    if (!panel) return;

    const all: HTMLElement[] = [...layers, panel];
    closeTweenRef.current?.kill();

    const offscreen = position === "left" ? -100 : 100;

    closeTweenRef.current = gsap.to(all, {
      xPercent: offscreen,
      duration: 0.32,
      ease: "power3.in",
      overwrite: "auto",
      onComplete: () => {
        const itemEls = Array.from(
          panel.querySelectorAll(".sm-panel-itemLabel")
        ) as HTMLElement[];
        if (itemEls.length) gsap.set(itemEls, { yPercent: 140, rotate: 10 });

        const numberEls = Array.from(
          panel.querySelectorAll(
            ".sm-panel-list[data-numbering] .sm-panel-item"
          )
        ) as HTMLElement[];
        if (numberEls.length)
          gsap.set(numberEls, { ["--sm-num-opacity" as any]: 0 });

        const socialTitle = panel.querySelector(
          ".sm-socials-title"
        ) as HTMLElement | null;
        const socialLinks = Array.from(
          panel.querySelectorAll(".sm-socials-link")
        ) as HTMLElement[];
        if (socialTitle) gsap.set(socialTitle, { opacity: 0 });
        if (socialLinks.length) gsap.set(socialLinks, { y: 25, opacity: 0 });

        busyRef.current = false;
      },
    });
  }, [position]);

  const animateIcon = useCallback((opening: boolean) => {
    const icon = iconRef.current;
    const top = hamburgerTopRef.current;
    const mid = hamburgerMidRef.current;
    const bottom = hamburgerBottomRef.current;
    if (!icon || !top || !mid || !bottom) return;

    spinTweenRef.current?.kill();

    if (opening) {
      // ensure container never rotates
      gsap.set(icon, { rotate: 0, transformOrigin: "50% 50%" });
      spinTweenRef.current = gsap
        .timeline({ defaults: { ease: "power4.out" } })
        .to(top, { rotate: 45, yPercent: -50, y: 0, duration: 0.5 }, 0)
        .to(mid, { opacity: 0, scale: 0, duration: 0.3 }, 0)
        .to(bottom, { rotate: -45, yPercent: -50, y: 0, duration: 0.5 }, 0);
    } else {
      spinTweenRef.current = gsap
        .timeline({ defaults: { ease: "power3.inOut" } })
        .to(top, { rotate: 0, yPercent: -50, y: -6.5, duration: 0.35 }, 0)
        .to(
          mid,
          { opacity: 1, scale: 1, yPercent: -50, y: 0, duration: 0.35 },
          0
        )
        .to(bottom, { rotate: 0, yPercent: -50, y: 6.5, duration: 0.35 }, 0)
        .to(icon, { rotate: 0, duration: 0.001 }, 0);
    }
  }, []);

  const animateColor = useCallback(
    (opening: boolean) => {
      const btn = toggleBtnRef.current;
      if (!btn) return;
      colorTweenRef.current?.kill();
      if (changeMenuColorOnOpen) {
        const targetColor = opening ? openMenuButtonColor : menuButtonColor;
        colorTweenRef.current = gsap.to(btn, {
          color: targetColor,
          delay: 0.18,
          duration: 0.3,
          ease: "power2.out",
        });
      } else {
        gsap.set(btn, { color: menuButtonColor });
      }
    },
    [openMenuButtonColor, menuButtonColor, changeMenuColorOnOpen]
  );

  React.useEffect(() => {
    if (toggleBtnRef.current) {
      if (changeMenuColorOnOpen) {
        const targetColor = openRef.current
          ? openMenuButtonColor
          : menuButtonColor;
        gsap.set(toggleBtnRef.current, { color: targetColor });
      } else {
        gsap.set(toggleBtnRef.current, { color: menuButtonColor });
      }
    }
  }, [changeMenuColorOnOpen, menuButtonColor, openMenuButtonColor, open]);

  const animateText = useCallback((opening: boolean) => {
    const inner = textInnerRef.current;
    if (!inner) return;

    textCycleAnimRef.current?.kill();

    const currentLabel = opening ? "MENU" : "CLOSE";
    const targetLabel = opening ? "CLOSE" : "MENU";
    const cycles = 3;

    const seq: string[] = [currentLabel];
    let last = currentLabel;
    for (let i = 0; i < cycles; i++) {
      last = last === "MENU" ? "CLOSE" : "MENU";
      seq.push(last);
    }
    if (last !== targetLabel) seq.push(targetLabel);
    seq.push(targetLabel);

    setTextLines(seq);
    gsap.set(inner, { yPercent: 0 });

    const lineCount = seq.length;
    const finalShift = ((lineCount - 1) / lineCount) * 100;

    textCycleAnimRef.current = gsap.to(inner, {
      yPercent: -finalShift,
      duration: 0.5 + lineCount * 0.07,
      ease: "power4.out",
    });
  }, []);

  const toggleMenu = useCallback(() => {
    const target = !openRef.current;
    openRef.current = target;
    if (controlledOpen === undefined) {
      setInternalOpen(target);
    }
    onOpenChange?.(target);

    if (target) {
      onMenuOpen?.();
      playOpen();
    } else {
      onMenuClose?.();
      playClose();
    }

    animateIcon(target);
    animateColor(target);
    animateText(target);
  }, [
    playOpen,
    playClose,
    animateIcon,
    animateColor,
    animateText,
    onMenuOpen,
    onMenuClose,
  ]);

  const closeMenu = useCallback(() => {
    if (openRef.current) {
      openRef.current = false;
      if (controlledOpen === undefined) {
        setInternalOpen(false);
      }
      onOpenChange?.(false);
      onMenuClose?.();
      playClose();
      animateIcon(false);
      animateColor(false);
      animateText(false);
    }
  }, [
    playClose,
    animateIcon,
    animateColor,
    animateText,
    onMenuClose,
    controlledOpen,
    onOpenChange,
  ]);

  // Handle controlled open state on mount and when it changes
  // This must be after all callback definitions
  React.useEffect(() => {
    if (controlledOpen !== undefined) {
      const wasOpen = openRef.current;
      openRef.current = controlledOpen;

      if (controlledOpen && !wasOpen) {
        // Menu was opened externally (either on mount or state change)
        // Use requestAnimationFrame to ensure DOM is ready
        const rafId = requestAnimationFrame(() => {
          // Double RAF to ensure layout is complete
          requestAnimationFrame(() => {
            playOpen();
            animateIcon(true);
            animateColor(true);
            animateText(true);
            onMenuOpen?.();
          });
        });
        return () => cancelAnimationFrame(rafId);
      } else if (!controlledOpen && wasOpen) {
        // Menu was closed externally
        playClose();
        animateIcon(false);
        animateColor(false);
        animateText(false);
        onMenuClose?.();
      }
    }
  }, [
    controlledOpen,
    playOpen,
    playClose,
    animateIcon,
    animateColor,
    animateText,
    onMenuOpen,
    onMenuClose,
  ]);

  // Watch for item changes and animate them if menu is open
  const prevItemsRef = React.useRef<string>("");
  const isAnimatingRef = React.useRef(false);
  const prevTriggerExitRef = React.useRef(false);

  // Handle triggerItemsExit - animate out current items
  const expectingNewItemsRef = React.useRef(false);

  // Set initial animation state immediately when new items appear (before paint)
  React.useLayoutEffect(() => {
    if (!open || !items || items.length === 0) return;

    const itemsKey = items.map((it) => `${it.label}-${it.link}`).join("|");

    // If items changed and we're expecting new items, set initial state immediately
    if (expectingNewItemsRef.current && prevItemsRef.current !== itemsKey) {
      const panel = panelRef.current;
      if (panel) {
        const itemEls = Array.from(
          panel.querySelectorAll(".sm-panel-itemLabel")
        ) as HTMLElement[];
        const numberEls = Array.from(
          panel.querySelectorAll(
            ".sm-panel-list[data-numbering] .sm-panel-item"
          )
        ) as HTMLElement[];

        // Set initial state IMMEDIATELY (synchronously, before browser paint)
        // This prevents the flash of unstyled content
        if (itemEls.length) {
          gsap.set(itemEls, {
            yPercent: 140,
            rotate: 10,
            opacity: 1,
          });
        }
        if (numberEls.length) {
          gsap.set(numberEls, { ["--sm-num-opacity" as any]: 0 });
        }
      }
    }
  }, [items, open]);
  React.useLayoutEffect(() => {
    if (
      triggerItemsExit &&
      !prevTriggerExitRef.current &&
      open &&
      !isAnimatingRef.current
    ) {
      prevTriggerExitRef.current = true;
      const panel = panelRef.current;
      if (panel) {
        isAnimatingRef.current = true;
        expectingNewItemsRef.current = true; // Mark that we're expecting new items

        // Capture current items in DOM and their key
        const oldItemEls = Array.from(
          panel.querySelectorAll(".sm-panel-itemLabel")
        ) as HTMLElement[];

        // Store current items key before exit
        if (items && items.length > 0) {
          const currentKey = items
            .map((it) => `${it.label}-${it.link}`)
            .join("|");
          prevItemsRef.current = currentKey;
        }

        // Animate out current items
        if (oldItemEls.length) {
          gsap.to(oldItemEls, {
            yPercent: -140, // Move up instead of down
            rotate: -10, // Rotate opposite direction
            opacity: 0,
            duration: 0.5,
            ease: "power2.in",
            stagger: { each: 0.05, from: "start" },
            onComplete: () => {
              // Notify parent that exit animation is complete
              onItemsExitComplete?.();
              isAnimatingRef.current = false;
            },
          });
        } else {
          onItemsExitComplete?.();
          isAnimatingRef.current = false;
        }
      }
    } else if (!triggerItemsExit) {
      prevTriggerExitRef.current = false;
    }
  }, [triggerItemsExit, open, onItemsExitComplete, items]);

  // Use useLayoutEffect to capture old items BEFORE React updates DOM
  React.useLayoutEffect(() => {
    if (!open || !items || items.length === 0) {
      if (prevItemsRef.current) {
        prevItemsRef.current = "";
      }
      return;
    }

    // Create a string representation of items to detect changes
    const itemsKey = items.map((it) => `${it.label}-${it.link}`).join("|");

    // If items changed and menu is open
    // Skip if we're expecting new items after a controlled exit (only animate entrance)
    if (
      prevItemsRef.current &&
      prevItemsRef.current !== itemsKey &&
      !isAnimatingRef.current &&
      !triggerItemsExit
    ) {
      const panel = panelRef.current;
      if (panel) {
        // If we're expecting new items, only animate entrance (no exit)
        // Initial state should already be set by the separate useLayoutEffect above
        if (expectingNewItemsRef.current) {
          expectingNewItemsRef.current = false;
          isAnimatingRef.current = true;

          // Animate entrance (initial state already set in separate useLayoutEffect)
          requestAnimationFrame(() => {
            animateItemsEntrance();
            isAnimatingRef.current = false;
            prevItemsRef.current = itemsKey;
          });
          return;
        }

        // Normal item change - animate exit then entrance
        isAnimatingRef.current = true;

        // Capture old items BEFORE React updates DOM (useLayoutEffect runs synchronously)
        const oldItemEls = Array.from(
          panel.querySelectorAll(".sm-panel-itemLabel")
        ) as HTMLElement[];

        // Animate out old items
        if (oldItemEls.length) {
          gsap.to(oldItemEls, {
            yPercent: -140,
            rotate: -10,
            opacity: 0,
            duration: 0.5,
            ease: "power2.in",
            stagger: { each: 0.05, from: "start" },
            onComplete: () => {
              // After exit, animate new items in
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  setTimeout(() => {
                    animateItemsEntrance();
                    isAnimatingRef.current = false;
                    prevItemsRef.current = itemsKey;
                  }, 50);
                });
              });
            },
          });
        } else {
          requestAnimationFrame(() => {
            setTimeout(() => {
              animateItemsEntrance();
              isAnimatingRef.current = false;
              prevItemsRef.current = itemsKey;
            }, 50);
          });
        }
        return;
      }
    }

    // Update ref if no animation needed
    if (
      prevItemsRef.current !== itemsKey &&
      !isAnimatingRef.current &&
      !expectingNewItemsRef.current
    ) {
      prevItemsRef.current = itemsKey;
    }
  }, [items, open, animateItemsEntrance, triggerItemsExit]);

  // Animate back button when it appears/disappears
  const backButtonAnimationRef = React.useRef<gsap.core.Tween | null>(null);
  const prevPanelHeaderContentRef = React.useRef<React.ReactNode>(null);

  React.useEffect(() => {
    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      const backButtonContainer = document.getElementById(
        "staggered-menu-back-button-container"
      );
      if (!backButtonContainer) {
        prevPanelHeaderContentRef.current = panelHeaderContent;
        return;
      }

      const backButton = backButtonContainer.querySelector(
        "#back-button"
      ) as HTMLElement;
      if (!backButton) {
        prevPanelHeaderContentRef.current = panelHeaderContent;
        return;
      }

      // Kill any existing animation
      backButtonAnimationRef.current?.kill();

      const hadContent =
        prevPanelHeaderContentRef.current !== null &&
        prevPanelHeaderContentRef.current !== undefined;
      const hasContent =
        panelHeaderContent !== null && panelHeaderContent !== undefined;

      if (open && hasContent && !hadContent) {
        // Back button is appearing - animate entrance
        gsap.set(backButton, {
          opacity: 0,
          x: -30,
          display: "flex",
          visibility: "visible",
        });
        backButtonAnimationRef.current = gsap.to(backButton, {
          opacity: 1,
          x: 0,
          duration: 0.6,
          ease: "power3.out",
          delay: 0.15,
        });
      } else if (open && !hasContent && hadContent) {
        // Back button is disappearing - animate exit
        backButtonAnimationRef.current = gsap.to(backButton, {
          opacity: 0,
          x: -30,
          duration: 0.4,
          ease: "power2.in",
          onComplete: () => {
            gsap.set(backButton, { display: "none", visibility: "hidden" });
          },
        });
      } else if (!open) {
        // Menu is closing - hide back button immediately
        gsap.set(backButton, {
          opacity: 0,
          x: -30,
          display: "none",
          visibility: "hidden",
        });
      } else if (open && hasContent && hadContent) {
        // Menu is open and back button should remain visible
        gsap.set(backButton, {
          display: "flex",
          visibility: "visible",
          opacity: 1,
          x: 0,
        });
      } else if (open && !hasContent) {
        // Menu is open but no back button - ensure it's hidden
        gsap.set(backButton, {
          display: "none",
          visibility: "hidden",
          opacity: 0,
          x: -30,
        });
      }

      prevPanelHeaderContentRef.current = panelHeaderContent;
    }, 10);

    return () => clearTimeout(timer);
  }, [open, panelHeaderContent]);

  React.useEffect(() => {
    if (!closeOnClickAway || !open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        toggleBtnRef.current &&
        !toggleBtnRef.current.contains(event.target as Node)
      ) {
        closeMenu();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [closeOnClickAway, open, closeMenu]);

  // Detect if we're on the hero section using element ID or viewport (optimized)
  React.useEffect(() => {
    if (menuTextColor !== "auto") return;

    // If heroSectionId is provided, use Intersection Observer
    if (heroSectionId) {
      // Use requestAnimationFrame to ensure DOM is ready
      const checkElement = () => {
        const heroElement = document.getElementById(heroSectionId);
        if (!heroElement) {
          // Retry after a short delay if element not found yet
          const timeoutId = setTimeout(() => {
            const retryElement = document.getElementById(heroSectionId);
            if (retryElement) {
              setupObserver(retryElement);
            } else {
              setIsOnHeroSection(false);
            }
          }, 100);
          return () => clearTimeout(timeoutId);
        }
        setupObserver(heroElement);
      };

      const setupObserver = (element: HTMLElement) => {
        // Initial check before setting up observer
        const rect = element.getBoundingClientRect();
        const initialIsVisible =
          rect.bottom > 0 && rect.top < window.innerHeight;
        setIsOnHeroSection(initialIsVisible);

        const observer = new IntersectionObserver(
          (entries) => {
            // Use requestAnimationFrame to batch state updates
            requestAnimationFrame(() => {
              const entry = entries[0]; // We only observe one element
              if (entry) {
                const isVisible =
                  entry.isIntersecting ||
                  (entry.boundingClientRect.bottom > 0 &&
                    entry.boundingClientRect.top < window.innerHeight);
                setIsOnHeroSection(isVisible);
              }
            });
          },
          {
            threshold: [0, 0.1, 0.5, 1], // Multiple thresholds for better detection
            rootMargin: "0px",
          }
        );

        observer.observe(element);

        return () => {
          observer.disconnect();
        };
      };

      const cleanup = checkElement();
      return cleanup;
    } else {
      // Fallback to viewport-based detection (optimized with throttling)
      let ticking = false;
      const handleScroll = () => {
        if (!ticking) {
          requestAnimationFrame(() => {
            const scrollY = window.scrollY || window.pageYOffset;
            const viewportHeight = window.innerHeight;
            setIsOnHeroSection(scrollY < viewportHeight * 1);
            ticking = false;
          });
          ticking = true;
        }
      };

      window.addEventListener("scroll", handleScroll, { passive: true });
      handleScroll(); // Check initial position

      return () => {
        window.removeEventListener("scroll", handleScroll);
      };
    }
  }, [menuTextColor, heroSectionId]);

  // Detect scroll to add blurry background to header
  React.useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const scrollY = window.scrollY || window.pageYOffset;
          setIsScrolled(scrollY > 0); // Show background after 10px scroll
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Check initial position

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <div
      className={`sm-scope z-40 ${isFixed ? "fixed top-0 left-0  w-screen h-screen overflow-hidden pointer-events-none" : "w-full h-full"}`}
    >
      <div
        className={
          (className ? className + " " : "") +
          "staggered-menu-wrapper pointer-events-none relative w-full h-full z-40"
        }
        style={
          accentColor
            ? ({ ["--sm-accent" as any]: accentColor } as React.CSSProperties)
            : undefined
        }
        data-position={position}
        data-open={open || undefined}
      >
        <div
          ref={preLayersRef}
          className="sm-prelayers absolute top-0 right-0 bottom-0 pointer-events-none z-[5]"
          aria-hidden="true"
        >
          {(() => {
            const raw =
              colors && colors.length
                ? colors.slice(0, 4)
                : ["#1e1e22", "#35353c"];
            let arr = [...raw];
            if (arr.length >= 3) {
              const mid = Math.floor(arr.length / 2);
              arr.splice(mid, 1);
            }
            return arr.map((c, i) => (
              <div
                key={i}
                className="sm-prelayer absolute top-0 right-0 h-full w-full translate-x-0"
                style={{ background: c }}
              />
            ));
          })()}
        </div>

        <header
          className={`flex flex-row staggered-menu-header absolute top-0 left-0 w-full h-20 items-center justify-between px-[1em] pt-[1em] pb-[1em] pointer-events-none z-20 transition-all duration-200 ${
            // isScrolled
            //   ? "bg-white/80 backdrop-blur-xl border-b border-border/50 shadow-md "
            //   : "bg-primary border-none  shadow-none"
            ""
            }`}
          aria-label="Main navigation header"
        >
          <div className=" flex items-center   pointer-events-auto">
            {headerLeftContent}
          </div>
          <div className="flex items-center gap-3 pointer-events-auto">
            {headerRightContent}
            <div
              className="bg-primary text-white cursor-pointer w-13 h-13 lg:w-32 transition-all duration-300 rounded-full flex items-center justify-center"
              onClick={toggleMenu}
            >
              <button
                ref={toggleBtnRef}
                className="sm-toggle relative inline-flex items-center bg-transparent border-0 cursor-pointer font-medium leading-none overflow-visible pointer-events-auto text-white"
                aria-label={open ? "Close menu" : "Open menu"}
                aria-expanded={open}
                aria-controls="staggered-menu-panel"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMenu();
                }}
                type="button"
              >
                <div className="hidden lg:block">
                  <span
                    ref={textWrapRef}
                    className="sm-toggle-textWrap    relative inline-block  overflow-hidden whitespace-nowrap w-[var(--sm-toggle-width,auto)] min-w-[var(--sm-toggle-width,auto)] "
                    aria-hidden="true"
                  >
                    <span
                      ref={textInnerRef}
                      className="sm-toggle-textInner flex flex-col leading-none"
                    >
                      {textLines.map((l, i) => (
                        <span
                          className="sm-toggle-line block leading-none text-xl flex items-center text-white"
                          key={i}
                        >
                          {l}
                        </span>
                      ))}
                    </span>
                  </span>
                </div>
                <span
                  ref={iconRef}
                  className="sm-icon relative   shrink-0 inline-flex items-center justify-center [will-change:transform]"
                  aria-hidden="true"
                >
                  <span
                    ref={hamburgerTopRef}
                    className="sm-icon-line sm-icon-line-top absolute left-1/2 top-1/2 w-full -translate-x-1/2 -translate-y-1/2 [will-change:transform] bg-current"
                  />
                  <span
                    ref={hamburgerMidRef}
                    className="sm-icon-line sm-icon-line-mid absolute left-1/2 top-1/2 w-full -translate-x-1/2 -translate-y-1/2 [will-change:transform] bg-current"
                  />
                  <span
                    ref={hamburgerBottomRef}
                    className="sm-icon-line sm-icon-line-bottom absolute left-1/2 top-1/2 w-full -translate-x-1/2 -translate-y-1/2 [will-change:transform] bg-current"
                  />
                </span>
              </button>
            </div>
          </div>
        </header>

        <aside
          id="staggered-menu-panel"
          ref={panelRef}
          className="staggered-menu-panel absolute top-0 right-0 h-full bg-white flex flex-col p-[6em_2em_2em_2em] overflow-y-auto z-10 backdrop-blur-[12px] pointer-events-auto"
          style={{ WebkitBackdropFilter: "blur(12px)" }}
          aria-hidden={!open}
        >
          <div className="sm-panel-inner flex-1 flex flex-col gap-3">
            {panelHeaderContent && (
              <div
                className="sm-panel-header mb-4"
                id="staggered-menu-back-button-container"
              >
                {panelHeaderContent}
              </div>
            )}
            <ul
              className="sm-panel-list list-none m-0 p-0 flex flex-col gap-0.5"
              role="list"
              data-numbering={displayItemNumbering || undefined}
            >
              {items && items.length ? (
                items.map((it, idx) => (
                  <li
                    className="sm-panel-itemWrap relative overflow-hidden leading-none "
                    key={it.label + idx}
                  >
                    <a
                      className="sm-panel-item relative text-primary font-semibold text-[2rem] sm:text-[2.25rem] cursor-pointer leading-tight tracking-[-0.5px] uppercase transition-[color] duration-300 ease-in-out inline-block no-underline pr-[1.4em] group w-full"
                      href={it.link}
                      aria-label={it.ariaLabel}
                      data-index={idx + 1}
                      onClick={(e) => {
                        if (onItemClick) {
                          const result = onItemClick(it, e);
                          // If onItemClick returns false or prevents default, don't navigate
                          if (result === false) {
                            e.preventDefault();
                            e.stopPropagation();
                          }
                        }
                      }}
                    >
                      <span className="sm-panel-itemLabel relative inline-block [transform-origin:50%_100%] will-change-transform z-[1] group-hover:text-foreground transition-colors duration-300 px-2 py-0.5">
                        <span className="relative z-[2]">{it.label}</span>
                      </span>
                    </a>
                  </li>
                ))
              ) : (
                <li
                  className="sm-panel-itemWrap relative overflow-hidden leading-none"
                  aria-hidden="true"
                >
                  <span className="sm-panel-item relative text-primary font-semibold text-[2rem] sm:text-[2.25rem] cursor-pointer leading-tight tracking-[-0.5px] uppercase transition-[color] duration-300 ease-in-out inline-block no-underline pr-[1.4em] group w-full">
                    <span className="sm-panel-itemLabel relative inline-block [transform-origin:50%_100%] will-change-transform z-[1] group-hover:text-foreground transition-colors duration-300 px-2 py-0.5">
                      <span className="relative z-[2]">No items</span>
                    </span>
                  </span>
                </li>
              )}
            </ul>

            {displaySocials && socialItems && socialItems.length > 0 && (
              <div
                className="sm-socials mt-auto pt-8 flex flex-col gap-3"
                aria-label="Social links"
              >
                <h3 className="sm-socials-title m-0 text-base font-medium [color:var(--sm-accent,#ff0000)]">
                  Socials
                </h3>
                <ul
                  className="sm-socials-list list-none m-0 p-0 flex flex-row items-center gap-4 flex-wrap"
                  role="list"
                >
                  {socialItems.map((s, i) => (
                    <li key={s.label + i} className="sm-socials-item">
                      <a
                        href={s.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="sm-socials-link text-[0.9rem] font-medium text-[#111] no-underline relative inline-block py-[2px] transition-[color,opacity] duration-300 ease-linear"
                      >
                        {s.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </aside>
      </div>

      <style>{`
.sm-scope .staggered-menu-wrapper { position: relative; width: 100%; height: 100%; z-index: 40; pointer-events: none; }
.sm-scope .staggered-menu-header {  position: absolute; top: 20px;  left: 0px; width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 1.3em 3em; background: transparent; pointer-events: none; z-index: 20; }
.sm-scope .staggered-menu-header > * { pointer-events: auto; }
.sm-scope .sm-logo { display: flex; align-items: center; user-select: none; }
.sm-scope .sm-logo-img { display: block; height: 32px; width: auto; object-fit: contain; }
.sm-scope .sm-toggle { position: relative; display: inline-flex; align-items: center; gap: 0.3rem; background: transparent; border: none; cursor: pointer; color: #e9e9ef; font-weight: 500; line-height: 1; overflow: visible; }
.sm-scope .sm-toggle:focus-visible { outline: 2px solid #ffffffaa; outline-offset: 4px; border-radius: 4px; }
.sm-scope .sm-line:last-of-type { margin-top: 6px; }
.sm-scope .sm-toggle-textWrap { position: relative; margin-right: 0.5em; display: inline-block; height: 20px; overflow: hidden; white-space: nowrap; width: var(--sm-toggle-width, auto); min-width: var(--sm-toggle-width, auto); }
.sm-scope .sm-toggle-textInner { display: flex; flex-direction: column; line-height: 1; }
.sm-scope .sm-toggle-line { display: flex; align-items: center; height: 20px; line-height: 1; }
.sm-scope .sm-icon { position: relative; width: 20px; height: 20px; flex: 0 0 20px; display: inline-flex; align-items: center; justify-content: center; will-change: transform; }
.sm-scope .sm-panel-itemWrap { position: relative; overflow: hidden; line-height: 1; }
.sm-scope .sm-icon-line { position: absolute; left: 50%; top: 50%; width: 100%; height: 2.5px; border-radius: 2px; will-change: transform; }
.sm-scope .sm-line { display: none !important; }
.sm-scope .staggered-menu-panel { position: absolute; top: 0; right: 0; width: clamp(260px, 38vw, 420px); height: 100%; background: white; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); display: flex; flex-direction: column; padding: 6em 2em 2em 2em; overflow-y: auto; z-index: 10; }
.sm-scope [data-position='left'] .staggered-menu-panel { right: auto; left: 0; }
.sm-scope .sm-prelayers { position: absolute; top: 0; right: 0; bottom: 0; width: clamp(260px, 38vw, 420px); pointer-events: none; z-index: 5; }
.sm-scope [data-position='left'] .sm-prelayers { right: auto; left: 0; }
.sm-scope .sm-prelayer { position: absolute; top: 0; right: 0; height: 100%; width: 100%; transform: translateX(0); }
.sm-scope .sm-panel-inner { flex: 1; display: flex; flex-direction: column; gap: 0.75rem; }
.sm-scope .sm-socials { margin-top: auto; padding-top: 2rem; display: flex; flex-direction: column; gap: 0.75rem; }
.sm-scope .sm-socials-title { margin: 0; font-size: 1rem; font-weight: 500; color: var(--sm-accent, #ff0000); }
.sm-scope .sm-socials-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: row; align-items: center; gap: 1rem; flex-wrap: wrap; }
.sm-scope .sm-socials-list .sm-socials-link { opacity: 1; transition: opacity 0.3s ease; }
.sm-scope .sm-socials-list:hover .sm-socials-link:not(:hover) { opacity: 0.35; }
.sm-scope .sm-socials-list:focus-within .sm-socials-link:not(:focus-visible) { opacity: 0.35; }
.sm-scope .sm-socials-list .sm-socials-link:hover,
.sm-scope .sm-socials-list .sm-socials-link:focus-visible { opacity: 1; }
.sm-scope .sm-socials-link:focus-visible { outline: 2px solid var(--sm-accent, #ff0000); outline-offset: 3px; }
.sm-scope .sm-socials-link { font-size: 0.9rem; font-weight: 500; color: #111; text-decoration: none; position: relative; padding: 2px 0; display: inline-block; transition: color 0.3s ease, opacity 0.3s ease; }
.sm-scope .sm-socials-link:hover { color: var(--sm-accent, #ff0000); }
.sm-scope .sm-panel-title { margin: 0; font-size: 1rem; font-weight: 600; color: #fff; text-transform: uppercase; }
.sm-scope .sm-panel-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.25rem; }
.sm-scope .sm-panel-item { position: relative; color: black; font-weight: 600; font-size: 2rem; cursor: pointer; line-height: 1.25; letter-spacing: -0.5px; text-transform: uppercase; transition: color 0.3s ease-in-out; display: inline-block; text-decoration: none; padding-right: 1.4em; width: 100%; }
@media (min-width: 640px) {
  .sm-scope .sm-panel-item { font-size: 2.25rem; }
}
.sm-scope .sm-panel-itemLabel { display: inline-block; will-change: transform; transform-origin: 50% 100%; position: relative; z-index: 1; transition: color 0.3s ease-in-out; padding: 0.125rem 0.5rem; }
.sm-scope .sm-panel-item:hover .sm-panel-itemLabel { color: var(--foreground) !important; }
.sm-scope .sm-panel-item:hover .sm-panel-itemLabel > span { color: var(--foreground) !important; }
.sm-scope .sm-panel-item:not(:hover) .sm-panel-itemLabel { color: var(--primary) !important; transition-delay: 0s; }
.sm-scope .sm-panel-item:not(:hover) .sm-panel-itemLabel > span { color: var(--primary) !important; transition-delay: 0s; }
.sm-scope .sm-panel-list[data-numbering] { counter-reset: smItem; }
.sm-scope .sm-panel-list[data-numbering] .sm-panel-item::after { counter-increment: smItem; content: counter(smItem, decimal-leading-zero); position: absolute; top: 0.1em; right: 3.2em; font-size: 18px; font-weight: 400; color: var(--sm-accent, #ff0000); letter-spacing: 0; pointer-events: none; user-select: none; opacity: var(--sm-num-opacity, 0); }
@media (max-width: 1024px) { .sm-scope .staggered-menu-panel { width: 100%; left: 0; right: 0; } .sm-scope .staggered-menu-wrapper[data-open] .sm-logo-img { filter: invert(100%); } }
@media (max-width: 640px) { .sm-scope .staggered-menu-panel { width: 100%; left: 0; right: 0; } .sm-scope .staggered-menu-wrapper[data-open] .sm-logo-img { filter: invert(100%); } }
      `}</style>
    </div>
  );
};

export default StaggeredMenu;
