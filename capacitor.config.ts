import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.foodlo.app',
  appName: 'Foodlo',
  webDir: 'dist/client',
  server: {
    // De native app toont de live Foodlo-site, zodat updates meteen zichtbaar zijn
    // zonder telkens een nieuwe versie naar de stores te sturen.
    url: 'https://foodloapp.com',
    cleartext: false,
  },
  ios: {
    contentInset: 'always',
  },
  android: {
    backgroundColor: '#f8fafc',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#f8fafc',
      showSpinner: false,
    },
  },
};

export default config;
