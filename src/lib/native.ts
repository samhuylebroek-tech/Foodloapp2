/**
 * Kleine brug naar de iPhone/Android-app (Capacitor).
 * In de browser doet dit niets.
 */
export async function startNatief(navigeer: (pad: string) => void) {
  if (typeof window === "undefined") return;
  const { Capacitor } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform()) return;
  document.documentElement.classList.add("natief");

  const { App } = await import("@capacitor/app");
  // Android-terugknop: terug in de app, of app sluiten op Start.
  App.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack && window.location.pathname !== "/") window.history.back();
    else void App.exitApp();
  });
  // Links naar foodloapp.com openen meteen de juiste pagina in de app.
  App.addListener("appUrlOpen", ({ url }) => {
    try {
      const u = new URL(url);
      navigeer(u.pathname + u.search);
    } catch {
      /* ongeldige link negeren */
    }
  });

  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch {
    /* geen splash */
  }
}

/** Houdt tijdens het koken het scherm aan, met een echte native terugval. */
export async function houdSchermAan(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const { KeepAwake } = await import("@capacitor-community/keep-awake");
      await KeepAwake.keepAwake();
      return true;
    }
    if (!("wakeLock" in navigator)) return false;
    const lock = await navigator.wakeLock.request("screen");
    (window as Window & { __foodloWakeLock?: WakeLockSentinel }).__foodloWakeLock = lock;
    return true;
  } catch {
    return false;
  }
}

export async function laatSchermWeerSlapen() {
  if (typeof window === "undefined") return;
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const { KeepAwake } = await import("@capacitor-community/keep-awake");
      await KeepAwake.allowSleep();
      return;
    }
    const venster = window as Window & { __foodloWakeLock?: WakeLockSentinel };
    await venster.__foodloWakeLock?.release();
    delete venster.__foodloWakeLock;
  } catch {
    // Het toestel heeft de blokkering al vrijgegeven.
  }
}
