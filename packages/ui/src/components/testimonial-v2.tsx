"use client";

import { motion, useAnimationControls } from "framer-motion";
import React, { useEffect, useState } from "react";

// --- Types ---
export interface TestimonialInput {
  id?: string;
  name: string;
  quote: string;
  service?: string;
  photo?: string;
}

interface InternalTestimonial {
  text: string;
  image: string;
  name: string;
  role: string;
}

interface TestimonialV2Props {
  testimonials: TestimonialInput[];
  className?: string;
  columns?: number;
  durations?: number[];
}

// --- Sub-Components ---
const TestimonialsColumn = (props: {
  className?: string;
  testimonials: InternalTestimonial[];
  duration?: number;
  isPaused: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}) => {
  const controls = useAnimationControls();
  const isInitializedRef = React.useRef(false);
  const durationRef = React.useRef(props.duration || 30);

  // Update duration ref when it changes
  useEffect(() => {
    durationRef.current = props.duration || 30;
  }, [props.duration]);

  // Initialize animation once
  useEffect(() => {
    if (!isInitializedRef.current) {
      controls.set({ translateY: "0%" });
      controls.start({
        translateY: "-50%",
        transition: {
          duration: durationRef.current,
          repeat: Infinity,
          ease: "linear",
          repeatType: "loop",
        },
      });
      isInitializedRef.current = true;
    }
  }, [controls]);

  // Handle pause/resume
  useEffect(() => {
    if (props.isPaused) {
      controls.stop();
    } else if (isInitializedRef.current) {
      // Resume with same duration to maintain speed
      controls.start({
        translateY: "-50%",
        transition: {
          duration: durationRef.current,
          repeat: Infinity,
          ease: "linear",
          repeatType: "loop",
        },
      });
    }
  }, [props.isPaused, controls]);

  return (
    <div className={props.className}>
      <motion.ul
        animate={controls}
        className="flex flex-col gap-5 md:gap-7 pb-6 bg-transparent transition-colors duration-300 list-none m-0 p-0"
      >
        {[
          ...new Array(2).fill(0).map((_, index) => (
            <React.Fragment key={index}>
              {props.testimonials.map(({ text, image, name, role }, i) => (
                <motion.li
                  key={`${index}-${i}`}
                  aria-hidden={index === 1 ? "true" : "false"}
                  tabIndex={index === 1 ? -1 : 0}
                  onMouseEnter={props.onHoverStart}
                  onMouseLeave={props.onHoverEnd}
                  whileHover={{
                    y: -12,
                    transition: {
                      type: "spring",
                      stiffness: 300,
                      damping: 30,
                    },
                  }}
                  whileFocus={{
                    y: -12,
                    transition: {
                      type: "spring",
                      stiffness: 300,
                      damping: 30,
                    },
                  }}
                  initial={false}
                  className="relative p-6 md:p-8 rounded-3xl bg-gradient-to-br from-white to-neutral-50/50 dark:from-neutral-900 dark:to-neutral-950/50 w-full md:max-w-xs transition-all duration-700 cursor-default select-none group focus:outline-none focus:ring-2 focus:ring-primary/40 overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.12)] border border-neutral-200 dark:border-neutral-800 hover:border-primary/30 dark:hover:border-primary/40"
                >
                  {/* Animated background gradient */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-br from-primary/8 via-primary/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
                    initial={false}
                  />

                  {/* Decorative corner accent */}
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-primary/10 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                  {/* Quote icon decoration */}
                  <div className="absolute top-6 right-6 opacity-5 group-hover:opacity-10 transition-opacity duration-500">
                    <svg
                      width="48"
                      height="48"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="text-primary"
                    >
                      <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.996 2.151c-2.433.917-3.995 3.638-3.995 5.849h4v10h-9.984zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.995 3.638-3.995 5.849h3.983v10h-9.984z" />
                    </svg>
                  </div>

                  <blockquote className="m-0 p-0 relative z-10">
                    {/* Quote text with better typography */}
                    <div className="relative mb-5">
                      <p className="text-neutral-800 dark:text-neutral-100 leading-[1.4] font-normal text-sm md:text-sm m-0 transition-colors duration-300 relative z-10">
                        {text}
                      </p>
                      {/* Decorative quote mark */}
                      <span className="absolute -top-2 -left-2 text-6xl font-serif text-primary/10 dark:text-primary/5 leading-none select-none">
                        &ldquo;
                      </span>
                    </div>

                    {/* Author section with modern layout */}
                    <footer className="flex items-center gap-3 pt-4 border-t border-neutral-200/60 dark:border-neutral-800/60">
                      <motion.div
                        whileHover={{ scale: 1.08, rotate: 2 }}
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 20,
                        }}
                        className="relative flex-shrink-0"
                      >
                        {/* Avatar with modern styling */}
                        <div className="relative">
                          <img
                            width={56}
                            height={56}
                            src={image}
                            alt={`Avatar of ${name}`}
                            className="h-12 w-12 md:h-14 md:w-14 rounded-full object-cover flex-shrink-0 ring-2 ring-white/50 dark:ring-neutral-800/50 group-hover:ring-primary/20 dark:group-hover:ring-primary/30 transition-all duration-500 shadow-md group-hover:shadow-lg"
                          />
                        </div>
                        {/* Glow effect on hover */}
                        <motion.div
                          className="absolute inset-0 rounded-full bg-primary/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10"
                          initial={false}
                        />
                      </motion.div>

                      <div className="flex flex-col min-w-0 flex-1">
                        <cite className="font-normal not-italic text-base md:text-sm leading-tight text-neutral-900 dark:text-white transition-colors duration-300 truncate group-hover:text-primary dark:group-hover:text-primary/90">
                          {name}
                        </cite>
                        <span className="text-sm md:text-xs leading-tight text-neutral-500 dark:text-neutral-400 mt-1 transition-colors duration-300 truncate font-normal">
                          {role}
                        </span>
                      </div>
                    </footer>
                  </blockquote>

                  {/* Bottom accent line */}
                  <motion.div
                    className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    initial={false}
                  />
                </motion.li>
              ))}
            </React.Fragment>
          )),
        ]}
      </motion.ul>
    </div>
  );
};

