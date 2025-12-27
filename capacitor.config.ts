import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fluxplatform.app',
  appName: 'Flux Platform',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // Configuração crítica para garantir que o APK consuma o mesmo backend que o site
    allowNavigation: [
      "*.onrender.com",
      "*.googleapis.com",
      "*.google.com",
      "*.syncpayments.com.br",
      "localhost"
    ]
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    }
  }
};

export default config;