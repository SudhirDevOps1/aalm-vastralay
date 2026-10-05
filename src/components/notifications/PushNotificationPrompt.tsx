"use client";

import { useSyncExternalStore, useState } from "react";
import { Bell, Check, X } from "lucide-react";

function subscribePermission(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("focus", callback);
  return () => window.removeEventListener("focus", callback);
}

function getPermissionSnapshot(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
    return "unsupported";
  }
  return Notification.permission;
}

function getServerSnapshot(): "unsupported" {
  return "unsupported";
}

export default function PushNotificationPrompt() {
  const permission = useSyncExternalStore(subscribePermission, getPermissionSnapshot, getServerSnapshot);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [justEnabled, setJustEnabled] = useState(false);

  const supported = permission !== "unsupported";
  const enabled = permission === "granted" || justEnabled;

  const enableNotifications = async () => {
    if (!supported) return;
    setLoading(true);

    try {
      // 1. Register Service Worker
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // 2. Request browser permission
      const result = await Notification.requestPermission();

      if (result === "granted") {
        setJustEnabled(true);
        // Try to get push subscription if supported
        try {
          const subscription = await reg.pushManager.getSubscription();
          if (subscription) {
            await fetch("/api/notifications/push-subscribe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(subscription),
            });
          }
        } catch {
          // Push manager fallback
        }
      }
    } catch (err) {
      console.error("Failed to enable push notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!supported || dismissed || enabled || permission === "denied") {
    return null;
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-burgundy-200/80 dark:border-rose-900/50 bg-gradient-to-r from-burgundy-50/70 via-gold-50/30 to-amber-50/50 dark:from-stone-900 dark:via-stone-900 dark:to-stone-900/90 p-4 shadow-sm transition">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-burgundy-700 dark:bg-maroon-700 text-white shadow-sm">
          <Bell className="h-4 w-4" />
        </div>
        <div className="flex-1 pr-6">
          <h4 className="text-sm font-semibold text-burgundy-950 dark:text-stone-100">Get Live Order Dispatch Alerts</h4>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-stone-300">
            Receive instant notifications on your device when your lehenga or saree is packed, dispatched, or out for delivery.
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={enableNotifications}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-burgundy-800 dark:bg-rose-700 dark:hover:bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-burgundy-900 active:scale-95 transition disabled:opacity-50"
            >
              {loading ? (
                "Enabling…"
              ) : enabled ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Enabled
                </>
              ) : (
                "Enable Alerts"
              )}
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="text-xs text-slate-500 dark:text-stone-400 hover:text-slate-700 dark:hover:text-stone-200 transition px-2 py-1"
            >
              Maybe later
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="absolute top-3 right-3 text-slate-400 dark:text-stone-500 hover:text-slate-600 dark:hover:text-stone-300 transition"
          aria-label="Dismiss alert"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
