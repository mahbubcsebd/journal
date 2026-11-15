"use client";

import * as React from "react";
import { Button } from "./button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog";
import { Input } from "./input";

// App-wide confirm / prompt built on the shadcn Dialog, replacing the
// browser's window.confirm() and window.prompt().
//
//   const confirm = useConfirm();
//   if (!(await confirm({ title: "Delete this goal?", destructive: true }))) return;

type ConfirmOptions = {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type PromptOptions = {
  title: string;
  description?: React.ReactNode;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  inputType?: React.HTMLInputTypeAttribute;
};

type Request =
  | ({ kind: "confirm"; resolve: (ok: boolean) => void } & ConfirmOptions)
  | ({ kind: "prompt"; resolve: (value: string | null) => void } & PromptOptions);

type Ctx = {
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  prompt: (o: PromptOptions) => Promise<string | null>;
};

const DialogsContext = React.createContext<Ctx | null>(null);

export function DialogsProvider({ children }: { children: React.ReactNode }) {
  const [req, setReq] = React.useState<Request | null>(null);
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  const settled = React.useRef(true);

  const ctx = React.useMemo<Ctx>(
    () => ({
      confirm: (o) =>
        new Promise<boolean>((resolve) => {
          settled.current = false;
          setReq({ kind: "confirm", resolve, ...o });
          setOpen(true);
        }),
      prompt: (o) =>
        new Promise<string | null>((resolve) => {
          settled.current = false;
          setText(o.defaultValue ?? "");
          setReq({ kind: "prompt", resolve, ...o });
          setOpen(true);
        }),
    }),
    [],
  );

  // Settle exactly once; `req` stays so the close animation keeps its content.
  const settle = (answer: boolean) => {
    if (!req || settled.current) return;
    settled.current = true;
    if (req.kind === "confirm") req.resolve(answer);
    else req.resolve(answer ? text.trim() : null);
    setOpen(false);
  };

  return (
    <DialogsContext.Provider value={ctx}>
      {children}
      <Dialog open={open} onOpenChange={(o) => !o && settle(false)}>
        {req && (
          <DialogContent className="max-w-md" showCloseButton={false}>
            <form
              className="grid gap-5"
              onSubmit={(e) => {
                e.preventDefault();
                settle(true);
              }}
            >
              <DialogHeader>
                <DialogTitle>{req.title}</DialogTitle>
                {req.description ? (
                  <DialogDescription>{req.description}</DialogDescription>
                ) : (
                  <DialogDescription className="sr-only">{req.title}</DialogDescription>
                )}
              </DialogHeader>
              {req.kind === "prompt" && (
                <Input
                  autoFocus
                  aria-label={req.label ?? req.title}
                  type={req.inputType ?? "text"}
                  placeholder={req.placeholder}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => settle(false)}>
                  {(req.kind === "confirm" && req.cancelLabel) || "Cancel"}
                </Button>
                <Button
                  type="submit"
                  autoFocus={req.kind === "confirm"}
                  variant={req.kind === "confirm" && req.destructive ? "destructive" : "default"}
                  disabled={req.kind === "prompt" && !text.trim()}
                >
                  {req.confirmLabel ?? (req.kind === "confirm" && req.destructive ? "Delete" : "OK")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </DialogsContext.Provider>
  );
}

function useDialogs() {
  const ctx = React.useContext(DialogsContext);
  if (!ctx) throw new Error("useConfirm/usePrompt must be used inside <DialogsProvider>");
  return ctx;
}

export const useConfirm = () => useDialogs().confirm;
export const usePrompt = () => useDialogs().prompt;
