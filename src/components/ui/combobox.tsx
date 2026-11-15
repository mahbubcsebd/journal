"use client";

import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "./command";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

// shadcn/ui Combobox pattern: Popover + Command. Replaces every <select> in
// the app. Works controlled (value/onValueChange) or inside a plain <form>
// (name + defaultValue → a hidden input carries the value).

export type ComboboxOption = {
  value: string;
  label: string;
  /** Second line / muted text shown in the list. */
  hint?: string;
  /** Leading visual (icon, colour dot). Shown in the list and the trigger. */
  icon?: React.ReactNode;
  /** Extra words the search should match. */
  keywords?: string[];
  disabled?: boolean;
};

export type ComboboxGroup = { heading?: string; options: ComboboxOption[] };

export type ComboboxAction = { label: string; icon?: React.ReactNode; onSelect: () => void };

type Props = {
  options?: ComboboxOption[];
  groups?: ComboboxGroup[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  id?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  /** Show the search box. Defaults to on when there are more than 7 options. */
  searchable?: boolean;
  /** Extra commands under the options, e.g. "New setup…". */
  actions?: ComboboxAction[];
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
  align?: "start" | "center" | "end";
  "aria-label"?: string;
  "aria-invalid"?: boolean;
};

const EMPTY = "__empty__"; // cmdk needs a non-empty item value

export function Combobox({
  options,
  groups,
  value: controlled,
  defaultValue = "",
  onValueChange,
  name,
  id,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No results.",
  searchable,
  actions,
  disabled,
  className,
  contentClassName,
  align = "start",
  ...aria
}: Props) {
  const [open, setOpen] = React.useState(false);
  const contentId = React.useId();
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue);
  const value = controlled ?? uncontrolled;

  const all = React.useMemo<ComboboxGroup[]>(() => groups ?? [{ options: options ?? [] }], [groups, options]);
  const flat = React.useMemo(() => all.flatMap((g) => g.options), [all]);
  const selected = flat.find((o) => o.value === value);
  const showSearch = searchable ?? flat.length > 7;

  const choose = (next: string) => {
    if (controlled === undefined) setUncontrolled(next);
    onValueChange?.(next);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? contentId : undefined}
          aria-haspopup="listbox"
          disabled={disabled}
          data-slot="combobox-trigger"
          className={cn(
            "flex h-10 w-full min-w-0 items-center gap-2 rounded-lg border border-input bg-card px-3 text-left text-sm shadow-xs transition-[border-color,box-shadow] outline-none",
            "hover:bg-accent/40 focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/15 focus-visible:outline-none disabled:opacity-50",
            "aria-invalid:border-loss aria-invalid:ring-loss/15 data-[state=open]:border-ring",
            className,
          )}
          {...aria}
        >
          {selected?.icon}
          <span className={cn("flex-1 truncate", !selected && "text-muted-foreground/70")}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      {name && <input type="hidden" name={name} value={value} />}
      <PopoverContent
        id={contentId}
        align={align}
        className={cn("w-(--radix-popover-trigger-width) min-w-52 p-0", contentClassName)}
      >
        <Command loop>
          {showSearch && <CommandInput placeholder={searchPlaceholder} />}
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            {all.map((g, gi) => (
              <CommandGroup key={g.heading ?? gi} heading={g.heading}>
                {g.options.map((o) => (
                  <CommandItem
                    key={o.value || EMPTY}
                    value={o.value || EMPTY}
                    keywords={[o.label, ...(o.hint ? [o.hint] : []), ...(o.keywords ?? [])]}
                    disabled={o.disabled}
                    onSelect={() => choose(o.value)}
                  >
                    {o.icon}
                    <span className="grid min-w-0 flex-1">
                      <span className="truncate">{o.label}</span>
                      {o.hint && <span className="truncate text-[11px] text-muted-foreground">{o.hint}</span>}
                    </span>
                    <CheckIcon className={cn("ml-auto !text-foreground", o.value === value ? "opacity-100" : "opacity-0")} />
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
            {actions && actions.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  {actions.map((a) => (
                    <CommandItem
                      key={a.label}
                      value={`__action__${a.label}`}
                      keywords={[a.label]}
                      onSelect={() => {
                        setOpen(false);
                        a.onSelect();
                      }}
                    >
                      {a.icon}
                      {a.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
