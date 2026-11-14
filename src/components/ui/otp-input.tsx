"use client";

import { motion } from "motion/react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type Props = {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
};

export function OtpInput({ length = 6, value, onChange, onComplete, disabled, invalid }: Props) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const chars = Array.from({ length }, (_, i) => value[i] ?? "");

  const setAt = (index: number, digit: string) => {
    // Digits are always filled left-to-right, so `value` never has gaps.
    const joined = (value.slice(0, index) + digit + value.slice(index + 1)).slice(0, length);
    onChange(joined);
    if (joined.length === length) onComplete?.(joined);
  };

  const focus = (i: number) => refs.current[Math.max(0, Math.min(length - 1, i))]?.focus();

  // After a failed attempt the inputs are re-enabled and cleared: put the caret back.
  useEffect(() => {
    if (!disabled && value === "") refs.current[0]?.focus();
  }, [disabled, value]);

  return (
    <motion.div
      className="flex gap-2 sm:gap-2.5"
      animate={invalid ? { x: [0, -8, 8, -6, 6, -2, 0] } : { x: 0 }}
      transition={{ duration: 0.4 }}
    >
      {chars.map((c, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${i + 1}`}
          maxLength={1}
          disabled={disabled}
          value={c}
          autoFocus={i === 0}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "");
            if (!digits) return;
            if (digits.length > 1) {
              // Autofill / paste into a single box
              const joined = (chars.slice(0, i).join("") + digits).slice(0, length);
              onChange(joined);
              focus(joined.length);
              if (joined.length === length) onComplete?.(joined);
              return;
            }
            // Keep entry sequential so `value` never has gaps.
            const at = Math.min(i, value.length);
            setAt(at, digits);
            focus(at + 1);
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace") {
              e.preventDefault();
              if (chars[i]) {
                onChange(chars.slice(0, i).join(""));
              } else {
                onChange(chars.slice(0, Math.max(0, i - 1)).join(""));
                focus(i - 1);
              }
            } else if (e.key === "ArrowLeft") focus(i - 1);
            else if (e.key === "ArrowRight") focus(i + 1);
          }}
          onPaste={(e) => {
            e.preventDefault();
            const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
            if (!digits) return;
            onChange(digits);
            focus(digits.length);
            if (digits.length === length) onComplete?.(digits);
          }}
          className={cn(
            "size-11 rounded-xl border border-input bg-card text-center font-mono text-lg font-semibold tabular outline-none transition-[border-color,box-shadow] sm:size-12",
            "focus:border-ring focus:ring-4 focus:ring-ring/15",
            c && "border-foreground/25",
            invalid && "border-loss focus:border-loss focus:ring-loss/15",
          )}
        />
      ))}
    </motion.div>
  );
}
