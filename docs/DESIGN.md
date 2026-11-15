# Design
Source of truth: src/app/globals.css (CSS vars + `@theme inline`). Light + `.dark` class (next-themes).

## Tokens
- Colors (oklch): background, foreground, card, popover, muted(-foreground), border, input, ring, primary, secondary, accent, sidebar.
- Brand: `brand` (green, hue ~162), `brand-ink` (text-safe), `brand-soft` (tint).
- P&L semantics: `profit`/`profit-soft` (teal-green), `loss`/`loss-soft` (coral), `chart-up`/`chart-down`, `warning`/`warning-ink`. Lightness-separated for colour-blind safety. Never use raw red/green.
- Fonts: Geist sans, Geist Mono (numbers), Noto Sans Bengali fallback.
- Radius: `--radius` 0.75rem → rounded-sm/md/lg/xl.
- Shadows: `shadow-soft`, `shadow-pop`.
- Utilities: `tabular` (tabular-nums), `bg-grid`.

## Layout
App shell in src/app/(app)/layout.tsx: sidebar (components/layout/sidebar.tsx, nav-config.ts) + topbar + page-header.tsx per page. Command menu (cmdk).

## Components
src/components/ui (shadcn/ui pattern, Radix + cmdk): button, card, badge, input, dialog, sheet, popover, command, combobox, confirm-dialog, dropdown-menu, skeleton, otp-input, list-editor. Feature components in charts/, dashboard/, calendar/, etc. Motion helpers in components/motion.

## Patterns
- Buttons/badges via cva variants; merge classes with `cn` (clsx + tailwind-merge).
- Money/stat numbers: mono + `tabular`, colored by profit/loss tokens.
- Empty states: components/layout/coming-soon.tsx style; loading: Skeleton.
- Focus ring: global `:focus-visible` outline using `--ring`.
- Dark mode: always define both token sets; test both.

- Every select is the shadcn `Combobox` (components/ui/combobox.tsx); in a plain form pass `name` + `defaultValue`. Never use a native `<select>` or `<datalist>` (phones show datalists above the keyboard); for free text with suggestions use `Combobox allowCustom`.
- Pickers open through `ResponsivePopover`: a popover on desktop, a bottom sheet on phones that doesn't focus the search box (no keyboard until tapped).
- Mobile: app shell has a bottom tab bar (components/layout/bottom-nav.tsx); pad for `env(safe-area-inset-*)`; inputs are 16px on phones so iOS doesn't zoom.
- Every popup is the shadcn `Dialog` (side drawers use `Sheet`, which is the same Radix Dialog). Confirmations use `useConfirm()` / `usePrompt()` from confirm-dialog.tsx, never `window.confirm()` / `window.prompt()`.

## Don'ts
- No hardcoded hex/hsl colors in components; use tokens.
- No color-only meaning for profit/loss (add sign/icon).
- No generic uniform card grids; vary hierarchy and scale.
