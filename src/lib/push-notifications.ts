import { supabase } from "@/integrations/supabase/client";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function getPushServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  // Clean up any legacy push-only service workers (old scope /push-notifications/)
  const registrations = await navigator.serviceWorker.getRegistrations();
  const pushOnlyScope = `${window.location.origin}/push-notifications/`;

  const legacyPushRegistrations = registrations.filter((registration) => {
    return registration.scope === pushOnlyScope;
  });

  if (legacyPushRegistrations.length > 0) {
    await Promise.all(legacyPushRegistrations.map((r) => r.unregister()));
  }

  // Use the main PWA service worker (Workbox SW now includes push handler via importScripts)
  const registration = await navigator.serviceWorker.ready;
  return registration;
}

export type PushSetupStatus =
  | "ok"
  | "unsupported"
  | "permission_denied"
  | "vapid_unavailable"
  | "subscription_failed"
  | "not_authenticated"
  | "storage_failed";

export interface PushSetupResult {
  ok: boolean;
  status: PushSetupStatus;
  message?: string;
}

export async function requestNotificationPermission(): Promise<PushSetupResult> {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    console.warn("Push notifications not supported");
    return { ok: false, status: "unsupported" };
  }

  const permission =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();

  if (permission !== "granted") {
    return { ok: false, status: "permission_denied" };
  }

  try {
    const registration = await getPushServiceWorkerRegistration();

    const { data: vapidData, error: vapidError } = await supabase.functions.invoke("get-vapid-key");
    if (vapidError || !vapidData?.publicKey) {
      console.error("No VAPID public key", vapidError);
      return { ok: false, status: "vapid_unavailable" };
    }

    const pushManager = (registration as any).pushManager;

    let subscription = await pushManager.getSubscription();
    if (!subscription) {
      subscription = await pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey),
      });
    }

    const subJson = subscription.toJSON();
    const endpoint = subJson.endpoint;
    const p256dh = subJson.keys?.p256dh;
    const auth = subJson.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      console.error("Invalid push subscription payload");
      return { ok: false, status: "subscription_failed" };
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { ok: false, status: "not_authenticated" };
    }

    const payload = {
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
    };

    const { data: existing, error: existingError } = await supabase
      .from("push_subscriptions")
      .select("id")
      .eq("user_id", user.id)
      .eq("endpoint", endpoint)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing?.id) {
      const { error: updateError } = await supabase
        .from("push_subscriptions")
        .update({ p256dh, auth })
        .eq("id", existing.id);

      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase
        .from("push_subscriptions")
        .insert(payload);

      if (insertError) throw insertError;
    }

    // Keep only the current active endpoint for this user.
    // Old endpoints (legacy SW scopes/devices) can cause generic browser fallback notifications.
    const { error: cleanupError } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .neq("endpoint", endpoint);

    if (cleanupError) {
      console.warn("Push cleanup warning:", cleanupError.message);
    }

    return { ok: true, status: "ok" };
  } catch (err) {
    console.error("Push subscription failed:", err);
    return {
      ok: false,
      status: "storage_failed",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export function isNotificationSupported(): boolean {
  return "Notification" in window && "serviceWorker" in navigator;
}

export function getNotificationPermission(): string {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

