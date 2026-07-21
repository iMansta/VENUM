import { createCelestePairingToken } from '../server/celestePairingService.mjs';

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

const readAccessToken = (req) => {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  if (!header.startsWith('Bearer ')) return '';
  return header.slice(7).trim();
};

export default async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const accessToken = readAccessToken(req);
  if (!accessToken) {
    res.status(401).json({ ok: false, error: 'Sessão obrigatória' });
    return;
  }

  try {
    const result = await createCelestePairingToken(accessToken);
    if (!result.ok) {
      res.status(result.status || 400).json(result);
      return;
    }
    res.status(200).json(result);
  } catch (err) {
    console.error('[api/celeste-pairing]', err);
    res.status(500).json({ ok: false, error: err.message || 'Erro interno' });
  }
}
