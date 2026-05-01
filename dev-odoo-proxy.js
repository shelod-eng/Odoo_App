const http = require('http');

const PORT = Number(process.env.ODOO_PROXY_PORT || 17777);
const ODOO_URL = String(process.env.ODOO_URL || process.env.EXPO_PUBLIC_ODOO_URL || 'http://mmatli.ddns.net:1616').replace(/\/+$/, '');

const sendJson = (res, status, body) => {
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Content-Type': 'application/json',
  });
  res.end(JSON.stringify(body));
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, { ok: true, odooUrl: ODOO_URL });
    return;
  }

  if (req.method !== 'POST' || req.url !== '/jsonrpc') {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  try {
    const body = await readBody(req);
    const odooResponse = await fetch(`${ODOO_URL}/jsonrpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    const text = await odooResponse.text();
    res.writeHead(odooResponse.status, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
      'Content-Type': odooResponse.headers.get('content-type') || 'application/json',
    });
    res.end(text);
  } catch (error) {
    sendJson(res, 502, {
      error: 'Could not proxy Odoo JSON-RPC request',
      message: error.message,
      odooUrl: ODOO_URL,
    });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[OdooProxy] Listening on http://0.0.0.0:${PORT}`);
  console.log(`[OdooProxy] Forwarding /jsonrpc to ${ODOO_URL}/jsonrpc`);
});
