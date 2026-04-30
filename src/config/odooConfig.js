export const odooConfig = {
  baseUrl: process.env.EXPO_PUBLIC_ODOO_URL || 'http://mmatli.ddns.net:1616',
  database: process.env.EXPO_PUBLIC_ODOO_DB || 'full_test',
  siteModel: process.env.EXPO_PUBLIC_ODOO_SITE_MODEL || 'travel.site',
};

export const normalizeOdooBaseUrl = (url = odooConfig.baseUrl) =>
  String(url).replace(/\/+$/, '');
