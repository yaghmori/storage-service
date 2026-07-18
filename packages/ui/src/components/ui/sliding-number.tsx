"use client";

import {
  motion,
  MotionValue,
  useInView,
  useSpring,
  useTransform,
} from "framer-motion";
import { useEffect, useRef, useState } from "react";

function Digit({
  place,
  value,
  digitHeight,
  duration,
  measureRef,
}: {
  place: number;
  value: number;
  digitHeight: number;
  duration: number;
  measureRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const valueRoundedToPlace = Math.floor(value / place);
  const animatedValue = useSpring(valueRoundedToPlace, {
    duration: duration * 1000, // Convert to milliseconds
  });

  useEffect(() => {
    animatedValue.set(valueRoundedToPlace);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueRoundedToPlace]); // animatedValue is stable from useSpring and doesn't need to be in deps

  return (
    <div
      style={{ height: digitHeight }}
      className="relative w-[1ch] overflow-hidden tabular-nums"
      ref={place === 1 ? measureRef : undefined}
    >
      {Array.from({ length: 10 }, (_, i) => (
        <Number
          key={i}
          mv={animatedValue}
          number={i}
          digitHeight={digitHeight}
        />
      ))}
    </div>
  );
}

function Number({
  mv,
  number,
  digitHeight,
}: {
  mv: MotionValue<number>;
  number: number;
  digitHeight: number;
}) {
  const y = useTransform(mv, (latest: number) => {
    const placeValue = latest % 10;
    const offset = (10 + number - placeValue) % 10;

    let memo = offset * digitHeight;

    if (offset > 5) {
      memo -= 10 * digitHeight;
    }

    return memo;
  });

  return (
    <motion.span
      style={{ y }}
      className="absolute inset-0 flex items-center justify-center"
    >
      {number}
    </motion.span>
  );
}

interface SlidingNumberProps {
  from: number;
  to: number;
  duration?: number;
  delay?: number;
  startOnView?: boolean;
  once?: boolean;
  className?: string;
  onComplete?: () => void;
  digitHeight?: number;
}

export function SlidingNumber({
  from,
  to,
  duration = 2,
  delay = 0,
  startOnView = true,
  once = false,
  className = "",
  onComplete,
  digitHeight: providedDigitHeight,
}: SlidingNumberProps) {
  const ref = useRef(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const hasStartedAnimationRef = useRef(false);
  const isInView = useInView(ref, { once: false }); // Always use false, manage once manually
  const [currentValue, setCurrentValue] = useState(from);
  const [animationKey, setAnimationKey] = useState(0);
  const [digitHeight, setDigitHeight] = useState(providedDigitHeight || 40);

  // Measure actual digit height from rendered element
  useEffect(() => {
    // If digitHeight is provided, use it directly
    if (providedDigitHeight) {
      setDigitHeight(providedDigitHeight);
      return;
    }

    const measureHeight = () => {
      if (!measureRef.current) return;
      
      // Find the first Number span inside the container to measure
      const numberSpan = measureRef.current.querySelector('span');
      if (numberSpan) {
        // Temporarily make the span non-absolute to measure its natural height
        const originalPosition = (numberSpan as HTMLElement).style.position;
        const originalTop = (numberSpan as HTMLElement).style.top;
        const originalHeight = measureRef.current.style.height;
        
        (numberSpan as HTMLElement).style.position = 'static';
        measureRef.current.style.height = 'auto';
        measureRef.current.style.overflow = 'visible';
        
        // Force a reflow to ensure styles are applied
        void measureRef.current.offsetHeight;
        
        // Get the actual rendered height of the number
        const rect = numberSpan.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(numberSpan);
        
        // Use the actual height, or fallback to line-height calculation
        let measuredHeight = rect.height;
        
        // If height is 0 (element not yet rendered), calculate from font-size
        if (measuredHeight === 0 || measuredHeight < 1) {
          const fontSize = parseFloat(computedStyle.fontSize);
          const lineHeight = computedStyle.lineHeight;
          
          if (lineHeight && lineHeight !== "normal") {
            const lineHeightValue = parseFloat(lineHeight);
            if (!isNaN(lineHeightValue)) {
              measuredHeight = lineHeight.includes("px") || lineHeight.includes("em") || lineHeight.includes("rem")
                ? lineHeightValue
                : fontSize * lineHeightValue;
            } else {
              measuredHeight = fontSize * 1.2;
            }
          } else {
            measuredHeight = fontSize * 1.2;
          }
        }
        
        // Add a small buffer (10%) to prevent clipping during animation
        const heightWithBuffer = Math.ceil(measuredHeight * 1.1);
        
        // Restore original styles
        (numberSpan as HTMLElement).style.position = originalPosition;
        (numberSpan as HTMLElement).style.top = originalTop;
        measureRef.current.style.height = originalHeight;
        measureRef.current.style.overflow = '';
        
        if (heightWithBuffer > 0) {
          setDigitHeight((prev) => {
            // Only update if significantly different to avoid unnecessary re-renders
            return Math.abs(prev - heightWithBuffer) > 1 ? heightWithBuffer : prev;
          });
        }
      }
    };

    // Use ResizeObserver for more accurate measurements
    let resizeObserver: ResizeObserver | null = null;
    
    // Measure after a short delay to ensure DOM is rendered
    const timeoutId = setTimeout(measureHeight, 10);
    
    // Also use ResizeObserver for dynamic font size changes
    if (typeof ResizeObserver !== 'undefined' && measureRef.current) {
      resizeObserver = new ResizeObserver(() => {
        measureHeight();
      });
      resizeObserver.observe(measureRef.current);
    }
    
    // Also measure on window resize
    window.addEventListener("resize", measureHeight);
    
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", measureHeight);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [providedDigitHeight]);

  // Reset animation state on component mount (route changes)
  useEffect(() => {
    setCurrentValue(from);
    hasStartedAnimationRef.current = false;
    setAnimationKey((prev) => prev + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - runs on every mount

  // Reset animation state when from/to values change
  useEffect(() => {
    setCurrentValue(from);
    hasStartedAnimationRef.current = false;
    setAnimationKey((prev) => prev + 1);
  }, [from, to]);

  // Animation effect - handles both startOnView and immediate start cases
  useEffect(() => {
    // Calculate shouldStart based on current state
    const shouldStart =
      !startOnView || (isInView && (!once || !hasStartedAnimationRef.current));

    if (!shouldStart) return;

    // Prevent multiple animations from starting using ref (doesn't trigger re-renders)
    if (hasStartedAnimationRef.current && once) return;

    // Mark as started immediately to prevent re-triggering
    hasStartedAnimationRef.current = true;

    const timer = setTimeout(() => {
      const startTime = Date.now();
      // Use currentValue at the time of animation start, which should be 'from' after reset
      const startValue = currentValue;
      const difference = to - startValue;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / (duration * 1000), 1);
        const easeOutCubic = 1 - Math.pow(1 - progress, 3);
        const newValue = startValue + difference * easeOutCubic;

        setCurrentValue(newValue);

        if (progress < 1) {
          animationFrameRef.current = requestAnimationFrame(animate);
        } else {
          setCurrentValue(to);
          onComplete?.();
          animationFrameRef.current = null;
        }
      };

      animationFrameRef.current = requestAnimationFrame(animate);
    }, delay * 1000);

    return () => {
      clearTimeout(timer);
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInView, startOnView, once, to, duration, delay, onComplete]); // currentValue intentionally excluded to prevent infinite loop

  // Round the current value to avoid showing decimals during animation
  const roundedValue = Math.round(currentValue);
  const absValue = Math.abs(roundedValue);

  // Determine the maximum number of digits needed
  const maxDigits = Math.max(
    Math.abs(from).toString().length,
    Math.abs(to).toString().length
  );

  // Create array of place values (1, 10, 100, 1000, etc.)
  const places = Array.from({ length: maxDigits }, (_, i) =>
    Math.pow(10, maxDigits - i - 1)
  );

  return (
    <div ref={ref} className={`flex items-center ${className}`}>
      {roundedValue < 0 && "-"}
      {places.map((place) => (
        <Digit
          key={`${place}-${animationKey}`}
          place={place}
          value={absValue}
          digitHeight={digitHeight}
          duration={duration}
          measureRef={place === places[places.length - 1] ? measureRef : undefined}
        />
      ))}
    </div>
  );
}
