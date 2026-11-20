"use client";

import { Bell, BellOff, Download, Loader2, Send, Share, ShieldCheck, Smartphone } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { urlBase64ToUint8Array, useInstall } from "@/components/pwa/pwa";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Combobox } from "@/components/ui/combobox";
import {
  activateTelegramBot,
  disconnectTelegram,
  removePushSubscription,
  saveAlertPrefs,
  savePushSubscription,
  sendTestAlert,
  telegramLink,
} from "@/server/actions/alerts";
import { Toggle } from "./settings-form";

type Prefs = {
  notifyNews: boolean;
  notifyCooldown: boolean;
  notifyLimits: boolean;
  notifyReviews: boolean;
  notifyGuard: boolean;
  notifyNewsMinutes: number;
  guardAlerts: boolean;
  guardAutoClose: boolean;
  locale: "en" | "bn";
};

export function AlertsSettings({
  vapidKey,
  telegramReady,
  telegramConnected,
  devices,
  prefs: initial,
}: {
  vapidKey: string | null;
  telegramReady: boolean;
  telegramConnected: boolean;
  devices: number;
  prefs: Prefs;
}) {
  const [prefs, setPrefs] = useState(initial);
  const [pending, start] = useTransition();
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  // Read after mount: the server can't know it, and a mismatch breaks hydration.
  const [permission, setPermission] = useState<string>("default");
  const { state: install, install: doInstall } = useInstall();
  const confirm = useConfirm();

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window;
    (supported ? navigator.serviceWorker.ready.then((r) => r.pushManager.getSubscription()) : Promise.resolve(null)).then((s) => {
      setSubscribed(supported ? Boolean(s) : false);
      if (typeof Notification !== "undefined") setPermission(Notification.permission);
    });
  }, []);

  const save = (patch: Partial<Prefs>) => {
    setPrefs((p) => ({ ...p, ...patch }));
    start(async () => {
      await saveAlertPrefs(patch);
    });
  };

  async function enablePush() {
    if (!vapidKey) return toast.error("Push isn't set up on the server (VAPID keys).");
    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm !== "granted") return toast.error("Notifications are blocked. Allow them in the browser's site settings.");
    const reg = await navigator.serviceWorker.ready;
    const s = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) });
    const r = await savePushSubscription(JSON.parse(JSON.stringify(s)), navigator.userAgent);
    if (!r.ok) return toast.error(r.error);
    setSubscribed(true);
    toast.success("Notifications on for this device");
  }

  async function disablePush() {
    const reg = await navigator.serviceWorker.ready;
    const s = await reg.pushManager.getSubscription();
    if (s) {
      await removePushSubscription(s.endpoint);
      await s.unsubscribe();
    }
    setSubscribed(false);
  }

  const pushSupported = subscribed !== false || ("PushManager" in (typeof window === "undefined" ? {} : window));

  return (
    <Card id="alerts" className="scroll-mt-24">
      <CardHeader className="flex-col gap-1">
        <CardTitle>Alerts &amp; app</CardTitle>
        <CardDescription>News reminders, cooldowns, limits and MT5 guard alerts on your phone or Telegram.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        {/* Install */}
        <div className="grid gap-2 rounded-xl border bg-muted/30 p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Smartphone className="size-4" /> Install Journal as an app
          </p>
          {install === "installed" ? (
            <p className="text-[13px] text-profit">Installed — you&apos;re using the app.</p>
          ) : install === "prompt" ? (
            <Button variant="brand" size="sm" className="w-fit" onClick={() => void doInstall()}>
              <Download /> Install app
            </Button>
          ) : install === "ios" ? (
            <p className="text-[13px] text-muted-foreground">
              In Safari tap <Share className="inline size-3.5" /> Share → <strong>Add to Home Screen</strong>. On iPhone, notifications work only from the installed app.
            </p>
          ) : (
            <p className="text-[13px] text-muted-foreground">Open this site in Chrome (Android) or Safari (iPhone) and use “Install app” / “Add to Home Screen”.</p>
          )}
        </div>

        {/* This device */}
        <div className="grid gap-3">
          <p className="text-sm font-medium">This device</p>
          {!vapidKey ? (
            <p className="text-[13px] text-muted-foreground">Push notifications need VAPID keys on the server (see DEPLOY.md).</p>
          ) : !pushSupported ? (
            <p className="text-[13px] text-muted-foreground">This browser can&apos;t receive push notifications. On iPhone, install the app first.</p>
          ) : subscribed ? (
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-profit-soft px-2.5 py-1.5 text-sm text-profit">
                <Bell className="size-4" /> Notifications on
              </span>
              <Button variant="outline" size="sm" onClick={() => void disablePush()}>
                <BellOff /> Turn off
              </Button>
            </div>
          ) : (
            <Button variant="brand" size="sm" className="w-fit" onClick={() => void enablePush()} disabled={permission === "denied"}>
              <Bell /> {permission === "denied" ? "Blocked in browser settings" : "Turn on notifications"}
            </Button>
          )}
          <p className="text-xs text-muted-foreground">{devices} device{devices === 1 ? "" : "s"} connected to your account.</p>
        </div>

        {/* Telegram */}
        <div className="grid gap-3">
          <p className="text-sm font-medium">Telegram</p>
          {!telegramReady ? (
            <p className="text-[13px] text-muted-foreground">Telegram needs a bot token on the server (see DEPLOY.md).</p>
          ) : telegramConnected ? (
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-profit-soft px-2.5 py-1.5 text-sm text-profit">
                <Send className="size-4" /> Connected
              </span>
              <Button variant="outline" size="sm" onClick={() => start(async () => void (await disconnectTelegram(), location.reload()))}>
                Disconnect
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  start(async () => {
                    const r = await telegramLink();
                    if (!r.ok) return void toast.error(r.error);
                    window.open(r.url, "_blank", "noopener");
                    toast.message("In Telegram, tap Start. Then reload this page.");
                  })
                }
              >
                <Send /> Connect Telegram
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  start(async () => {
                    const r = await activateTelegramBot();
                    if (r.ok) toast.success(r.message);
                    else toast.error(r.message);
                  })
                }
              >
                Activate bot (once)
              </Button>
            </div>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-fit"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await sendTestAlert();
              if (r.ok) toast.success(`Test sent to ${r.sent} place${r.sent === 1 ? "" : "s"}`);
              else toast.error(r.error);
            })
          }
        >
          {pending ? <Loader2 className="animate-spin" /> : <Bell />} Send a test alert
        </Button>

        {/* What to send */}
        <div className="grid gap-4 border-t pt-5">
          <Toggle checked={prefs.notifyNews} onChange={(v) => save({ notifyNews: v })} label="High-impact news" hint="A reminder before releases for your currencies." />
          {prefs.notifyNews && (
            <label className="-mt-2 grid max-w-56 gap-1.5 text-sm">
              <span className="text-[13px] text-muted-foreground">Remind me</span>
              <Combobox
                value={String(prefs.notifyNewsMinutes)}
                onValueChange={(v) => save({ notifyNewsMinutes: Number(v) })}
                options={[5, 10, 15, 30, 60].map((m) => ({ value: String(m), label: `${m} minutes before` }))}
              />
            </label>
          )}
          <Toggle checked={prefs.notifyCooldown} onChange={(v) => save({ notifyCooldown: v })} label="Cooldown after a loss" hint="When a losing trade closes, so you step away." />
          <Toggle checked={prefs.notifyLimits} onChange={(v) => save({ notifyLimits: v })} label="Limits reached" hint="Daily/weekly max loss or max trades." />
          <Toggle checked={prefs.notifyGuard} onChange={(v) => save({ notifyGuard: v })} label="MT5 guard" hint="A trade broke a rule, or has no stop loss." />
          <Toggle checked={prefs.notifyReviews} onChange={(v) => save({ notifyReviews: v })} label="AI reviews" hint="Your daily and weekly review is ready." />
        </div>

        {/* Guard */}
        <div className="grid gap-4 border-t pt-5">
          <p className="flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="size-4 text-brand-ink" /> MT5 discipline guard (EA v1.05+)
          </p>
          <Toggle
            checked={prefs.guardAlerts}
            onChange={(v) => save({ guardAlerts: v })}
            label="Alert inside MT5"
            hint="Pop-up and MT5 phone push when a new trade is in a news window, during a cooldown, after a limit, or has no stop loss."
          />
          <Toggle
            checked={prefs.guardAutoClose}
            onChange={async (v) => {
              if (v) {
                const ok = await confirm({
                  title: "Let the EA close rule-breaking trades?",
                  description:
                    "The EA will close a new position right away if it breaks a rule. It can close at a loss (spread/slippage). It also needs the EA input “Guard may close” = true and Algo Trading on in MT5.",
                  confirmLabel: "Allow auto-close",
                  destructive: true,
                });
                if (!ok) return;
              }
              save({ guardAutoClose: v });
            }}
            label="Auto-close rule-breaking trades"
            hint="Off by default. Strict mode for when alerts aren't enough."
          />
        </div>

        {/* Language */}
        <div className="grid gap-2 border-t pt-5">
          <p className="text-sm font-medium">Language / ভাষা</p>
          <div role="radiogroup" className="flex w-fit rounded-lg border p-0.5 text-sm">
            {(
              [
                ["en", "English"],
                ["bn", "বাংলা"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={prefs.locale === v}
                onClick={() => {
                  save({ locale: v });
                  setTimeout(() => location.reload(), 400);
                }}
                className={prefs.locale === v ? "rounded-md bg-brand px-3 py-1.5 font-medium text-white dark:text-background" : "rounded-md px-3 py-1.5 text-muted-foreground"}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
