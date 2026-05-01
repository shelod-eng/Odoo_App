import { Platform } from 'react-native';

const cleanEnv = (value, fallback) => {
  const cleaned = typeof value === 'string' ? value.trim() : value;
  return cleaned || fallback;
};

export const odooConfig = {
  baseUrl: cleanEnv(process.env.EXPO_PUBLIC_ODOO_URL, 'http://mmatli.ddns.net:1616'),
  database: cleanEnv(process.env.EXPO_PUBLIC_ODOO_DB, 'full_test'),
  siteModel: cleanEnv(process.env.EXPO_PUBLIC_ODOO_SITE_MODEL, 'travel.site'),
  proxyUrl: cleanEnv(
    process.env.EXPO_PUBLIC_ODOO_PROXY_URL,
    Platform.OS === 'android' ? 'http://10.0.2.2:17777' : ''
  ),
};

export const normalizeOdooBaseUrl = (url = odooConfig.baseUrl) =>
  cleanEnv(url, odooConfig.baseUrl).replace(/\/+$/, '');

export const normalizeOdooProxyUrl = (url = odooConfig.proxyUrl) =>
  url ? String(url).replace(/\/+$/, '') : '';

export const getOdooReachabilityHint = (url = odooConfig.baseUrl) => {
  const normalizedUrl = normalizeOdooBaseUrl(url);

  if (Platform.OS === 'android' && /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(normalizedUrl)) {
    return 'Android emulators cannot reach the Windows host through localhost; use http://10.0.2.2:<port> or your reachable LAN IP.';
  }

  if (/^http:\/\/192\.168\./.test(normalizedUrl)) {
    return 'Make sure this LAN IP is reachable from Windows and from the Android emulator. If Odoo is running on this PC, try the PC LAN IP shown by ipconfig, or http://10.0.2.2:<port> for the default Android emulator.';
  }

  return 'Check that the Odoo server is running, the port is open, and the configured URL is reachable from the emulator.';
};
