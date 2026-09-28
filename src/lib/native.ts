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
