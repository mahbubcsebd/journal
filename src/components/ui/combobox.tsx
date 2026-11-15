"use client";

import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "./command";
import { ResponsivePopover } from "./responsive-popover";

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
  /**
   * Let the user use what they typed when it isn't in the list (symbols,
   * servers, folders). `format` normalises it, e.g. upper-casing a symbol.
   */
  allowCustom?: boolean;
  format?: (typed: string) => string;
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
  allowCustom,
  format = (s) => s.trim(),
  ...aria
}: Props) {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const contentId = React.useId();
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue);
  const value = controlled ?? uncontrolled;

  const all = React.useMemo<ComboboxGroup[]>(() => groups ?? [{ options: options ?? [] }], [groups, options]);
  const flat = React.useMemo(() => all.flatMap((g) => g.options), [all]);
  const known = flat.find((o) => o.value === value);
  // A typed-in value that isn't one of the options still shows as selected.
  const selected = known ?? (allowCustom && value ? { value, label: value } : undefined);
  const showSearch = allowCustom || (searchable ?? flat.length > 7);
  const custom = allowCustom ? format(query) : "";
  const offerCustom = Boolean(custom) && !flat.some((o) => o.value.toLowerCase() === custom.toLowerCase());

  // Bottom-sheet heading on phones: the field's <label>, else aria-label/placeholder.
  const [title, setTitle] = React.useState<string | null>(null);
  const toggle = (o: boolean) => {
    if (o && id) setTitle(document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent?.trim() || null);
    if (!o) setQuery("");
    setOpen(o);
  };

  const choose = (next: string) => {
    if (controlled === undefined) setUncontrolled(next);
    onValueChange?.(next);
    setQuery("");
    setOpen(false);
  };

  return (
    <>
      <ResponsivePopover
        open={open}
        onOpenChange={toggle}
        id={contentId}
        align={align}
        title={title ?? aria["aria-label"] ?? placeholder}
        className={cn("w-(--radix-popover-trigger-width) min-w-52", contentClassName)}
        trigger={
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
        }
      >
        <Command loop>
          {showSearch && <CommandInput placeholder={searchPlaceholder} value={query} onValueChange={setQuery} />}
          <CommandList>
            {!offerCustom && <CommandEmpty>{emptyText}</CommandEmpty>}
            {offerCustom && (
              <CommandGroup forceMount>
                <CommandItem value={`__custom__${custom}`} keywords={[query]} forceMount onSelect={() => choose(custom)}>
                  <span className="text-muted-foreground">Use</span>
                  <span className="font-medium">“{custom}”</span>
                </CommandItem>
              </CommandGroup>
            )}
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
      </ResponsivePopover>
      {name && <input type="hidden" name={name} value={value} />}
    </>
  );
}
