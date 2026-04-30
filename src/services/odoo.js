import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeOdooBaseUrl, odooConfig } from '../config/odooConfig';

const SESSION_KEY = 'odoo_session';

class OdooSession {
  constructor() {
    this.uid = null;
    this.sessionId = null;
    this.userInfo = null;
  }

  async load() {
    try {
      const stored = await AsyncStorage.getItem(SESSION_KEY);
      if (!stored) return false;

      const session = JSON.parse(stored);
      this.uid = session.uid;
      this.sessionId = session.sessionId;
      this.userInfo = session.userInfo;
      return Boolean(this.uid);
    } catch (error) {
      console.error('Error loading Odoo session:', error);
      return false;
    }
  }

  async save() {
    const session = {
      uid: this.uid,
      sessionId: this.sessionId,
      userInfo: this.userInfo,
    };
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  async clear() {
    this.uid = null;
    this.sessionId = null;
    this.userInfo = null;
    await AsyncStorage.removeItem(SESSION_KEY);
  }
}

export const odooSession = new OdooSession();

const buildHeaders = (withSession = true) => {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (withSession && odooSession.sessionId) {
    headers.Cookie = `session_id=${odooSession.sessionId}`;
    headers['X-Openerp-Session-Id'] = odooSession.sessionId;
  }

  return headers;
};

const requestOdoo = async (path, params = {}, withSession = true) => {
  const response = await fetch(`${normalizeOdooBaseUrl()}${path}`, {
    method: 'POST',
    headers: buildHeaders(withSession),
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params,
      id: Date.now(),
    }),
  });

  const data = await response.json();

  if (data.error) {
    const message =
      data.error.data?.message ||
      data.error.data?.debug ||
      data.error.message ||
      'Odoo API error';
    throw new Error(message);
  }

  return data.result;
};

export const loginOdoo = async (username, password) => {
  const result = await requestOdoo(
    '/web/session/authenticate',
    {
      db: odooConfig.database,
      login: username,
      password,
    },
    false
  );

  if (!result?.uid) {
    throw new Error('Invalid Odoo credentials');
  }

  odooSession.uid = result.uid;
  odooSession.sessionId = result.session_id;
  odooSession.userInfo = {
    id: result.uid,
    uid: result.uid,
    name: result.name,
    login: result.username || username,
    employee_id: result.employee_id,
  };

  try {
    odooSession.userInfo = await getOdooUserInfo(result.uid);
  } catch (error) {
    console.warn('Could not load full Odoo user info:', error.message);
  }

  await odooSession.save();

  return {
    uid: odooSession.uid,
    userInfo: odooSession.userInfo,
  };
};

export const logoutOdoo = async () => {
  try {
    await requestOdoo('/web/session/destroy', {}, true);
  } catch (error) {
    console.warn('Odoo session destroy failed:', error.message);
  }

  await odooSession.clear();
  return true;
};

export const callKw = async (model, method, args = [], kwargs = {}) => {
  if (!odooSession.uid) {
    const loaded = await odooSession.load();
    if (!loaded) throw new Error('Not authenticated with Odoo');
  }

  return requestOdoo(`/web/dataset/call_kw/${model}/${method}`, {
    model,
    method,
    args,
    kwargs,
  });
};

export const searchOdooRecords = async (
  model,
  domain = [],
  fields = [],
  limit = 100,
  order = 'id desc'
) =>
  callKw(model, 'search_read', [domain], {
    fields,
    limit,
    order,
  });

export const getOdooRecord = async (model, recordId, fields = []) => {
  const result = await callKw(model, 'read', [[recordId]], { fields });
  return result?.[0] || null;
};

export const createOdooRecord = (model, values) =>
  callKw(model, 'create', [values]);

export const updateOdooRecord = (model, recordId, values) =>
  callKw(model, 'write', [[recordId], values]);

export const deleteOdooRecord = (model, recordId) =>
  callKw(model, 'unlink', [[recordId]]);

export const callOdooAction = (model, recordId, actionName, args = []) =>
  callKw(model, actionName, [[recordId], ...args]);

export const getOdooUserInfo = async (uid) => {
  const fields = ['id', 'name', 'login', 'email', 'employee_id'];
  const users = await searchOdooRecords('res.users', [['id', '=', uid]], fields, 1);
  return users?.[0] || null;
};

export const getOdooUsers = async (search = '', limit = 25) => {
  const domain = search
    ? ['|', ['name', 'ilike', search], ['login', 'ilike', search]]
    : [];
  return searchOdooRecords('res.users', domain, ['id', 'name', 'login', 'email'], limit, 'name asc');
};

export const searchOdooNameRecords = async (model, search = '', limit = 20) => {
  const domain = search ? [['name', 'ilike', search]] : [];
  return searchOdooRecords(model, domain, ['id', 'name', 'display_name'], limit, 'name asc');
};

export const onAuthStateChanged = async (callback) => {
  const loaded = await odooSession.load();

  if (!loaded || !odooSession.uid) {
    callback(null);
    return;
  }

  try {
    const userInfo = await getOdooUserInfo(odooSession.uid);
    odooSession.userInfo = userInfo;
    await odooSession.save();
    callback({ uid: odooSession.uid, userInfo });
  } catch (error) {
    console.error('Odoo session validation failed:', error);
    await odooSession.clear();
    callback(null);
  }
};

export const jsonrpcCall = requestOdoo;

export default {
  loginOdoo,
  logoutOdoo,
  onAuthStateChanged,
  searchOdooRecords,
  getOdooRecord,
  createOdooRecord,
  updateOdooRecord,
  deleteOdooRecord,
  callOdooAction,
  callKw,
  getOdooUsers,
  searchOdooNameRecords,
  odooSession,
};
