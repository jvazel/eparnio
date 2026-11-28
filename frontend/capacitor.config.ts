import fs from 'node:fs';
import path from 'node:path';

/**
 * Configuration Capacitor Android (Mode Hybride).
 * L'APK charge l'application déployée sur Vercel (`VITE_CAPACITOR_SERVER_URL`) afin que
 * chaque mise à jour React soit disponible instantanément sans renvoyer un nouvel APK,
 * tout en conservant le pont natif vers les widgets d'écran d'accueil Android.
 */
function readEnvValue(key: string): string | undefined {
  const fromProcess = process.env[key]?.trim();
  if (fromProcess) return fromProcess;

  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return undefined;

  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    if (trimmed.slice(0, eqIndex).trim() === key) {
      return trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, '');
    }
  }
  return undefined;
}

const serverUrl = readEnvValue('VITE_CAPACITOR_SERVER_URL');

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
