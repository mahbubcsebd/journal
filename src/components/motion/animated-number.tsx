"use client";

import { animate, useMotionValue, useMotionValueEvent, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

/** Counts up to `value` on mount/changes, formatting every frame. */
export function AnimatedNumber({ value, format }: { value: number; format: (n: number) => string }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(reduce ? value : 0);
  const [text, setText] = useState(format(reduce ? value : 0));
  useMotionValueEvent(mv, "change", (v) => setText(format(v)));
  useEffect(() => {
    const controls = animate(mv, value, { duration: reduce ? 0 : 0.9, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [mv, value, reduce]);
  return <>{text}</>;
}
