"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./format";

export interface PushState {
  supported: boolean;
  permission: NotificationPermission | "unsupported";
  subscribed: boolean;
  busy: boolean;
  error: string | null;
  enable(): Promise<void>;
  disable(): Promise<void>;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export function usePush(): PushState {
  const [state, setState] = useState<{
    supported: boolean;
    permission: NotificationPermission | "unsupported";
    subscribed: boolean;
  }>({ supported: false, permission: "unsupported", subscribed: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canPush = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!canPush) return;
    let active = true;
    navigator.serviceWorker
      .register("/desk-sw.js")
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (!active) return;
        setState({
          supported: true,
          permission: Notification.permission,
          subscribed: Boolean(sub),
        });
      })
      .catch(() => {
        if (active) setState({ supported: true, permission: Notification.permission, subscribed: false });
      });
    return () => {
      active = false;
    };
  }, []);

  const enable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const perm = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      if (perm !== "granted") {
        setState((s) => ({ ...s, permission: perm, subscribed: false }));
        return;
      }
      const { publicKey } = await api<{ publicKey: string }>("/api/push/public-key");
      const reg = await navigator.serviceWorker.register("/desk-sw.js");
      await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      const sub =
        existing ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));
      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("Browser returned an incomplete push subscription.");
      }
      await api("/api/push/subscribe", {
        method: "POST",
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        }),
      });
      setState({ supported: true, permission: perm, subscribed: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await api("/api/push/subscribe", {
          method: "DELETE",
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe();
      }
      setState((s) => ({ ...s, subscribed: false }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  return { ...state, busy, error, enable, disable };
}

