/**
 * Configuration Capacitor Android (Mode Hybride).
 * L'APK charge l'application déployée sur Vercel (`VITE_CAPACITOR_SERVER_URL`) afin que
 * chaque mise à jour React soit disponible instantanément sans renvoyer un nouvel APK,
 * tout en conservant le pont natif vers les widgets d'écran d'accueil Android.
 */
const serverUrl = process.env.VITE_CAPACITOR_SERVER_URL?.trim();

const config = {
  appId: 'com.eparnio.app',
  appName: 'Eparnio',
  webDir: 'dist',
  ...(serverUrl
    ? {
        server: {
          url: serverUrl,
          cleartext: false
        }
      }
    : {}),
  android: {
    allowMixedContent: false
  }
};

export default config;
