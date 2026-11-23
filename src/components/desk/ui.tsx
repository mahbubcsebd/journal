"use client";

import { useEffect } from "react";

export function Segmented<V extends string | number>({
  value,
  options,
  onChange,
  label,
  solid = false,
}: {
  value: V;
  options: { value: V; label: string }[];
  onChange(v: V): void;
  label: string;
  solid?: boolean;
}) {
  return (
    <div role="group" aria-label={label} className="flex rounded-md border border-line bg-hull p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={`rounded px-2.5 py-1 text-[13px] font-semibold transition-colors ${
            o.value === value ? (solid ? "bg-ink text-water" : "bg-deck text-ink") : "text-mute hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange(v: boolean): void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-1.5">
      <span>{label}</span>
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden
        className="relative h-6 w-10 shrink-0 rounded-full bg-line transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-ink after:transition-transform peer-checked:bg-jade peer-checked:after:translate-x-4 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-gold"
      />
    </label>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose(): void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-water/75 sm:place-items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="brief-scroll max-h-[90svh] w-full overflow-y-auto rounded-t-2xl border border-line bg-hull p-5 sm:max-w-[460px] sm:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-[18px] font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md px-2 py-1 text-mute hover:text-ink">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div>
      <dt className="text-[13px] text-mute">{label}</dt>
      <dd className={`text-[22px] font-semibold tabular-nums ${tone === "good" ? "text-jade" : tone === "bad" ? "text-coral" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

export const buttonClass = "rounded-md border border-line bg-deck px-3 py-1.5 text-[13px] font-semibold hover:border-mute disabled:opacity-50";
export const primaryClass = "rounded-md bg-ink px-4 py-2 font-semibold text-water hover:bg-white disabled:opacity-40";
export const inputClass = "w-full rounded-md border border-line bg-water px-2.5 py-1.5 tabular-nums";
