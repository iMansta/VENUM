import {
  verifyCelesteAgent,
  celestePing,
  getCatalogBundle,
  upsertMarketPrices,
  syncMarketPricesFromAlbionData,
  aggregateCelesteObservations,
  getCelesteOperationalStatus,
  syncGuildMembers,
  syncGameEvents,
  syncMissionNotifications,
  ingestCelesteTelemetry,
  runFullServerSync,
} from '../server/celesteService.mjs';

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Celeste-Token');
};

export default async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const action =
    req.query?.action ||
    (typeof req.body === 'object' && req.body?.action) ||
    'ping';

  if (action === 'ping' && req.method === 'GET') {
    const auth = verifyCelesteAgent(req);
    if (!auth.ok) {
      res.status(auth.status || 401).json({ ok: false, error: auth.error });
      return;
    }
    try {
      const data = await celestePing();
      res.status(200).json(data);
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const auth = verifyCelesteAgent(req);
  if (!auth.ok) {
    res.status(auth.status || 401).json({ ok: false, error: auth.error });
    return;
  }

  try {
    switch (action) {
      case 'ping': {
        res.status(200).json(await celestePing());
        break;
      }
      case 'catalog': {
        res.status(200).json({ ok: true, ...(await getCatalogBundle()) });
        break;
      }
      case 'status': {
        res.status(200).json(await getCelesteOperationalStatus());
        break;
      }
      case 'prices': {
        const rows = req.body?.rows || req.body?.prices || [];
        const result = await upsertMarketPrices(rows);
        res.status(200).json({ ok: true, ...result });
        break;
      }
      case 'prices-sync': {
        const result = await syncMarketPricesFromAlbionData();
        res.status(200).json({ ok: true, ...result });
        break;
      }
      case 'guild': {
        res.status(200).json({ ok: true, ...(await syncGuildMembers(req.body || {})) });
        break;
      }
      case 'events': {
        res.status(200).json({ ok: true, ...(await syncGameEvents()) });
        break;
      }
      case 'missions': {
        res.status(200).json({ ok: true, ...(await syncMissionNotifications()) });
        break;
      }
      case 'telemetry': {
        const result = await ingestCelesteTelemetry(req.body || {});
        res.status(200).json({ ok: true, ...result });
        break;
      }
      case 'aggregate': {
        const limit = Number(req.body?.limit || 500);
        const result = await aggregateCelesteObservations(limit);
        res.status(200).json({ ok: true, ...result });
        break;
      }
      case 'sync': {
        const prices = req.body?.rows || req.body?.prices;
        const result = { ok: true };
        if (prices?.length) {
          result.prices = await upsertMarketPrices(prices);
        }
        result.aggregate = await aggregateCelesteObservations(1000);
        result.server = await runFullServerSync();
        res.status(200).json(result);
        break;
      }
      default:
        res.status(400).json({ ok: false, error: `Ação desconhecida: ${action}` });
    }
  } catch (err) {
    console.error('[api/celeste]', action, err);
    res.status(500).json({ ok: false, error: err.message || 'Erro interno' });
  }
}
