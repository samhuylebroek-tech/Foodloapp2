import type { CapacitorConfig } from "@capacitor/cli";

// Foodlo iOS + Android. De app laadt de live Foodlo van app.foodloapp.com,
// zodat accounts, gegevens en updates altijd gelijk lopen met de web-app.
const config: CapacitorConfig = {
  appId: "com.foodloapp.app",
  appName: "Foodlo",
  webDir: "public",
  server: {
    url: "https://app.foodloapp.com",
    cleartext: false,
    allowNavigation: ["app.foodloapp.com", "foodloapp.com", "*.foodloapp.com"],
  },
  ios: { contentInset: "never", backgroundColor: "#FAF6EF" },
  android: { backgroundColor: "#FAF6EF" },
  plugins: {
    SplashScreen: { launchShowDuration: 800, backgroundColor: "#FAF6EF", showSpinner: false },
    StatusBar: { style: "LIGHT", backgroundColor: "#FAF6EF", overlaysWebView: true },
  },
};

export default config;