export function TestimonialV2({
  testimonials,
  className = "",
  columns = 5,
  durations,
}: TestimonialV2Props) {
  const [isPaused, setIsPaused] = useState(false);

  // Map testimonials to internal format
  // Generate deterministic image number from name/id to avoid hydration mismatches
  const getImageNumber = (id: string | undefined, name: string): number => {
    if (id) {
      // Use id if available, convert to number
      const numId = parseInt(id, 10);
      if (!isNaN(numId)) return numId % 70;
    }
    // Generate deterministic number from name hash
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % 70;
  };

  const mappedTestimonials: InternalTestimonial[] = testimonials.map((t) => ({
    text: t.quote,
    image:
      t.photo ||
      `https://i.pravatar.cc/150?img=${getImageNumber(t.id, t.name)}`,
    name: t.name,
    role: t.service || "Client",
  }));

  // Split into columns dynamically
  const itemsPerColumn = Math.ceil(mappedTestimonials.length / columns);
  const columnData: InternalTestimonial[][] = [];

  for (let i = 0; i < columns; i++) {
    columnData.push(
      mappedTestimonials.slice(i * itemsPerColumn, (i + 1) * itemsPerColumn)
    );
  }

  // Default durations if not provided
  const defaultDurations = [30, 38, 34, 36, 32, 40, 28, 35];
  const columnDurations = durations || defaultDurations.slice(0, columns);

  // Responsive breakpoints for columns
  const getResponsiveClass = (index: number) => {
    if (index === 0) return ""; // First column always visible
    if (index === 1) return "hidden md:block";
    if (index === 2) return "hidden lg:block";
    if (index === 3) return "hidden xl:block";
    if (index === 4) return "hidden 2xl:block";
    // For more than 5 columns, use 2xl for all additional ones
    return "hidden 2xl:block";
  };

  const handleHoverStart = () => setIsPaused(true);
  const handleHoverEnd = () => setIsPaused(false);

  return (
    <section
      className={`bg-transparent py-24 relative overflow-hidden ${className}`}
    >
      <div className="container px-4 z-10 mx-auto">
        <div
          className="flex justify-center gap-4 md:gap-6 px-0 md:px-10 [mask-image:linear-gradient(to_bottom,transparent,black_10%,black_90%,transparent)] max-h-[740px]"
          role="region"
          aria-label="Scrolling Testimonials"
        >
          {columnData.map((column, index) => {
            if (column.length === 0) return null;
            return (
              <TestimonialsColumn
                key={index}
                testimonials={column}
                className={getResponsiveClass(index)}
                duration={columnDurations[index] || 30}
                isPaused={isPaused}
                onHoverStart={handleHoverStart}
                onHoverEnd={handleHoverEnd}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
